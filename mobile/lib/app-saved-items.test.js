const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');

function device(server = new Map()) {
  const storage = new Map();
  const state = { identity: 'alice', token: 'alice-token', offline: false, requests: 0, ready: true };
  const raw = fs.readFileSync(path.join(__dirname,'../services/app-saved-items.ts'),'utf8');
  const code = stripTypeScriptTypes(raw).replace(/^import .*;\r?$/gm,'').replace(/export (async function|function)/g,'$1');
  const api = new Function('AsyncStorage','FATEDROP_WEB_URL','getStoredSessionToken','getActiveIdentitySnapshot','fetch',`${code}\nreturn {savedAccount,loadAppSavedItems,changeAppSavedItem,appSavedNotice};`)(
    {getItem:async key=>storage.get(key)||null,setItem:async(key,value)=>storage.set(key,value),removeItem:async key=>storage.delete(key)},
    'https://fatedrop.co.uk',async()=>state.token,()=>state.ready?({accessAllowed:true,user:{fateId:state.identity}}):null,
    async(url,options)=>{
      state.requests++;
      if(state.offline) throw new Error('Offline');
      const owner=options.headers.authorization,collection=url.split('/').at(-1),namespace=owner+':'+collection;
      if(!server.has(namespace))server.set(namespace,new Map());
      const rows=server.get(namespace);
      const itemKey=item=>collection==='wishlist'?item.id:item.kind==='card'?'card:'+item.cardIdentityId:'set:'+item.key;
      if(options.body){const body=JSON.parse(options.body);if(body.operation==='save')rows.set(itemKey(body.item),{deleted:false,payload:body.item});if(body.operation==='remove')rows.set(body.key,{deleted:true,payload:null});if(body.operation==='import')for(const item of body.items)if(!rows.has(itemKey(item)))rows.set(itemKey(item),{deleted:false,payload:item});}
      return {ok:true,json:async()=>options.body?{saved:true}:{items:[...rows].map(([key,value])=>({key,...value}))}};
    },
  );
  return {api,state,storage,server};
}
const card = id=>({kind:'card',cardIdentityId:id,printingId:'printing-'+id});

test('real identity memory is available only for the session token that produced it',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'../services/fatedrop-id.ts'),'utf8');
  const state=source.slice(source.indexOf('let activeIdentitySnapshot:'),source.indexOf('async function storeSessionToken'));
  const saver=source.match(/async function saveSnapshot[^\r\n]+/)[0];
  let token='a';
  const code=stripTypeScriptTypes(state+saver).replace(/export function/g,'function');
  const real=new Function('getStoredSessionToken','normalizeSnapshot',`${code}\nreturn {saveSnapshot,getActiveIdentitySnapshot};`)(async()=>token,value=>value);
  await real.saveSnapshot({user:{fateId:'alice'}},'a');
  assert.equal(real.getActiveIdentitySnapshot('a').user.fateId,'alice');
  assert.equal(real.getActiveIdentitySnapshot('b'),null);
  token='b';
  await real.saveSnapshot({user:{fateId:'old-request'}},'a');
  assert.equal(real.getActiveIdentitySnapshot('b'),null);
  await real.saveSnapshot({user:{fateId:'bob'}},'b');
  assert.equal(real.getActiveIdentitySnapshot('b').user.fateId,'bob');
});

test('a token awaiting identity validation cannot be treated as guest storage',async()=>{
  const a=device();a.state.ready=false;
  await assert.rejects(a.api.savedAccount(),/still loading/);
  assert.equal(a.storage.size,0);
});

test('saved follows appear on another device and removal survives legacy reimport',async()=>{
  const a=device(),b=device(a.server),c=device(a.server);
  await a.api.changeAppSavedItem('insights',await a.api.savedAccount(),{operation:'save',item:card('1')});
  assert.deepEqual(await b.api.loadAppSavedItems('insights',await b.api.savedAccount()),[card('1')]);
  await b.api.changeAppSavedItem('insights',await b.api.savedAccount(),{operation:'remove',key:'card:1'});
  assert.deepEqual(await c.api.loadAppSavedItems('insights',await c.api.savedAccount(),[card('1')]),[]);
});
test('offline saves and deletes persist and replay without replacing unrelated items',async()=>{
  const a=device(),b=device(a.server);a.state.offline=true;
  const account=await a.api.savedAccount();
  await a.api.changeAppSavedItem('insights',account,{operation:'save',item:card('1')});
  await a.api.changeAppSavedItem('insights',account,{operation:'save',item:card('2')});
  await a.api.changeAppSavedItem('insights',account,{operation:'remove',key:'card:1'});
  assert.match(a.api.appSavedNotice('alice','insights'),/pending/);
  await b.api.changeAppSavedItem('insights',await b.api.savedAccount(),{operation:'save',item:card('3')});
  a.state.offline=false;
  const items=await a.api.loadAppSavedItems('insights',account);
  assert.deepEqual(items.map(x=>x.cardIdentityId).sort(),['2','3']);
});
test('empty synced cache is authoritative during an outage',async()=>{
  const a=device();const account=await a.api.savedAccount();
  await a.api.loadAppSavedItems('insights',account,[card('1')]);
  await a.api.changeAppSavedItem('insights',account,{operation:'remove',key:'card:1'});
  a.state.offline=true;
  assert.deepEqual(await a.api.loadAppSavedItems('insights',account,[card('1')]),[]);
});
test('an account switch rejects an old operation before writing or sending',async()=>{
  const a=device();const old=await a.api.savedAccount();a.state.identity='bob';a.state.token='bob-token';
  await assert.rejects(a.api.changeAppSavedItem('insights',old,{operation:'save',item:card('1')}),/account changed/);
  assert.equal(a.state.requests,0);assert.equal(a.storage.size,0);
});
test('offline account caches do not leak to the next account',async()=>{
  const a=device();a.state.offline=true;
  await a.api.changeAppSavedItem('insights',await a.api.savedAccount(),{operation:'save',item:card('1')});
  a.state.identity='bob';a.state.token='bob-token';
  assert.deepEqual(await a.api.loadAppSavedItems('insights',await a.api.savedAccount()),[]);
});
test('simultaneous item changes preserve both saves',async()=>{
  const a=device();const account=await a.api.savedAccount();
  await Promise.all(['1','2'].map(id=>a.api.changeAppSavedItem('insights',account,{operation:'save',item:card(id)})));
  assert.equal((await a.api.loadAppSavedItems('insights',account)).length,2);
});
