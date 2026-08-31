export const TCG_CODES=['pokemon','one-piece','lorcana','magic','yugioh','digimon','flesh-and-blood','star-wars-unlimited','dragon-ball-super','union-arena','riftbound'] as const;
export type TcgCode=typeof TCG_CODES[number];
export type TcgLifecyclePreference={mode:'recommended'|'custom';whisper:boolean;echo:boolean;manifested:boolean;vanished:boolean};
export type TcgAlertPreferences=Partial<Record<TcgCode,TcgLifecyclePreference>>;
export const TCG_REGISTRY=[
  {code:'pokemon',shortName:'Pokémon',name:'Pokémon Trading Card Game',live:true,accent:'#D2B66F',icon:'sparkles-outline'},
  {code:'one-piece',shortName:'One Piece',name:'ONE PIECE CARD GAME',live:false,accent:'#EF6B68',icon:'compass-outline'},
  {code:'lorcana',shortName:'Lorcana',name:'Disney Lorcana Trading Card Game',live:false,accent:'#9F83E8',icon:'diamond-outline'},
  {code:'magic',shortName:'Magic',name:'Magic: The Gathering',live:false,accent:'#E18A55',icon:'flame-outline'},
  {code:'yugioh',shortName:'Yu-Gi-Oh!',name:'Yu-Gi-Oh! Trading Card Game',live:false,accent:'#6FB0DF',icon:'triangle-outline'},
  {code:'digimon',shortName:'Digimon',name:'Digimon Card Game',live:false,accent:'#7CCBD0',icon:'hardware-chip-outline'},
  {code:'flesh-and-blood',shortName:'Flesh and Blood',name:'Flesh and Blood',live:false,accent:'#C56F63',icon:'shield-outline'},
  {code:'star-wars-unlimited',shortName:'Star Wars',name:'Star Wars: Unlimited',live:false,accent:'#76A4D9',icon:'planet-outline'},
  {code:'dragon-ball-super',shortName:'Dragon Ball',name:'Dragon Ball Super Card Game',live:false,accent:'#EDAF54',icon:'radio-button-on-outline'},
  {code:'union-arena',shortName:'Union Arena',name:'Union Arena',live:false,accent:'#7BC78D',icon:'grid-outline'},
  {code:'riftbound',shortName:'Riftbound',name:'Riftbound: League of Legends TCG',live:false,accent:'#73B8AE',icon:'layers-outline'},
] as const;
export function isTcgCode(value:unknown):value is TcgCode{return typeof value==='string'&&(TCG_CODES as readonly string[]).includes(value);}
export function normalizeTcgCodes(value:unknown):TcgCode[]{if(!Array.isArray(value))return['pokemon'];const result=[...new Set(value.filter(isTcgCode))];return result.length?result:['pokemon'];}
export function recommendedTcgAlerts(codes:readonly TcgCode[]):TcgAlertPreferences{return Object.fromEntries(codes.map((code)=>[code,{mode:'recommended',whisper:true,echo:true,manifested:true,vanished:true}])) as TcgAlertPreferences;}
