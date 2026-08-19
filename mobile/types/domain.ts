export type EntityId = string;
export type ISODateTime = string;
export type GBP = number;

export type ProductCategory = 'SEALED' | 'SINGLE' | 'GRADED' | 'ACCESSORY' | 'PREORDER' | 'OTHER';
export type ProductCondition = 'NEW' | 'NEAR_MINT' | 'LIGHTLY_PLAYED' | 'MODERATELY_PLAYED' | 'HEAVILY_PLAYED' | 'DAMAGED' | 'GRADED' | 'UNKNOWN';
export type StockStatus = 'IN_STOCK' | 'OUT_OF_STOCK' | 'PREORDER' | 'BACKORDER' | 'UNKNOWN';
export type RetailerPlan = 'FREE' | 'INDIE' | 'INDIE_PRO';

export interface RetailerLocation { id: EntityId; retailerId: EntityId; name: string; addressLine1?: string; addressLine2?: string; townCity?: string; postcode?: string; region?: string; countryCode: 'GB'; latitude?: number; longitude?: number; openingHours?: Record<string, string>; collectionAvailable: boolean; }
export interface RetailerVerification { status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'SUSPENDED'; verifiedAt?: ISODateTime; lastReviewedAt?: ISODateTime; evidence?: string[]; genuineProductCommitment?: boolean; }
export interface RetailerMetrics { storefrontViews?: number; productImpressions?: number; productDetailViews?: number; outboundClicks?: number; wishlistSaves?: number; fateFindMatches?: number; eventPageEngagement?: number; measuredFrom?: ISODateTime; measuredTo?: ISODateTime; isDemo: boolean; }
export interface Retailer { id: EntityId; name: string; slug: string; description?: string; websiteUrl: string; logoUrl?: string; bannerUrl?: string; onlineOnly: boolean; sponsored: boolean; isDemo?: boolean; plan: RetailerPlan; verification: RetailerVerification; locations: RetailerLocation[]; deliveryInformation?: string; freeShippingThresholdGbp?: GBP; fateScore?: FateScore; metrics?: RetailerMetrics; }
export interface FateScore { status: 'NOT_ENOUGH_DATA' | 'AVAILABLE'; score?: number; dispatchBand?: string; preorderReliabilityBand?: string; cancellationRateBand?: string; customerServiceBand?: string; evidenceUpdatedAt?: ISODateTime; }

export interface ProductSet { id?: EntityId; name: string; code?: string; releaseDate?: string; }
export interface Product { id: EntityId; title: string; normalisedTitle: string; category: ProductCategory; set?: ProductSet; cardNumber?: string; barcode?: string; imageUrl?: string; description?: string; }
export interface ShippingOption { id: EntityId; name: string; priceGbp?: GBP; freeAboveGbp?: GBP; estimatedDaysMin?: number; estimatedDaysMax?: number; collection: boolean; }
export interface PriceHistoryEntry { priceGbp: GBP; shippingGbp?: GBP; recordedAt: ISODateTime; stockStatus: StockStatus; }
export interface ProductOffer { id: EntityId; canonicalProductId?: EntityId; retailerId: EntityId; retailerSku: string; title: string; category: ProductCategory; condition: ProductCondition; priceGbp?: GBP; stockStatus: StockStatus; preorder: boolean; collectionAvailable: boolean; productUrl?: string; imageUrl?: string; setName?: string; cardNumber?: string; gradingCompany?: string; grade?: string; barcode?: string; shippingOptions: ShippingOption[]; priceHistory: PriceHistoryEntry[]; lastCheckedAt: ISODateTime; isCurrentlyListed: boolean; matchingConfidence?: number; pulseLabels?: string[]; }

export interface WishlistItem { id: EntityId; targetType: 'OFFER' | 'PRODUCT' | 'FATE_FIND'; targetId: EntityId; label?: string; condition?: ProductCondition; alertsEnabled: boolean; createdAt: ISODateTime; migratedFromLegacyKey?: string; }
export interface SavedSearch { id: EntityId; name: string; query?: string; canonicalProductId?: EntityId; maximumItemPriceGbp?: GBP; maximumDeliveredPriceGbp?: GBP; preferredRetailerIds: EntityId[]; ukOnly: boolean; maximumDistanceMiles?: number; condition?: ProductCondition; category?: ProductCategory; includePreorders: boolean; collectionOnly: boolean; inStockOnly: boolean; notificationsEnabled: boolean; frequency: 'IMMEDIATE' | 'DAILY' | 'WEEKLY'; createdAt: ISODateTime; updatedAt: ISODateTime; }
export interface AlertMatch { id: EntityId; savedSearchId: EntityId; offerId: EntityId; source: 'LOCAL' | 'BACKEND'; matchedAt: ISODateTime; fingerprint: string; }

export interface Event { id: EntityId; name: string; description?: string; startDateTime: ISODateTime; endDateTime?: ISODateTime; venueName?: string; address?: string; townCity?: string; postcode?: string; organiserName?: string; ticketUrl?: string; imageUrl?: string; eventType: string; vendors: EventVendor[]; }
export interface EventVendor { id: EntityId; eventId: EntityId; retailerId: EntityId; stallIdentifier?: string; inventory: VendorInventoryItem[]; }
export interface VendorInventoryItem { id: EntityId; eventVendorId: EntityId; productId?: EntityId; title: string; priceGbp?: GBP; condition: ProductCondition; stockStatus: StockStatus; archivedAt?: ISODateTime; }
export interface Reservation { id: EntityId; offerId: EntityId; locationId: EntityId; status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'; requestedAt: ISODateTime; expiresAt?: ISODateTime; }
export interface OutboundClick { id: EntityId; retailerId: EntityId; offerId?: EntityId; placement: string; anonymousSessionId: string; destinationUrl: string; createdAt: ISODateTime; }
export interface CatalogueImport { id: EntityId; retailerId: EntityId; adapter: 'CSV' | 'SHOPIFY' | 'WOOCOMMERCE' | 'GENERIC_FEED'; status: 'PENDING' | 'VALIDATING' | 'READY' | 'IMPORTED' | 'FAILED'; sourceFingerprint?: string; additions: number; updates: number; skipped: number; errors: ImportValidationError[]; createdAt: ISODateTime; }
export interface ImportValidationError { row: number; field?: string; code: string; message: string; value?: string; }

export type FulfilmentPreference = 'DELIVERY' | 'COLLECTION' | 'EITHER';
export interface BasketConstraint { acceptableConditions: ProductCondition[]; fulfilment: FulfilmentPreference; excludeRetailerIds: EntityId[]; verifiedRetailersOnly: boolean; allowSplit: boolean; maximumRetailers: number; includePreorders: boolean; }
export interface ShoppingListItem { id: EntityId; canonicalProductId: EntityId; label: string; quantity: number; acceptableConditions: ProductCondition[]; form: 'RAW'|'GRADED'|'SEALED'|'ANY'; maximumUnitPriceGbp?: GBP; includePreorders?: boolean; }
export interface ShoppingList { id: EntityId; name: string; items: ShoppingListItem[]; constraints: BasketConstraint; createdAt: ISODateTime; updatedAt: ISODateTime; schemaVersion: 1; }
export interface BasketAllocation { retailerId: EntityId; offerId: EntityId; shoppingListItemId: EntityId; quantity: number; unitPriceGbp: GBP; productUrl?: string; }
export interface BasketRetailerTotal { retailerId: EntityId; allocations: BasketAllocation[]; itemSubtotalGbp: GBP; shippingGbp?: GBP; freeShippingThresholdGbp?: GBP; thresholdProgressGbp?: GBP; collection: boolean; }
export interface BasketSolution { id: EntityId; strategy: 'LOWEST_SUBTOTAL'|'LOWEST_DELIVERED'|'FEWEST_RETAILERS'|'COLLECTION_FOCUSED'|'BALANCED'; retailers: BasketRetailerTotal[]; itemSubtotalGbp: GBP; shippingGbp?: GBP; deliveredTotalGbp?: GBP; missingItemIds: EntityId[]; warnings: string[]; certainty: 'COMPLETE'|'MATERIAL_SHIPPING_UNKNOWN'|'PARTIAL'; alternativeSavingGbp?: GBP; }

export type BountyStatus='DRAFT'|'ACTIVE'|'MATCHED'|'FULFILLED'|'EXPIRED'|'CANCELLED';
export interface ProductRequest { id:EntityId; canonicalProductId?:EntityId; description:string; form:'RAW'|'GRADED'|'SEALED'|'ANY'; setName?:string; cardNumber?:string; condition?:ProductCondition; gradingCompany?:string; minimumGrade?:string; exactGrade?:string; maximumItemPriceGbp?:GBP; maximumDeliveredPriceGbp?:GBP; ukSellerOnly:boolean; maximumDistanceMiles?:number; region?:string; fulfilment:FulfilmentPreference; includePreorders:boolean; expiresAt:ISODateTime; notes?:string; status:BountyStatus; createdAt:ISODateTime; }
export interface BountyResponse { id:EntityId; productRequestId:EntityId; retailerId:EntityId; offerId?:EntityId; proposedTitle?:string; itemPriceGbp:GBP; shippingGbp?:GBP; condition:ProductCondition; expiresAt:ISODateTime; status:'ACTIVE'|'ACCEPTED'|'DISMISSED'|'EXPIRED'; stockConfirmation:'LIVE_OFFER'|'RETAILER_PROPOSED'; createdAt:ISODateTime; }
export interface DemandAggregate { key:string; label:string; signalType:'SEARCH'|'WISHLIST'|'FATE_FIND'|'FATE_BOUNTY'|'OUTBOUND_CLICK'|'RELEASE_INTEREST'; uniqueUsers:number; signalCount:number; region?:string; periodStart:ISODateTime; periodEnd:ISODateTime; dataState:'REAL'|'DEMO'|'INSUFFICIENT'; }
export interface DemandTrend { key:string; current:DemandAggregate; previousCount?:number; changePercent?:number; confidence:'LOW'|'MEDIUM'|'HIGH'|'INSUFFICIENT'; }
export type CommercialAnalyticsEventName='shopping_list_created'|'basket_calculated'|'basket_retailer_selected'|'bounty_created'|'bounty_matched'|'bounty_response_opened';
export interface CommercialAnalyticsEvent { name:CommercialAnalyticsEventName; anonymousSessionId:string; createdAt:ISODateTime; productId?:EntityId; retailerId?:EntityId; source:'REAL'|'DEMO'; }
