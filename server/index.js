const express = require('express');
const fs = require('fs');
const path = require('path');
const { readCalendarEvents, filterCalendarEvents } = require('./calendar-events');
const { saveToken, saveWatchlist } = require('./push');
const { queryCatalogue } = require('./catalogue');
const { saveClick } = require('./outbound-clicks');
const { truePriceGroups } = require('./true-price');
const { eventVendors } = require('./event-vendors');
const { analyticsSummary } = require('./analytics');
const { validateImport,parseCsv,mapColumns } = require('./csv-import');
const { findMatches } = require('./fatefind');
const { marketSummary } = require('./market-summary');
const { optimiseBasket } = require('./basket-breaker');
const { publicBounty,bountyMatches } = require('./bounty');
const { aggregateDemand } = require('./demand-signal');

const app = express();
app.use(express.json({ limit: '16kb' }));
const PORT = 3000;

const dataDir = path.join(__dirname, '..', 'data');

function readJson(fileName) {
  const filePath = path.join(dataDir, fileName);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

app.get('/', (req, res) => {
  res.json({
    name: 'FateDrop API',
    status: 'online',
  });
});

app.get('/api/products', (req, res) => {
  try {
    const products = readJson('products.json');

    res.json({
      success: true,
      count: Array.isArray(products)
        ? products.length
        : Object.keys(products).length,
      products,
    });
  } catch (error) {
    console.error('Failed to load products:', error);

    res.status(500).json({
      success: false,
      error: 'Could not load products',
    });
  }
});

app.get('/api/status', (req, res) => {
  try {
    const state = readJson('state.json');
    const products = readJson('products.json');

    const productCount = Array.isArray(products)
      ? products.length
      : Object.keys(products).length;

    res.json({
      success: true,
      monitor: {
        baselineComplete: state.baselineComplete ?? false,
        productsTracked: productCount,
        retailer: 'Pokémon Center UK',
        retailerKey: 'pokemon-center-uk',
      },
      state,
    });
  } catch (error) {
    console.error('Failed to load status:', error);

    res.status(500).json({
      success: false,
      error: 'Could not load monitor status',
    });
  }
});
app.get('/api/events', (req, res) => {
  try {
    const eventsPath = path.join(dataDir, 'events.json');

    if (!fs.existsSync(eventsPath)) {
      return res.json({
        success: true,
        count: 0,
        events: [],
      });
    }

    const raw = fs.readFileSync(eventsPath, 'utf8');
    const events = JSON.parse(raw);

    res.json({
      success: true,
      count: Array.isArray(events) ? events.length : 0,
      events: Array.isArray(events) ? events : [],
    });
  } catch (error) {
    console.error('Failed to load events:', error);

    res.status(500).json({
      success: false,
      error: 'Could not load events',
    });
  }
});
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('⚡ FateDrop API is running');
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Status: http://localhost:${PORT}/api/status`);
  console.log(`Products: http://localhost:${PORT}/api/products`);
  console.log('');
});
app.get('/api/market-summary',(req,res)=>{try{res.json({success:true,...marketSummary(readJson('products.json'))});}catch(error){res.status(500).json({success:false,error:'Could not load market summary'});}});

app.get('/api/catalogue', (req, res) => {
  try {
    const result = queryCatalogue(readJson('products.json'), req.query);
    if (req.get('if-none-match') === result.etag) return res.status(304).end();
    res.set('etag', result.etag).json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to query catalogue:', error);
    res.status(500).json({ success: false, error: 'Could not query catalogue' });
  }
});
app.post('/api/catalogue/offers',(req,res)=>{try{const ids=req.body?.ids;if(!Array.isArray(ids)||ids.length>1000||ids.some(id=>typeof id!=='string'))return res.status(400).json({success:false,error:'ids must be an array of at most 1,000 strings'});const wanted=new Set(ids),products=Object.values(readJson('products.json')).map(require('./catalogue').compactProduct).filter(product=>wanted.has(`${product.retailerKey}:${product.sku}`));res.json({success:true,count:products.length,products});}catch(error){res.status(500).json({success:false,error:'Could not load saved offers'});}});
app.post('/api/outbound-clicks', (req, res) => { const click=saveClick(req.body);if(!click)return res.status(400).json({success:false,error:'Invalid outbound click'});res.status(201).json({success:true,id:click.id}); });
app.get('/api/true-price', (req,res)=>{try{const groups=truePriceGroups(readJson('products.json'),req.query.q);res.json({success:true,count:groups.length,groups,disclaimer:'Prices and stock can change on the retailer site. Delivery totals are only compared when delivery is known.'});}catch(error){console.error('Failed to compare prices:',error);res.status(500).json({success:false,error:'Could not compare prices'});}});
app.get('/api/events/:eventId/vendors',(req,res)=>{try{const vendors=eventVendors(readJson('demo-event-vendors.json'),req.params.eventId,req.query.q);res.json({success:true,isDemo:true,count:vendors.length,vendors});}catch(error){res.status(500).json({success:false,error:'Could not load event vendors'});}});
app.post('/api/catalogue-import/validate',(req,res)=>{
  let rows=Array.isArray(req.body?.rows)?req.body.rows:typeof req.body?.csvText==='string'?parseCsv(req.body.csvText):null;
  if(!rows||rows.length>5000)return res.status(400).json({success:false,error:'Provide CSV text or at most 5,000 rows'});
  if(req.body?.mapping&&typeof req.body.mapping==='object')rows=mapColumns(rows,req.body.mapping);
  const validation=validateImport(rows),invalidRows=new Set(validation.errors.map(error=>error.row-2)),retailerId=typeof req.body?.retailerId==='string'?req.body.retailerId:'';
  const existingSkus=new Set(Object.values(readJson('products.json')).filter(product=>product.retailerKey===retailerId).map(product=>String(product.sku)));
  const validRows=rows.filter((_,index)=>!invalidRows.has(index)),updates=validRows.filter(row=>existingSkus.has(String(row.retailer_sku))).length;
  res.json({success:true,preview:rows.slice(0,5),summary:{additions:validRows.length-updates,updates,skipped:invalidRows.size,total:rows.length},...validation});
});
app.get('/api/retailer-analytics/:retailerId',(req,res)=>{let clicks=[];try{clicks=readJson('outbound-clicks.json')}catch{}res.json({success:true,summary:analyticsSummary(clicks,req.params.retailerId,req.query.from,req.query.to)});});
app.post('/api/fatefind/matches',(req,res)=>{try{const result=findMatches(readJson('products.json'),req.body||{});res.json({success:true,...result,notice:'Matches were calculated on request. Hosted background FateFind monitoring is not enabled.'});}catch(error){res.status(500).json({success:false,error:'Could not calculate FateFind matches'});}});
app.get('/api/monitor-health', (req, res) => {
  try {
    const healthPath = path.join(dataDir, 'monitor-health.json');
    const health = fs.existsSync(healthPath) ? JSON.parse(fs.readFileSync(healthPath, 'utf8')) : { retailers: {} };
    res.json({ success: true, ...health, browserDependent: ['pokemon-center-uk', 'smyths-toys'] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Could not load monitor health' });
  }
});
app.post('/api/push/register', (req, res) => {
  if (!saveToken(req.body?.token)) return res.status(400).json({ success: false, error: 'Invalid Expo push token' });
  res.json({ success: true });
});
app.post('/api/push/watchlist', (req, res) => {
  if (!saveWatchlist(req.body?.token, req.body?.productKeys)) return res.status(400).json({ success: false, error: 'Invalid watchlist subscription' });
  res.json({ success: true, count: req.body.productKeys.length });
});
app.get('/api/calendar-events', (req, res) => {
  const events = filterCalendarEvents(
    readCalendarEvents(path.join(dataDir, 'calendar-events.json')),
    req.query
  );
  res.json({ success: true, count: events.length, events });
});

app.get('/api/calendar-events/:id', (req, res) => {
  const event = readCalendarEvents(path.join(dataDir, 'calendar-events.json'))
    .find(item => item.id === req.params.id);
  if (!event) return res.status(404).json({ success: false, error: 'Calendar event not found' });
  res.json({ success: true, event });
});
app.post('/api/basket-breaker',(req,res)=>{try{if(!Array.isArray(req.body?.items)||!Array.isArray(req.body?.offers)||req.body.items.length>25||req.body.offers.length>10000)return res.status(400).json({success:false,error:'Invalid basket input'});res.json({success:true,solutions:optimiseBasket(req.body)});}catch(error){res.status(400).json({success:false,error:error.message||'Could not calculate basket'});}});
app.get('/api/development/bounties',(req,res)=>{if(process.env.NODE_ENV==='production')return res.status(404).end();const data=readJson('priority-one-demo.json'),requests=data.bounties.map(publicBounty).filter(Boolean);res.json({success:true,isDemo:true,notice:data.notice,requests,responses:data.bountyResponses,matches:requests.map(request=>({requestId:request.id,responseIds:data.bountyResponses.filter(response=>{const offer=data.bountyOffers.find(item=>item.id===response.offerId);return offer&&bountyMatches(request,offer);}).map(response=>response.id)}))});});
app.get('/api/development/demand-signal',(req,res)=>{if(process.env.NODE_ENV==='production')return res.status(404).end();const data=readJson('priority-one-demo.json');res.json({success:true,isDemo:true,notice:data.notice,minimumCohort:5,aggregates:aggregateDemand(data.demandEvents,{minimumCohort:5,isDemo:true})});});
