import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/constants/api';

export const WATCHLIST_KEY = 'fatedrop:watchlist:v1';
export const PUSH_TOKEN_KEY = 'fatedrop:expo-push-token:v1';

export async function loadWatchlist() {
  try { const value=JSON.parse((await AsyncStorage.getItem(WATCHLIST_KEY))||'[]'); return Array.isArray(value)?value.filter((key):key is string=>typeof key==='string'):[]; } catch { return []; }
}
export async function saveWatchlist(keys:string[]) {
  const unique=[...new Set(keys)];
  await AsyncStorage.setItem(WATCHLIST_KEY,JSON.stringify(unique));
  await syncWatchlist(unique);
  return unique;
}
export async function toggleWatchlist(key:string,current:string[]) {
  return saveWatchlist(current.includes(key)?current.filter(item=>item!==key):[...current,key]);
}
export async function syncWatchlist(keys?:string[]) {
  const token=await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if(!token)return false;
  const productKeys=keys??await loadWatchlist();
  const response=await fetch(`${API_BASE_URL}/api/push/watchlist`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,productKeys})});
  return response.ok;
}
