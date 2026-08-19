import * as Location from 'expo-location';
export { distanceMiles } from '@/lib/distance';
export interface UserArea{latitude?:number;longitude?:number;postcode?:string;source:'DEVICE'|'POSTCODE';}
export interface LocationAdapter{requestCurrentArea():Promise<UserArea>;fromPostcode(postcode:string):Promise<UserArea>;}
export class ExpoLocationAdapter implements LocationAdapter{async requestCurrentArea(){const permission=await Location.requestForegroundPermissionsAsync();if(permission.status!=='granted')throw new Error('LOCATION_DENIED');const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});return{latitude:position.coords.latitude,longitude:position.coords.longitude,source:'DEVICE' as const};}async fromPostcode(postcode:string){const clean=postcode.trim().toUpperCase();if(!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(clean))throw new Error('INVALID_POSTCODE');return{postcode:clean,source:'POSTCODE' as const};}}
export async function geocodeEventLocation(postcode:string){const results=await Location.geocodeAsync(postcode);const first=results[0];return first?{latitude:first.latitude,longitude:first.longitude}:undefined;}
