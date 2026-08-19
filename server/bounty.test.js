const test=require('node:test');const assert=require('node:assert/strict');const{publicBounty,bountyMatches,canRespond}=require('./bounty');
const request={id:'b',status:'ACTIVE',description:'Mewtwo',form:'RAW',maximumDeliveredPriceGbp:20,fulfilment:'EITHER',includePreorders:false,expiresAt:'2099-01-01T00:00:00Z',collectorName:'Private',email:'private@example.com',region:'South East'};
test('privacy transform excludes collector identity',()=>{const value=publicBounty(request);assert.equal(value.collectorName,undefined);assert.equal(value.email,undefined);});
test('matching requires known capped delivered price',()=>{assert.equal(bountyMatches(request,{priceGbp:15,shippingGbp:4,condition:'NEW'}),true);assert.equal(bountyMatches(request,{priceGbp:15,condition:'NEW'}),false);});
test('duplicate active retailer responses are rejected',()=>assert.equal(canRespond([{productRequestId:'b',retailerId:'r',offerId:'o',status:'ACTIVE'}],'b','r','o'),false));
