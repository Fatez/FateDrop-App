const test=require('node:test');const assert=require('node:assert/strict');const{aggregateDemand}=require('./demand-signal');
const event=(user,day='01')=>({anonymousUserId:user,type:'SEARCH',productKey:'mew',label:'Mew',region:'South East',createdAt:`2026-08-${day}T12:00:00Z`});
test('deduplicates repeated daily actions and aggregates users',()=>{const result=aggregateDemand([event('a'),event('a'),event('b')],{minimumCohort:2,isDemo:true});assert.equal(result[0].uniqueUsers,2);assert.equal(result[0].signalCount,2);assert.equal(result[0].dataState,'DEMO');});
test('suppresses small cohorts without exposing counts',()=>{const result=aggregateDemand([event('a')],{minimumCohort:5});assert.equal(result[0].dataState,'INSUFFICIENT');assert.equal(result[0].signalCount,0);});
