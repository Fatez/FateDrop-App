import { SIGNAL_ENGINE_URL } from '@/constants/api';
import type { Product, ProductCategory, ProductOffer, StockStatus } from '@/types/domain';
import type { CatalogueApiResponse, LegacyCatalogueProduct } from '@/types/legacy';

export interface CataloguePage { offers: ProductOffer[]; products: Product[]; total: number; nextCursor?: string; fetchedAt: string; }
export interface CatalogueQuery { cursor?: string; limit?: number; retailerId?: string; excludedRetailerIds?: string[]; query?: string; inStockOnly?: boolean; category?: ProductCategory; condition?:string;setName?:string;minimumPriceGbp?:number;maximumPriceGbp?:number;sort?:'title'|'price'|'newest'|'popularity'|'distance'; }
export interface CatalogueRepository { list(query?: CatalogueQuery): Promise<CataloguePage>; getOffer(id: string): Promise<ProductOffer | null>; }

const titleKey=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const categoryOf=(title:string):ProductCategory=>/graded|psa|cgc|bgs\s*\d/i.test(title)?'GRADED':/#\d+|single|near mint|lightly played/i.test(title)?'SINGLE':/sleeve|binder|deck box|playmat|accessor/i.test(title)?'ACCESSORY':/pre[ -]?order/i.test(title)?'PREORDER':/booster|elite trainer|collection|tin|box|pack|bundle|deck/i.test(title)?'SEALED':'OTHER';
const stockOf=(value?:string,listed=true):StockStatus=>!listed?'OUT_OF_STOCK':value==='IN_STOCK'?'IN_STOCK':value==='OUT_OF_STOCK'?'OUT_OF_STOCK':value==='PREORDER'?'PREORDER':'UNKNOWN';
export const legacyOfferKey=(item:LegacyCatalogueProduct)=>`${item.retailerKey||'pokemon-center-uk'}:${item.sku??item.id}`;

export function adaptLegacyOffer(item:LegacyCatalogueProduct):ProductOffer {
  const title=item.title?.trim()||'Unknown product', id=legacyOfferKey(item), category=categoryOf(title), lastCheckedAt=item.lastSeen||new Date(0).toISOString();
  return { id, canonicalProductId:item.productId, retailerId:item.retailerKey||'pokemon-center-uk', retailerSku:String(item.sku??item.id??id), title, category, condition:(item.condition as ProductOffer['condition'])||(category==='SINGLE'?'UNKNOWN':'NEW'), priceGbp:typeof item.price==='number'?item.price:undefined, stockStatus:stockOf(item.availability,item.isCurrentlyListed!==false), preorder:category==='PREORDER', collectionAvailable:item.collectionAvailable===true, productUrl:typeof item.url==='string'&&/^https:\/\//i.test(item.url)?item.url:undefined, imageUrl:typeof item.image==='string'&&/^https:\/\//i.test(item.image)?item.image:undefined,setName:item.setName||undefined,cardNumber:item.cardNumber||undefined,shippingOptions:item.shippingGbp===null||item.shippingGbp===undefined?[]:[{id:`${id}:shipping`,name:'Standard delivery',priceGbp:item.shippingGbp,collection:false}], priceHistory:[], lastCheckedAt, isCurrentlyListed:item.isCurrentlyListed!==false, pulseLabels:item.pulseLabels };
}
export function conservativeCanonicalProduct(offer:ProductOffer):Product { const normalisedTitle=titleKey(offer.title); return { id:offer.canonicalProductId||`legacy:${offer.category}:${normalisedTitle}`, title:offer.title, normalisedTitle, category:offer.category, imageUrl:offer.imageUrl }; }

export class ApiCatalogueRepository implements CatalogueRepository {
  async list(query:CatalogueQuery={}):Promise<CataloguePage>{
    const params=new URLSearchParams();params.set('limit',String(query.limit||50));
    if(query.cursor)params.set('cursor',query.cursor);if(query.retailerId)params.set('retailer',query.retailerId);if(query.excludedRetailerIds?.length)params.set('excludeRetailers',query.excludedRetailerIds.join(','));if(query.query)params.set('q',query.query);if(query.inStockOnly)params.set('inStock','true');if(query.category)params.set('category',query.category);if(query.condition)params.set('condition',query.condition);if(query.setName)params.set('set',query.setName);if(query.minimumPriceGbp!==undefined)params.set('minPrice',String(query.minimumPriceGbp));if(query.maximumPriceGbp!==undefined)params.set('maxPrice',String(query.maximumPriceGbp));if(query.sort)params.set('sort',query.sort);
    const response=await fetch(`${SIGNAL_ENGINE_URL}/api/catalogue?${params}`);if(!response.ok)throw new Error(`Catalogue request failed with HTTP ${response.status}`);const data=await response.json() as CatalogueApiResponse;const offers=(Array.isArray(data.products)?data.products:Object.values(data.products||{})).map(adaptLegacyOffer);return{offers,products:offers.map(conservativeCanonicalProduct),total:data.total,nextCursor:data.nextCursor||undefined,fetchedAt:data.updatedAt||new Date().toISOString()};
  }
  async getOffer(id:string){const separator=id.indexOf(':'),retailerId=separator>0?id.slice(0,separator):undefined,sku=separator>0?id.slice(separator+1):id;let cursor:string|undefined;do{const page=await this.list({retailerId,query:sku,cursor,limit:100});const match=page.offers.find(item=>item.id===id);if(match)return match;cursor=page.nextCursor;}while(cursor);return null;}
}
