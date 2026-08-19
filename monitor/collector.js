const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { normaliseProduct, compareProducts, mergeEventHistory } = require("./compare");
const { sendStockNotifications } = require("../server/push");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILES = { products:path.join(DATA_DIR,"products.json"), events:path.join(DATA_DIR,"events.json"), state:path.join(DATA_DIR,"state.json") };
const SEARCH_PART = "/tpci-ecommweb-api/search";
const CATALOGUE_URL = "https://www.pokemoncenter.com/en-gb/category/trading-card-game";
const NEXT_BUTTON = 'button[aria-label="Go to next page"]';
const TIMEOUT = 20000;
const productUrl = raw => {
  if (typeof raw.url === "string" && /^https?:\/\//i.test(raw.url)) return raw.url;
  const slug = String(raw.title||raw.reporting_product_name||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  return `https://www.pokemoncenter.com/en-gb/product/${encodeURIComponent(raw.pid)}${slug?`/${slug}`:""}`;
};

function readJson(file,fallback){try{if(!fs.existsSync(file))return fallback;const raw=fs.readFileSync(file,"utf8").trim();return raw?JSON.parse(raw):fallback}catch(e){throw new Error(`Could not read ${path.basename(file)}: ${e.message}`)}}
function writeJsonAtomic(file,data){const temp=`${file}.tmp`;fs.writeFileSync(temp,JSON.stringify(data,null,2),"utf8");fs.renameSync(temp,file)}
function responseBatch(data){const api=data?.response;if(!Array.isArray(api?.docs))throw new Error("Catalogue response contained no response.docs array");const total=Number(api.numFound),start=Number(api.start??0);if(!Number.isInteger(total)||total<0||!Number.isInteger(start)||start<0)throw new Error("Catalogue response contained invalid start/numFound");return{start,total,docs:api.docs}}
async function waitForSearch(page,action){const responsePromise=page.waitForResponse(r=>r.url().includes(SEARCH_PART)&&r.ok(),{timeout:TIMEOUT});await action();return responseBatch(await (await responsePromise).json())}

async function collectLiveSnapshot(page,master){
  const products={},offsets=new Set(),rawCount={value:0};let expected=null;
  function add(batch){if(offsets.has(batch.start))throw new Error(`Duplicate catalogue offset ${batch.start}`);if(expected!==null&&batch.total!==expected)throw new Error(`Catalogue total changed during scan (${expected} to ${batch.total})`);expected=batch.total;offsets.add(batch.start);rawCount.value+=batch.docs.length;for(const raw of batch.docs){if(!raw.pid)throw new Error(`Product without SKU at offset ${batch.start}`);if(products[raw.pid])throw new Error(`Duplicate SKU ${raw.pid}`);products[raw.pid]=normaliseProduct({...raw,url:productUrl(raw),retailer:"Pokémon Center UK",retailerKey:"pokemon-center-uk"},master[raw.pid])}console.log(`Batch ${batch.start}: ${batch.docs.length} records; ${Object.keys(products).length}/${expected} unique`)}
  console.log("Returning catalogue to its first page and capturing page 1 live...");
  add(await waitForSearch(page,async()=>{await page.goto(CATALOGUE_URL,{waitUntil:"domcontentloaded",timeout:TIMEOUT})}));
  while(Object.keys(products).length<expected){
    const next=page.locator(NEXT_BUTTON).first();
    await next.waitFor({state:"visible",timeout:TIMEOUT});
    if(await next.isDisabled()||await next.getAttribute("aria-disabled")==="true")throw new Error("Next page disabled before reported catalogue total was reached");
    add(await waitForSearch(page,()=>next.click()));
  }
  const count=Object.keys(products).length;
  if(count!==expected||rawCount.value!==expected)throw new Error(`Incomplete or suspicious scan: ${count} unique / ${rawCount.value} records / ${expected} reported`);
  return{products,reportedTotal:expected,count};
}

async function run(){
  console.log("\nFATEDROP LIVE MONITOR\n");
  const master=readJson(FILES.products,{}),state=readJson(FILES.state,{});
  if(!state.baselineComplete)throw new Error("Baseline is not marked complete.");
  console.log(`Loaded ${Object.keys(master).length} historical products (previous reported total: ${state.reportedCatalogueTotal??"unknown"})`);
  const browser=await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context=browser.contexts()[0];if(!context)throw new Error("No Chrome context found");
    const page=context.pages().find(p=>p.url().includes("pokemoncenter.com"));if(!page)throw new Error("No Pokémon Center tab found");
    const scan=await collectLiveSnapshot(page,master);
    console.log(`Verified complete live snapshot: ${scan.count}/${scan.reportedTotal}`);
    const compared=compareProducts(master,scan.products,{scanVerified:true,retailerKey:"pokemon-center-uk"});
    const history=mergeEventHistory(readJson(FILES.events,[]),compared.events);
    writeJsonAtomic(FILES.products,compared.products);
    writeJsonAtomic(FILES.events,history);
    writeJsonAtomic(FILES.state,{...state,baselineComplete:true,lastSuccessfulScan:new Date().toISOString(),lastProductCount:scan.count,reportedCatalogueTotal:scan.reportedTotal,knownProductCount:Object.keys(compared.products).length});
    await sendStockNotifications(compared.events).catch(error=>console.error(`Push delivery failed: ${error.message}`));
    console.log(`Committed ${scan.count} listed products; preserving ${Object.keys(compared.products).length} historical records.`);
    console.log(`Saved ${compared.events.length} new event(s). FateDrop monitoring cycle complete.`);
    return compared;
}
if(require.main===module)run().catch(e=>{console.error(`\nFATEDROP FAILED: ${e.message}`);console.error("Master database and event history were not changed unless a complete snapshot was verified.");process.exitCode=1});
module.exports={run,collectLiveSnapshot,responseBatch};
