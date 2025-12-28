
export enum VoiceTone {
  FRIENDLY = 'ودود',
  FORMAL = 'رسمي',
  ASSERTIVE = 'حازم'
}

export enum Gender {
  MALE = 'ذكر',
  FEMALE = 'أنثى'
}

export interface PersonaSettings {
  name: string;
  gender: Gender;
  tone: VoiceTone;
}

export interface Property {
  id: string;
  title: string;
  price: string;
  location: string;
  description: string;
  images: string[];
  type: string;
}

export interface LeadData {
  name: string;
  phone: string;
  city: string;
  propertyType: string;
}
