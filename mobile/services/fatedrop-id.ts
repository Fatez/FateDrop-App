import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'fatedrop:id:session:v1';
const SNAPSHOT_KEY = 'fatedrop:id:snapshot:v1';
const DEFAULT_WEB_URL = 'https://fate-drop.com';

export type FateCapability = 'browse_network'|'selected_signals'|'retailer_discovery'|'true_price'|'advanced_fate_match'|'priority_alerts'|'advanced_filters'|'premium_discord'|'fate_lock_eligibility';
export type FateDropIdentity = { id:string; fateId:string; email:string; handle:string|null; displayName:string|null; createdAt:number };
export type FateDropEntitlement = { configuredTier:'free'|'plus'|'pro'; effectiveTier:'free'|'plus'|'pro'; status:string; active:boolean; capabilities:FateCapability[]; trialEndsAt:number|null; currentPeriodEnd:number|null; cancelAtPeriodEnd:boolean; updatedAt:number };
export type CrossPlatformWishlistItem = { id:string; userId:string; productIdentityId:string|null; query:string; title:string; tcg:string|null; imageUrl:string|null; source:string; createdAt:number; updatedAt:number };
export type CrossPlatformFateFind = Record<string, unknown> & { id:string; userId:string; enabled:boolean };
export type CrossPlatformFateMatch = { id:string; fateFindId:string; userId:string; offerId:string; productId:string; retailerId:string; retailerName:string; title:string; url:string; itemPricePence:number|null; postagePence:number|null; deliveredPricePence:number|null; rrpPence:number|null; percentAboveRrp:number|null; stockStatus:string; reasons:string[]; matchedAt:number; lastObservedAt:number };
export type CrossPlatformNotificationPreferences = { whisper:boolean; echo:boolean; manifested:boolean; vanished:boolean; priceChange:boolean; fateMatch:boolean; sealedTcg:boolean; singleCards:boolean; accessories:boolean; merchandise:boolean; unknownProducts:boolean; web:boolean; push:boolean; discord:boolean; quietHours:boolean; quietStart:string|null; quietEnd:string|null; timezone:string; updatedAt:number };
export type FateDropSyncSnapshot = { contractVersion:1; syncedAt:number; user:FateDropIdentity; entitlement:FateDropEntitlement; wishlist:CrossPlatformWishlistItem[]; fateFinds:CrossPlatformFateFind[]; fateMatches:CrossPlatformFateMatch[]; notificationPreferences:CrossPlatformNotificationPreferences; pendingMigrations:string[] };
type LoginResponse = Partial<FateDropSyncSnapshot> & { sessionToken:string; expiresAt:number; user:FateDropIdentity; entitlement:FateDropEntitlement };

function baseUrl(){ return (process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || DEFAULT_WEB_URL).replace(/\/$/,''); }
async function parseJson<T>(response:Response):Promise<T>{ const data=await response.json().catch(()=>null) as (T&{error?:string})|null; if(!response.ok) throw new Error(data?.error||`FateDrop request failed (${response.status})`); if(!data) throw new Error('FateDrop returned an empty response.'); return data; }
const defaultPreferences:CrossPlatformNotificationPreferences={ whisper:true,echo:true,manifested:true,vanished:false,priceChange:true,fateMatch:true,sealedTcg:true,singleCards:true,accessories:false,merchandise:false,unknownProducts:true,web:true,push:true,discord:false,quietHours:false,quietStart:null,quietEnd:null,timezone:'Europe/London',updatedAt:0 };

function normalizePreferences(input:Partial<CrossPlatformNotificationPreferences>|undefined):CrossPlatformNotificationPreferences{
  return {
    ...defaultPreferences,
    ...(input||{}),
    whisper:typeof input?.whisper==='boolean'?input.whisper:true,
    sealedTcg:typeof input?.sealedTcg==='boolean'?input.sealedTcg:true,
    singleCards:typeof input?.singleCards==='boolean'?input.singleCards:true,
    accessories:typeof input?.accessories==='boolean'?input.accessories:false,
    merchandise:typeof input?.merchandise==='boolean'?input.merchandise:false,
    unknownProducts:typeof input?.unknownProducts==='boolean'?input.unknownProducts:true,
  };
}
function normalizeSnapshot(snapshot:FateDropSyncSnapshot):FateDropSyncSnapshot{
  return {...snapshot,fateMatches:snapshot.fateMatches||[],notificationPreferences:normalizePreferences(snapshot.notificationPreferences)};
}

async function storeSessionToken(token:string){ await SecureStore.setItemAsync(TOKEN_KEY,token); }
export async function getStoredSessionToken(){
  const secureToken=await SecureStore.getItemAsync(TOKEN_KEY);
  if(secureToken)return secureToken;
  const legacyToken=await AsyncStorage.getItem(TOKEN_KEY);
  if(!legacyToken)return null;
  await storeSessionToken(legacyToken);
  await AsyncStorage.removeItem(TOKEN_KEY);
  return legacyToken;
}
export async function clearStoredSession(){ await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY),AsyncStorage.removeItem(TOKEN_KEY),AsyncStorage.removeItem(SNAPSHOT_KEY)]); }
export async function loadCachedIdentitySnapshot():Promise<FateDropSyncSnapshot|null>{ try{const raw=await AsyncStorage.getItem(SNAPSHOT_KEY);if(!raw)return null;const parsed=JSON.parse(raw) as FateDropSyncSnapshot;return parsed?.contractVersion===1?normalizeSnapshot(parsed):null;}catch{return null;} }
async function saveSnapshot(snapshot:FateDropSyncSnapshot){const normalized=normalizeSnapshot(snapshot);await AsyncStorage.setItem(SNAPSHOT_KEY,JSON.stringify(normalized));return normalized;}
export async function signInFateDropId(email:string,password:string){const response=await fetch(`${baseUrl()}/api/mobile/session`,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({email,password})});const result=await parseJson<LoginResponse>(response);await storeSessionToken(result.sessionToken);await AsyncStorage.removeItem(TOKEN_KEY);return saveSnapshot({contractVersion:1,syncedAt:Math.floor(Date.now()/1000),user:result.user,entitlement:result.entitlement,wishlist:result.wishlist||[],fateFinds:result.fateFinds||[],fateMatches:result.fateMatches||[],notificationPreferences:normalizePreferences(result.notificationPreferences),pendingMigrations:result.pendingMigrations||[]});}
export async function signOutFateDropId(){const token=await getStoredSessionToken();if(token)await fetch(`${baseUrl()}/api/mobile/session`,{method:'DELETE',headers:{authorization:`Bearer ${token}`,accept:'application/json'}}).catch(()=>null);await clearStoredSession();}
export async function syncFateDropId():Promise<FateDropSyncSnapshot>{const token=await getStoredSessionToken();if(!token)throw new Error('FateDrop ID sign-in required.');const response=await fetch(`${baseUrl()}/api/mobile/sync`,{headers:{authorization:`Bearer ${token}`,accept:'application/json'}});if(response.status===401){await clearStoredSession();throw new Error('Your FateDrop ID session expired. Please sign in again.');}const result=await parseJson<FateDropSyncSnapshot>(response);return saveSnapshot(normalizeSnapshot(result));}
export async function entitlementIsFresh(maxAgeSeconds=300){const snapshot=await loadCachedIdentitySnapshot();return Boolean(snapshot&&Math.floor(Date.now()/1000)-snapshot.syncedAt<=maxAgeSeconds);}
export function hasCapability(snapshot:FateDropSyncSnapshot|null,capability:FateCapability){return Boolean(snapshot?.entitlement.active&&snapshot.entitlement.capabilities.includes(capability));}
async function authenticatedFetch(path:string,init:RequestInit={}){const token=await getStoredSessionToken();if(!token)throw new Error('FateDrop ID sign-in required.');const response=await fetch(`${baseUrl()}${path}`,{...init,headers:{accept:'application/json',...(init.body?{'content-type':'application/json'}:{}),...init.headers,authorization:`Bearer ${token}`}});if(response.status===401)await clearStoredSession();return response;}
export async function saveRemoteWishlistItem(input:{productIdentityId?:string|null;query:string;title:string;tcg?:string|null;imageUrl?:string|null}){await parseJson(await authenticatedFetch('/api/wishlist',{method:'POST',body:JSON.stringify(input)}));return syncFateDropId();}
export async function removeRemoteWishlistItem(id:string){await parseJson(await authenticatedFetch('/api/wishlist',{method:'DELETE',body:JSON.stringify({id})}));return syncFateDropId();}
export async function saveRemoteFateMatch(input:Record<string,unknown>){await parseJson(await authenticatedFetch('/api/fate-matches',{method:'POST',body:JSON.stringify(input)}));return syncFateDropId();}
/** @deprecated Compatibility alias for builds that called monitoring rules FateFind. */
export const saveRemoteFateFind=saveRemoteFateMatch;
export async function updateRemoteNotificationPreferences(input:Partial<CrossPlatformNotificationPreferences>){await parseJson(await authenticatedFetch('/api/notification-preferences',{method:'PATCH',body:JSON.stringify(input)}));return syncFateDropId();}
