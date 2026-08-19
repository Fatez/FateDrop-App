export interface PassportBadge{id:string;name:string;description:string;cosmeticOnly:true;earnedAt?:string;}
export interface PassportProfile{id:string;badges:PassportBadge[];completedTrailIds:string[];enabled:false;}
export const passportFoundation:PassportProfile={id:'local-passport',badges:[],completedTrailIds:[],enabled:false};
