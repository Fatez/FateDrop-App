export const SAVED_EVENTS_KEY: string;
export function isSafeExternalUrl(value?: string | null): boolean;
export function formatEventDate(startValue: string, endValue: string): string;
export function loadSavedEventIds(storage: { getItem(key:string): Promise<string|null> }): Promise<string[]>;
export function saveEventIds(storage: { setItem(key:string,value:string): Promise<void> }, ids:string[]): Promise<void>;
