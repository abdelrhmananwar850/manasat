
import { Gender, VoiceTone } from './types';

export const COMPANY_INFO = {
  name: "شركة منصات العقارية",
  hq: "6873 شارع المؤرخ بن بشر، الربوة، الرياض 12816",
  services: [
    "الوساطة العقارية", "التقييم العقاري", "إدارة الأملاك", 
    "المزادات", "التسويق العقاري", "تصوير 3D"
  ],
  contact: {
    phone: "920010094",
    whatsapp: "+966508404422",
    email: "info@gomenassat.com"
  },
  operatingAreas: ["الرياض", "جدة", "المنطقة الشرقية"]
};

// Use enums for Gender and VoiceTone to match the PersonaSettings interface
export const DEFAULT_PERSONA = {
  name: "نورة",
  gender: Gender.FEMALE,
  tone: VoiceTone.FRIENDLY
};
