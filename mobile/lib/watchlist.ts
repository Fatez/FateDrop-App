import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/constants/api';
import { LocalWishlistRepository } from '@/services/wishlist';
import { savedAccount } from '@/services/app-saved-items';

export const WATCHLIST_KEY = 'fatedrop:watchlist:v1';
export const PUSH_TOKEN_KEY = 'fatedrop:expo-push-token:v1';
export async function loadWatchlist() {
  const account = await savedAccount();
  if (account.token) return (await new LocalWishlistRepository().list()).filter(item=>item.targetType==='OFFER').map(item=>item.targetId);
  const value=JSON.parse(await AsyncStorage.getItem(WATCHLIST_KEY)||'[]');
  return Array.isArray(value)?value.filter((key):key is string=>typeof key==='string'):[];
}
export async function saveWatchlist(keys:string[]) {
  const unique=[...new Set(keys)];
  const account=await savedAccount();
  if(account.token) {
    const repository=new LocalWishlistRepository();
    const current=(await repository.list()).filter(item=>item.targetType==='OFFER');
    for(const item of current.filter(item=>!unique.includes(item.targetId))) await repository.remove(item.id);
    for(const id of unique.filter(id=>!current.some(item=>item.targetId===id))) await repository.save({id:'offer:'+id,targetType:'OFFER',targetId:id,alertsEnabled:false,createdAt:new Date().toISOString()});
  } else await AsyncStorage.setItem(WATCHLIST_KEY,JSON.stringify(unique));
  return unique;
}
export async function toggleWatchlist(key:string,current:string[]) {
  const account=await savedAccount();
  if(!account.token) return saveWatchlist(current.includes(key)?current.filter(item=>item!==key):[...current,key]);
  const repository=new LocalWishlistRepository();
  if(current.includes(key)) await repository.remove('offer:'+key);
  else await repository.save({id:'offer:'+key,targetType:'OFFER',targetId:key,alertsEnabled:false,createdAt:new Date().toISOString()});
  return (await repository.list()).filter(item=>item.targetType==='OFFER').map(item=>item.targetId);
}
export async function syncWatchlist(keys?:string[]) {
  const token=await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if(!token)return false;
  const productKeys=keys??await loadWatchlist();
  const response=await fetch(`${API_BASE_URL}/api/push/watchlist`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,productKeys})});
  return response.ok;
}
