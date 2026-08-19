import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiCatalogueRepository, type CatalogueQuery } from '@/services/catalogue';
import type { ProductOffer } from '@/types/domain';

const repository = new ApiCatalogueRepository();
export function useCatalogue(query: Omit<CatalogueQuery, 'cursor'>) {
  const [offers,setOffers]=useState<ProductOffer[]>([]),[total,setTotal]=useState(0),[nextCursor,setNextCursor]=useState<string>(),[loading,setLoading]=useState(true),[loadingMore,setLoadingMore]=useState(false),[error,setError]=useState('');
  const request=useRef(0), key=JSON.stringify(query);
  const load=useCallback(async(reset=true)=>{const current=++request.current;reset?setLoading(true):setLoadingMore(true);setError('');try{const page=await repository.list({...query,cursor:reset?undefined:nextCursor});if(current!==request.current)return;setOffers(existing=>reset?page.offers:[...existing,...page.offers.filter(item=>!existing.some(old=>old.id===item.id))]);setTotal(page.total);setNextCursor(page.nextCursor);}catch{if(current===request.current)setError('The catalogue could not be loaded.');}finally{if(current===request.current){setLoading(false);setLoadingMore(false);}}},[key,nextCursor]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{const timer=setTimeout(()=>void load(true),300);return()=>clearTimeout(timer);},[key]); // eslint-disable-line react-hooks/exhaustive-deps
  return{offers,total,loading,loadingMore,error,hasMore:Boolean(nextCursor),retry:()=>load(true),loadMore:()=>nextCursor&&!loadingMore?load(false):Promise.resolve()};
}
