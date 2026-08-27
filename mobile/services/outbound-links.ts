import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

import { API_BASE_URL } from '@/constants/api';
import { safeExternalHttpsUrl } from '@/lib/external-url-security';

const SESSION_KEY='fatedrop:anonymous-session:v1';
async function sessionId(){let value=await AsyncStorage.getItem(SESSION_KEY);if(!value){value=`fd-${Date.now()}-${Math.random().toString(36).slice(2)}`;await AsyncStorage.setItem(SESSION_KEY,value);}return value;}
export async function openTrackedRetailerLink(input:{destinationUrl:string;retailerId:string;offerId?:string;placement:string}){
  const destinationUrl=safeExternalHttpsUrl(input.destinationUrl);if(!destinationUrl)throw new Error('Only secure retailer links are supported.');
  const payload={...input,destinationUrl,anonymousSessionId:await sessionId(),createdAt:new Date().toISOString()};
  void fetch(`${API_BASE_URL}/api/outbound-clicks`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}).catch(()=>undefined);
  await WebBrowser.openBrowserAsync(destinationUrl);
}
