import { API_BASE_URL } from '@/constants/api';
import type { CalendarEvent, EncounterVendor, LocalRadarResponse } from '@/types/encounter';

type RadarQuery={latitude?:number;longitude?:number;postcode?:string;radiusMiles?:number;tcg?:string;types?:Array<'shops'|'events'>;};
async function readJson<T>(response:Response):Promise<T>{if(!response.ok)throw new Error(`Fate Encounters request failed (${response.status})`);return response.json() as Promise<T>;}

export async function loadEncounters():Promise<CalendarEvent[]>{
  const params=new URLSearchParams({from:new Date().toISOString(),limit:'1000'});
  const data=await readJson<{events?:CalendarEvent[]}>(await fetch(`${API_BASE_URL}/api/encounters?${params.toString()}`));
  return Array.isArray(data.events)?data.events:[];
}
export async function loadEncounter(id:string):Promise<CalendarEvent>{
  const data=await readJson<{event?:CalendarEvent}>(await fetch(`${API_BASE_URL}/api/encounters/${encodeURIComponent(id)}`));
  if(!data.event)throw new Error('Encounter not found');return data.event;
}
export async function loadEncounterVendors(eventId:string):Promise<EncounterVendor[]>{
  const data=await readJson<{vendors?:EncounterVendor[]}>(await fetch(`${API_BASE_URL}/api/encounters/${encodeURIComponent(eventId)}/vendors`));
  return Array.isArray(data.vendors)?data.vendors:[];
}
export async function loadLocalRadar(query:RadarQuery):Promise<LocalRadarResponse>{
  const params=new URLSearchParams();if(Number.isFinite(query.latitude))params.set('lat',String(query.latitude));if(Number.isFinite(query.longitude))params.set('lng',String(query.longitude));if(query.postcode?.trim())params.set('postcode',query.postcode.trim().toUpperCase());if(Number.isFinite(query.radiusMiles))params.set('radiusMiles',String(query.radiusMiles));if(query.tcg)params.set('tcg',query.tcg);params.set('types',(query.types?.length?query.types:['shops','events']).join(','));params.set('from',new Date().toISOString());
  const data=await readJson<LocalRadarResponse>(await fetch(`${API_BASE_URL}/api/local-radar?${params.toString()}`));
  return {...data,shops:Array.isArray(data.shops)?data.shops:[],events:Array.isArray(data.events)?data.events:[]};
}
