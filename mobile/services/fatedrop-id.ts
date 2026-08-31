import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { FATEDROP_WEB_URL } from '@/constants/api';
import {
  DEFAULT_LIFECYCLE_MARKETS,
  normalizeLifecycleMarkets,
  type LifecycleMarketPreferences,
} from '@/services/notification-preference-contract';

const TOKEN_KEY = 'fatedrop.id.session.v1';
const LEGACY_TOKEN_KEY = 'fatedrop:id:session:v1';
const SNAPSHOT_KEY = 'fatedrop:id:snapshot:v1';

export type FateCapability = 'browse_network'|'selected_signals'|'retailer_discovery'|'true_price'|'advanced_fate_match'|'priority_alerts'|'advanced_filters'|'premium_discord'|'fate_lock_eligibility';
export type FateFindCompanionId = 'koru'|'fenn'|'oru'|'nyxen';
export type BetaAccessStatus = 'pending'|'approved'|'revoked';
export type FateDropBetaAccess = { status:BetaAccessStatus; approved:boolean; requestedAt:number|null; approvedAt:number|null; approvedBy:string|null; updatedAt:number|null };
export type FateDropIdentity = { id:string; fateId:string; email:string; handle:string|null; displayName:string|null; createdAt:number };
export type FateDropEntitlement = { configuredTier:'free'|'plus'|'pro'; effectiveTier:'free'|'plus'|'pro'; status:string; active:boolean; capabilities:FateCapability[]; trialEndsAt:number|null; currentPeriodEnd:number|null; cancelAtPeriodEnd:boolean; updatedAt:number };
export type CrossPlatformWishlistItem = { id:string; userId:string; productIdentityId:string|null; query:string; title:string; tcg:string|null; imageUrl:string|null; source:string; createdAt:number; updatedAt:number };
export type CrossPlatformFateFind = Record<string, unknown> & { id:string; userId:string; enabled:boolean };
export type CrossPlatformFateMatch = { id:string; fateFindId:string; userId:string; offerId:string; productId:string; retailerId:string; retailerName:string; title:string; url:string; itemPricePence:number|null; postagePence:number|null; deliveredPricePence:number|null; rrpPence:number|null; percentAboveRrp:number|null; stockStatus:string; reasons:string[]; companionId:FateFindCompanionId; matchedAt:number; lastObservedAt:number };
export type CrossPlatformNotificationPreferences = {
  whisper:boolean;
  echo:boolean;
  manifested:boolean;
  vanished:boolean;
  priceChange:boolean;
  fateMatch:boolean;
  sealedTcg:boolean;
  singleCards:boolean;
  accessories:boolean;
  merchandise:boolean;
  unknownProducts:boolean;
  english:boolean;
  japanese:boolean;
  korean:boolean;
  simplifiedChinese:boolean;
  traditionalChinese:boolean;
  otherLanguages:boolean;
  unknownLanguage:boolean;
  lifecycleMarkets:LifecycleMarketPreferences;
  allSets:boolean;
  selectedSetKeys:string[];
  unknownSets:boolean;
  web:boolean;
  push:boolean;
  discord:boolean;
  quietHours:boolean;
  quietStart:string|null;
  quietEnd:string|null;
  timezone:string;
  updatedAt:number;
};
export type FateDropSyncSnapshot = { contractVersion:2; accessAllowed:boolean; betaAccess:FateDropBetaAccess; syncedAt:number; user:FateDropIdentity; entitlement:FateDropEntitlement; wishlist:CrossPlatformWishlistItem[]; fateFinds:CrossPlatformFateFind[]; fateMatches:CrossPlatformFateMatch[]; notificationPreferences:CrossPlatformNotificationPreferences; pendingMigrations:string[] };
type SessionResponse = { contractVersion:number; accessAllowed:boolean; betaAccess:FateDropBetaAccess; sessionToken?:string; expiresAt?:number; user:FateDropIdentity; entitlement?:FateDropEntitlement; membership?:FateDropEntitlement };

function baseUrl(){ return FATEDROP_WEB_URL; }
async function parseJson<T>(response:Response):Promise<T>{ const data=await response.json().catch(()=>null) as (T&{error?:string;code?:string})|null; if(!response.ok) throw new Error(data?.error||`FateDrop request failed (${response.status})`); if(!data) throw new Error('FateDrop returned an empty response.'); return data; }
const defaultPreferences:CrossPlatformNotificationPreferences={
  whisper:true,echo:true,manifested:true,vanished:true,priceChange:true,fateMatch:true,
  sealedTcg:true,singleCards:true,accessories:false,merchandise:false,unknownProducts:true,
  english:true,japanese:true,korean:true,simplifiedChinese:true,traditionalChinese:true,otherLanguages:true,unknownLanguage:true,
  lifecycleMarkets:DEFAULT_LIFECYCLE_MARKETS,
  allSets:true,selectedSetKeys:[],unknownSets:true,
  web:true,push:true,discord:false,quietHours:false,quietStart:null,quietEnd:null,timezone:'Europe/London',updatedAt:0,
};
const fallbackEntitlement:FateDropEntitlement={ configuredTier:'free',effectiveTier:'free',status:'free',active:false,capabilities:[],trialEndsAt:null,currentPeriodEnd:null,cancelAtPeriodEnd:false,updatedAt:0 };
const fallbackBetaAccess:FateDropBetaAccess={status:'pending',approved:false,requestedAt:null,approvedAt:null,approvedBy:null,updatedAt:null};

function isCompanionId(value:unknown):value is FateFindCompanionId{return value==='koru'||value==='fenn'||value==='oru'||value==='nyxen';}
function lifecyclePreference(value:unknown){return typeof value==='boolean'?value:true;}
function booleanPreference(value:unknown,fallback:boolean){return typeof value==='boolean'?value:fallback;}
const setKeyPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function normalizeSelectedSetKeys(value:unknown){
  if(!Array.isArray(value))return [];
  return [...new Set(value
    .filter((item):item is string=>typeof item==='string')
    .map((item)=>item.trim().toLowerCase())
    .filter((item)=>item.length<=120&&setKeyPattern.test(item)))]
    .slice(0,200);
}
function normalizePreferences(input:Partial<CrossPlatformNotificationPreferences>|undefined):CrossPlatformNotificationPreferences{
  return {
    ...defaultPreferences,
    ...(input||{}),
    whisper:lifecyclePreference(input?.whisper),
    echo:lifecyclePreference(input?.echo),
    manifested:lifecyclePreference(input?.manifested),
    vanished:lifecyclePreference(input?.vanished),
    sealedTcg:booleanPreference(input?.sealedTcg,defaultPreferences.sealedTcg),
    singleCards:booleanPreference(input?.singleCards,defaultPreferences.singleCards),
    accessories:booleanPreference(input?.accessories,defaultPreferences.accessories),
    merchandise:booleanPreference(input?.merchandise,defaultPreferences.merchandise),
    unknownProducts:booleanPreference(input?.unknownProducts,defaultPreferences.unknownProducts),
    english:booleanPreference(input?.english,defaultPreferences.english),
    japanese:booleanPreference(input?.japanese,defaultPreferences.japanese),
    korean:booleanPreference(input?.korean,defaultPreferences.korean),
    simplifiedChinese:booleanPreference(input?.simplifiedChinese,defaultPreferences.simplifiedChinese),
    traditionalChinese:booleanPreference(input?.traditionalChinese,defaultPreferences.traditionalChinese),
    otherLanguages:booleanPreference(input?.otherLanguages,defaultPreferences.otherLanguages),
    unknownLanguage:booleanPreference(input?.unknownLanguage,defaultPreferences.unknownLanguage),
    lifecycleMarkets:normalizeLifecycleMarkets(input?.lifecycleMarkets),
    allSets:booleanPreference(input?.allSets,defaultPreferences.allSets),
    selectedSetKeys:normalizeSelectedSetKeys(input?.selectedSetKeys),
    unknownSets:booleanPreference(input?.unknownSets,defaultPreferences.unknownSets),
  };
}
function normalizeEntitlement(input:FateDropEntitlement|undefined):FateDropEntitlement{return input||fallbackEntitlement;}
function normalizeBetaAccess(input:FateDropBetaAccess|undefined):FateDropBetaAccess{
  if(!input||!['pending','approved','revoked'].includes(input.status))return fallbackBetaAccess;
  return {...input,approved:input.status==='approved'&&input.approved===true};
}
function normalizeSnapshot(snapshot:FateDropSyncSnapshot):FateDropSyncSnapshot{
  const betaAccess=normalizeBetaAccess(snapshot.betaAccess);
  const accessAllowed=snapshot.accessAllowed===true&&betaAccess.approved;
  const entitlement=normalizeEntitlement(snapshot.entitlement);
  return {
    ...snapshot,
    contractVersion:2,
    accessAllowed,
    betaAccess,
    entitlement:accessAllowed?entitlement:{...entitlement,capabilities:[]},
    fateMatches:(snapshot.fateMatches||[]).map((match)=>({...match,companionId:isCompanionId(match.companionId)?match.companionId:'koru'})),
    notificationPreferences:normalizePreferences(snapshot.notificationPreferences),
  };
}
function snapshotFromSession(result:SessionResponse):FateDropSyncSnapshot{
  const betaAccess=normalizeBetaAccess(result.betaAccess);
  const accessAllowed=result.accessAllowed===true&&betaAccess.approved;
  const entitlement=normalizeEntitlement(result.entitlement||result.membership);
  return normalizeSnapshot({
    contractVersion:2,
    accessAllowed,
    betaAccess,
    syncedAt:Math.floor(Date.now()/1000),
    user:result.user,
    entitlement:accessAllowed?entitlement:{...entitlement,capabilities:[]},
    wishlist:[],fateFinds:[],fateMatches:[],notificationPreferences:defaultPreferences,pendingMigrations:[],
  });
}

async function storeSessionToken(token:string){ await SecureStore.setItemAsync(TOKEN_KEY,token); }
export async function getStoredSessionToken(){
  const secureToken=await SecureStore.getItemAsync(TOKEN_KEY);
  if(secureToken)return secureToken;
  const legacyToken=await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
  if(!legacyToken)return null;
  await storeSessionToken(legacyToken);
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
  return legacyToken;
}
export async function clearStoredSession(){ await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY),AsyncStorage.removeItem(TOKEN_KEY),AsyncStorage.removeItem(LEGACY_TOKEN_KEY),AsyncStorage.removeItem(SNAPSHOT_KEY)]); }

export async function loadCachedIdentitySnapshot():Promise<FateDropSyncSnapshot|null>{await AsyncStorage.removeItem(SNAPSHOT_KEY).catch(()=>null);return null;}
async function saveSnapshot(snapshot:FateDropSyncSnapshot){return normalizeSnapshot(snapshot);}

async function fetchSessionState(token:string){
  const response=await fetch(`${baseUrl()}/api/mobile/session`,{headers:{authorization:`Bearer ${token}`,accept:'application/json'}});
  if(response.status===401){await clearStoredSession();throw new Error('Your FateDrop ID session expired. Please sign in again.');}
  return parseJson<SessionResponse>(response);
}

export async function signInFateDropId(email:string,password:string){
  const response=await fetch(`${baseUrl()}/api/mobile/session`,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({email,password})});
  const result=await parseJson<SessionResponse>(response);
  if(!result.sessionToken)throw new Error('FateDrop sign-in response is missing the session token.');
  await storeSessionToken(result.sessionToken);
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
  return saveSnapshot(snapshotFromSession(result));
}
export async function signOutFateDropId(){
  const token=await getStoredSessionToken();
  if(!token){await clearStoredSession();return;}
  let response:Response;
  try{response=await fetch(`${baseUrl()}/api/mobile/session`,{method:'DELETE',headers:{authorization:`Bearer ${token}`,accept:'application/json'}});}catch{throw new Error('FateDrop could not securely sign you out. Please try again when you are connected.');}
  if(!response.ok)throw new Error('FateDrop could not securely sign you out. Please try again.');
  await clearStoredSession();
}
export async function syncFateDropId():Promise<FateDropSyncSnapshot>{
  const token=await getStoredSessionToken();
  if(!token)throw new Error('FateDrop ID sign-in required.');
  const session=await fetchSessionState(token);
  if(session.accessAllowed!==true||session.betaAccess?.approved!==true)return saveSnapshot(snapshotFromSession(session));
  const response=await fetch(`${baseUrl()}/api/mobile/sync`,{headers:{authorization:`Bearer ${token}`,accept:'application/json'}});
  if(response.status===401){await clearStoredSession();throw new Error('Your FateDrop ID session expired. Please sign in again.');}
  if(response.status===403){return saveSnapshot(snapshotFromSession(await fetchSessionState(token)));}
  const result=await parseJson<FateDropSyncSnapshot>(response);
  return saveSnapshot(normalizeSnapshot(result));
}
export async function entitlementIsFresh(maxAgeSeconds=300){const snapshot=await loadCachedIdentitySnapshot();return Boolean(snapshot&&Math.floor(Date.now()/1000)-snapshot.syncedAt<=maxAgeSeconds);}
export function hasCapability(snapshot:FateDropSyncSnapshot|null,capability:FateCapability){return Boolean(snapshot?.accessAllowed&&snapshot.betaAccess?.approved&&snapshot.entitlement?.active&&snapshot.entitlement.capabilities.includes(capability));}
async function authenticatedFetch(path:string,init:RequestInit={}){const token=await getStoredSessionToken();if(!token)throw new Error('FateDrop ID sign-in required.');const response=await fetch(`${baseUrl()}${path}`,{...init,headers:{accept:'application/json',...(init.body?{'content-type':'application/json'}:{}),...init.headers,authorization:`Bearer ${token}`}});if(response.status===401)await clearStoredSession();return response;}
export async function saveRemoteWishlistItem(input:{productIdentityId?:string|null;query:string;title:string;tcg?:string|null;imageUrl?:string|null}){await parseJson(await authenticatedFetch('/api/wishlist',{method:'POST',body:JSON.stringify(input)}));return syncFateDropId();}
export async function removeRemoteWishlistItem(id:string){await parseJson(await authenticatedFetch('/api/wishlist',{method:'DELETE',body:JSON.stringify({id})}));return syncFateDropId();}
export async function saveRemoteFateFind(input:Record<string,unknown>){await parseJson(await authenticatedFetch('/api/fate-matches',{method:'POST',body:JSON.stringify(input)}));return syncFateDropId();}
export type CrossPlatformNotificationPreferenceUpdate = Omit<Partial<CrossPlatformNotificationPreferences>, 'lifecycleMarkets'> & {
  lifecycleMarkets?: Partial<LifecycleMarketPreferences>;
};
export async function updateRemoteNotificationPreferences(input:CrossPlatformNotificationPreferenceUpdate){await parseJson(await authenticatedFetch('/api/notification-preferences',{method:'PATCH',body:JSON.stringify(input)}));return syncFateDropId();}
