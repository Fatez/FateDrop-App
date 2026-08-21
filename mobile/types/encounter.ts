export type EncounterVerificationStatus='submitted'|'source_verified'|'fatedrop_verified'|string;
export type CalendarEvent={
  id:string;canonicalKey?:string|null;itemType?:'event';name:string;description?:string|null;startDateTime:string;endDateTime?:string|null;
  venueName?:string|null;address?:string|null;townCity?:string|null;postcode?:string|null;region?:string|null;latitude?:number|null;longitude?:number|null;distanceMiles?:number|null;
  ticketPriceText?:string|null;categories?:string[];supportedTcgs?:string[];imageUrl?:string|null;organiserName?:string|null;officialEventUrl?:string|null;officialTicketUrl?:string|null;
  vendorInformationUrl?:string|null;vendorApplicationsStatus?:'open'|'closed'|'unknown';featured?:boolean;verificationStatus?:EncounterVerificationStatus|null;sourceType?:string|null;sourceUrl?:string|null;lastVerifiedAt?:string|null;
};
export type LocalRadarShop={
  id:string;itemType:'shop';provider?:string|null;providerPlaceId?:string|null;name:string;address?:string|null;latitude?:number|null;longitude?:number|null;distanceMiles?:number|null;websiteUrl?:string|null;
  businessStatus?:string|null;verificationStatus?:string|null;discoveryScope?:string|null;networkStatus:'local_indie'|'fatedrop_listed'|'live_connected'|string;retailerId?:string|null;localStockStatus?:'unknown'|string;
  stockEvidence?:'none'|'online_catalogue_only'|string;onlineCatalogue?:{availableOffers:number;scope:string;}|null;sourceAttribution?:string|null;
};
export type LocalRadarResponse={success:boolean;generatedAt:string;providers?:{shops?:{provider:string;status:string};events?:{provider:string;status:string};};shops:LocalRadarShop[];events:CalendarEvent[];counts?:{shops:number;events:number};disclaimers?:string[];};

export type EncounterInventoryItem={
  id:string;eventId:string;vendorId:string;productId?:string|null;title:string;pricePence?:number|null;quantity?:number|null;
  availability:'available'|'low_stock'|'sold_out'|'unknown'|string;evidenceScope:'event_vendor_submission'|'fatedrop_event_inventory'|string;observedAt:string;expiresAt?:string|null;
};
export type EncounterVendor={
  id:string;eventId:string;retailerId?:string|null;name:string;websiteUrl?:string|null;stallLabel?:string|null;zoneLabel?:string|null;supportedTcgs?:string[];
  verificationStatus?:EncounterVerificationStatus|null;sourceType?:string|null;sourceUrl?:string|null;lastVerifiedAt?:string|null;inventoryCount?:number;inventory?:EncounterInventoryItem[];
};
