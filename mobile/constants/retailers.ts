import type { Retailer } from '@/types/domain';

export const retailers: Retailer[] = [
  { id:'cob-and-pip',name:'Cob & Pip',slug:'cob-and-pip',description:'Independent UK Pokémon retailer with an online catalogue.',websiteUrl:'https://cobandpip.co.uk',onlineOnly:true,sponsored:false,plan:'INDIE',verification:{status:'PENDING'},locations:[] },
  { id:'total-cards',name:'Total Cards',slug:'total-cards',description:'UK online collectables retailer.',websiteUrl:'https://totalcards.net',onlineOnly:false,sponsored:false,plan:'FREE',verification:{status:'UNVERIFIED'},locations:[] },
  { id:'double-sleeved',name:'Double Sleeved',slug:'double-sleeved',description:'UK trading-card retailer.',websiteUrl:'https://www.doublesleeved.co.uk',onlineOnly:true,sponsored:false,plan:'FREE',verification:{status:'UNVERIFIED'},locations:[] },
  { id:'pokemon-center-uk',name:'Pokémon Center UK',slug:'pokemon-center-uk',websiteUrl:'https://www.pokemoncenter.com/en-gb',onlineOnly:true,sponsored:false,plan:'FREE',verification:{status:'UNVERIFIED'},locations:[] },
  { id:'demo-nebula-cards',name:'Nebula Cards (Demo)',slug:'demo-nebula-cards',description:'Fictional physical retailer for FateDrop demonstrations.',websiteUrl:'https://example.invalid/demo/nebula',onlineOnly:false,sponsored:false,isDemo:true,plan:'INDIE_PRO',verification:{status:'VERIFIED',lastReviewedAt:'2026-08-16T00:00:00Z'},locations:[{id:'demo-nebula-manchester',retailerId:'demo-nebula-cards',name:'Demo Manchester shop',townCity:'Manchester',postcode:'M1 1AE',latitude:53.4794,longitude:-2.2453,countryCode:'GB',collectionAvailable:true}] },
  { id:'demo-orbit-collectables',name:'Orbit Collectables (Demo)',slug:'demo-orbit-collectables',description:'Fictional online-only retailer for FateDrop demonstrations.',websiteUrl:'https://example.invalid/demo/orbit',onlineOnly:true,sponsored:true,isDemo:true,plan:'INDIE_PRO',verification:{status:'UNVERIFIED'},locations:[] },
  { id:'demo-cosmic-card-room',name:'Cosmic Card Room (Demo)',slug:'demo-cosmic-card-room',description:'Fictional physical retailer for FateDrop demonstrations.',websiteUrl:'https://example.invalid/demo/cosmic',onlineOnly:false,sponsored:false,isDemo:true,plan:'INDIE',verification:{status:'VERIFIED',lastReviewedAt:'2026-08-16T00:00:00Z'},locations:[{id:'demo-cosmic-bristol',retailerId:'demo-cosmic-card-room',name:'Demo Bristol shop',townCity:'Bristol',postcode:'BS1 5UH',latitude:51.4545,longitude:-2.5879,countryCode:'GB',collectionAvailable:true}] },
];

export const independentRetailers = retailers
  .filter((retailer) => retailer.id === 'cob-and-pip')
  .map((retailer) => ({ key: retailer.id, name: retailer.name, search: `${retailer.websiteUrl}/search?q=` }));

export const independentRetailerKeys = new Set<string>(independentRetailers.map((retailer) => retailer.key));
