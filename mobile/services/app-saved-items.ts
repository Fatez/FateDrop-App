import AsyncStorage from '@react-native-async-storage/async-storage';
import { FATEDROP_WEB_URL } from '@/constants/api';
import { getStoredSessionToken, getActiveIdentitySnapshot } from '@/services/fatedrop-id';

export type SavedCollection = 'wishlist' | 'insights';
type SavedItem = Record<string, unknown>;
type Account = { identity: string; token: string | null };
type Change = {operation:'save';item:SavedItem} | {operation:'remove';key:string} | {operation:'import';items:SavedItem[]};
const notices = new Map<string, string>();
const flights = new Map<string, Promise<unknown>>();

export async function savedAccount(expectedIdentity?: string | null): Promise<Account> {
  const token = await getStoredSessionToken();
  const snapshot = token ? getActiveIdentitySnapshot(token) : null;
  if (token && !snapshot) throw new Error('Your account is still loading. Please reopen this page after sign-in completes.');
  const identity = token && snapshot?.accessAllowed ? snapshot.user.fateId : 'guest';
  if (expectedIdentity && expectedIdentity !== identity) throw new Error('Your account changed. Please reopen this page.');
  return { identity, token: identity === 'guest' ? null : token };
}
function key(account: Account, collection: SavedCollection) { return `fatedrop:app-saved:v1:${account.identity}:${collection}`; }
export function appSavedNotice(identity: string, collection: SavedCollection) {
  return notices.get(`${identity}:${collection}`) || (identity === 'guest' ? 'Saved on this device. Sign in to save across your app devices.' : '');
}
async function assertAccount(account: Account) {
  const now = await savedAccount(account.identity);
  if (now.token !== account.token) throw new Error('Your session changed. Please reopen this page.');
}
async function request(account: Account, collection: SavedCollection, body?: unknown) {
  await assertAccount(account);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),10000);
  let response: Response;
  try { response = await fetch(`${FATEDROP_WEB_URL}/api/mobile/saved-items/${collection}`, {
    signal: controller.signal,
    method: body ? 'POST' : 'GET',
    headers: { accept: 'application/json', authorization: `Bearer ${account.token}`, ...(body ? {'content-type':'application/json'} : {}) },
    ...(body ? {body: JSON.stringify(body)} : {}),
  }); } finally { clearTimeout(timeout); }
  await assertAccount(account);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error('Account saving is unavailable. Please try again before leaving this page.');
  return data;
}
async function cache(account: Account, collection: SavedCollection): Promise<SavedItem[] | null> {
  const raw = await AsyncStorage.getItem(key(account,collection));
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}
function serial<T>(account: Account, collection: SavedCollection, action: () => Promise<T>): Promise<T> {
  const id = key(account,collection);
  const result = (flights.get(id) || Promise.resolve()).catch(() => undefined).then(action);
  flights.set(id,result);
  void result.finally(() => { if (flights.get(id) === result) flights.delete(id); }).catch(() => undefined);
  return result;
}
async function readRemote(account: Account, collection: SavedCollection) {
  const result = await request(account,collection);
  if (!Array.isArray(result.items)) throw new Error('Saved items could not be read.');
  const items = result.items.filter((row: {deleted?: boolean; payload?: SavedItem}) => row.deleted === false && row.payload && typeof row.payload === 'object').map((row: {payload: SavedItem}) => row.payload);
  await assertAccount(account);
  await AsyncStorage.setItem(key(account,collection),JSON.stringify(items));
  notices.set(`${account.identity}:${collection}`,'Saved to your account. Available on your other app devices.');
  return items as SavedItem[];
}
function itemKey(collection: SavedCollection, item: SavedItem) {
  return collection === 'wishlist' ? String(item.id) : item.kind === 'card' ? `card:${item.cardIdentityId}` : `set:${item.key}`;
}
async function flushPending(account: Account, collection: SavedCollection) {
  const pendingKey = `${key(account,collection)}:pending`;
  const pending: Change[] = JSON.parse(await AsyncStorage.getItem(pendingKey)||'[]');
  for (const change of pending) await request(account,collection,change);
  await AsyncStorage.removeItem(pendingKey);
}
export async function loadAppSavedItems(collection: SavedCollection, account: Account, legacy: SavedItem[] = []) {
  return serial(account,collection,async () => {
    await assertAccount(account);
    if (!account.token) return legacy;
    try {
      const migrationKey = `${key(account,collection)}:imported`;
      if (!(await AsyncStorage.getItem(migrationKey))) {
        for (let i=0;i<legacy.length;i+=25) await request(account,collection,{operation:'import',items:legacy.slice(i,i+25)});
        await AsyncStorage.setItem(migrationKey,'1');
      }
      await flushPending(account,collection);
      return await readRemote(account,collection);
    } catch (error) {
      await assertAccount(account);
      notices.set(`${account.identity}:${collection}`,'Showing this device’s saved copy. Account sync is unavailable.');
      const cached = await cache(account,collection);
      if (cached === null) await AsyncStorage.setItem(key(account,collection),JSON.stringify(legacy));
      return cached ?? legacy;
    }
  });
}
export async function changeAppSavedItem(collection: SavedCollection, account: Account, input: Change) {
  if (!account.token) throw new Error('Sign in to save across app devices.');
  return serial(account,collection,async () => {
    await assertAccount(account);
    // Persist intent before sending so a dropped connection cannot lose the action.
    const pendingKey = `${key(account,collection)}:pending`;
    const pending: Change[] = JSON.parse(await AsyncStorage.getItem(pendingKey)||'[]');
    pending.push(input);
    await AsyncStorage.setItem(pendingKey,JSON.stringify(pending));
    const items = await cache(account,collection) || [];
    let next = items;
    if (input.operation === 'save') next = [...items.filter(item=>itemKey(collection,item)!==itemKey(collection,input.item)),input.item];
    if (input.operation === 'remove') next = items.filter(item=>itemKey(collection,item)!==input.key);
    if (input.operation === 'import') next = [...items,...input.items.filter(item=>!items.some(saved=>itemKey(collection,saved)===itemKey(collection,item)))];
    await AsyncStorage.setItem(key(account,collection),JSON.stringify(next));
    try {
      await flushPending(account,collection);
      return await readRemote(account,collection);
    } catch {
      await assertAccount(account);
      notices.set(`${account.identity}:${collection}`,'Saved on this device. Account sync is pending; reopen this section to retry.');
      return next;
    }
  });
}
