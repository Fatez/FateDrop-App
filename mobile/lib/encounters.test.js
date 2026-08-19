const test=require('node:test');const assert=require('node:assert/strict');const{formatEventDate,isSafeExternalUrl,loadSavedEventIds,saveEventIds}=require('./encounters');
test('formats multi-day events in UK form',()=>assert.match(formatEventDate('2027-01-31T10:00:00Z','2027-02-01T17:00:00Z'),/31 Jan 2027.*1 Feb 2027/));
test('invalid dates fall back safely',()=>assert.equal(formatEventDate('bad','bad'),'Date to be confirmed'));
test('URL validation only allows HTTP(S)',()=>{assert.equal(isSafeExternalUrl('https://example.com'),true);assert.equal(isSafeExternalUrl('javascript:alert(1)'),false);assert.equal(isSafeExternalUrl(undefined),false)});
test('saved IDs persist and malformed storage is safe',async()=>{let value='{bad';const storage={getItem:async()=>value,setItem:async(k,v)=>{value=v}};assert.deepEqual(await loadSavedEventIds(storage),[]);await saveEventIds(storage,['a','a','b']);assert.deepEqual(await loadSavedEventIds(storage),['a','b'])});
