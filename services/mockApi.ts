
import { Property, LeadData } from '../types';

// Types for conversation logging
export type ConversationIntent = 'greeting' | 'search' | 'price_inquiry' | 'booking' | 'info' | 'complaint' | 'other';
export type ConversationStatus = 'complete' | 'interrupted' | 'error' | 'session_end';

export interface ConversationLog {
  id: string;
  sessionId: string;
  timestamp: string;
  userMessage: string;
  botResponse: string;
  intent: ConversationIntent;
  propertyId?: string;
  propertyType?: string;
  location?: string;
  toolsUsed: string[];
  status: ConversationStatus;
  duration?: number;
}

// Session ID generator
let currentSessionId: string | null = null;
export const getSessionId = (): string => {
  if (!currentSessionId) {
    currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  return currentSessionId;
};

export const resetSessionId = () => {
  currentSessionId = null;
};

// Intent detection
export const detectIntent = (message: string): ConversationIntent => {
  const msg = message.toLowerCase();
  
  // Greeting patterns
  if (/سلام|مرحبا|أهلا|اهلا|هلا|hello|hi|hey|صباح|مساء/i.test(msg)) {
    return 'greeting';
  }
  
  // Search patterns
  if (/فيلا|شقة|شقق|أرض|ارض|عقار|أبي|أبغى|ابي|ابغى|عندكم|ابحث|دور/i.test(msg)) {
    return 'search';
  }
  
  // Price inquiry patterns
  if (/سعر|كم|ثمن|قيمة|تكلفة|بكم|price|cost/i.test(msg)) {
    return 'price_inquiry';
  }
  
  // Booking patterns
  if (/حجز|زيارة|موعد|أحجز|احجز|أزور|ازور|book|visit/i.test(msg)) {
    return 'booking';
  }
  
  // Info patterns
  if (/معلومات|وين|فين|عنوان|موقع|خدمات|about|info|where/i.test(msg)) {
    return 'info';
  }
  
  // Complaint patterns
  if (/شكوى|مشكلة|سيء|complaint|problem/i.test(msg)) {
    return 'complaint';
  }
  
  return 'other';
};

// Extract property type from message
export const extractPropertyType = (message: string): string | undefined => {
  const msg = message.toLowerCase();
  if (/فيلا/i.test(msg)) return 'فيلا';
  if (/شقة|شقق/i.test(msg)) return 'شقة';
  if (/أرض|ارض/i.test(msg)) return 'أرض';
  return undefined;
};

// Extract location from message
export const extractLocation = (message: string): string | undefined => {
  const msg = message.toLowerCase();
  const locations = [
    'الرياض', 'جدة', 'الدمام', 'الخبر', 'حطين', 'الملقا', 'النرجس', 
    'الياسمين', 'العليا', 'الروضة', 'الشاطئ', 'المحمدية', 'العزيزية'
  ];
  
  for (const loc of locations) {
    if (msg.includes(loc.toLowerCase()) || msg.includes(loc)) {
      return loc;
    }
  }
  return undefined;
};

// Enhanced save inquiry function
export const saveInquiry = (
  userMessage: string, 
  botResponse: string, 
  options?: {
    propertyId?: string;
    toolsUsed?: string[];
    status?: ConversationStatus;
    startTime?: number;
  }
) => {
  const inquiries: ConversationLog[] = JSON.parse(localStorage.getItem('manasat_inquiries') || '[]');
  
  const log: ConversationLog = {
    id: Date.now().toString(),
    sessionId: getSessionId(),
    timestamp: new Date().toLocaleString('ar-SA'),
    userMessage,
    botResponse,
    intent: detectIntent(userMessage),
    propertyId: options?.propertyId,
    propertyType: extractPropertyType(userMessage),
    location: extractLocation(userMessage),
    toolsUsed: options?.toolsUsed || [],
    status: options?.status || 'complete',
    duration: options?.startTime ? Date.now() - options.startTime : undefined
  };
  
  inquiries.push(log);
  localStorage.setItem('manasat_inquiries', JSON.stringify(inquiries.slice(-200))); // Keep last 200
  
  return log;
};

// Get analytics data
export const getAnalytics = () => {
  const inquiries: ConversationLog[] = JSON.parse(localStorage.getItem('manasat_inquiries') || '[]');
  
  // Intent distribution
  const intentCounts: Record<ConversationIntent, number> = {
    greeting: 0, search: 0, price_inquiry: 0, booking: 0, info: 0, complaint: 0, other: 0
  };
  
  // Property type distribution
  const propertyTypeCounts: Record<string, number> = {};
  
  // Location distribution
  const locationCounts: Record<string, number> = {};
  
  // Status distribution
  const statusCounts: Record<ConversationStatus, number> = {
    complete: 0, interrupted: 0, error: 0, session_end: 0
  };
  
  // Unique sessions
  const sessions = new Set<string>();
  
  inquiries.forEach(inq => {
    intentCounts[inq.intent]++;
    statusCounts[inq.status]++;
    sessions.add(inq.sessionId);
    
    if (inq.propertyType) {
      propertyTypeCounts[inq.propertyType] = (propertyTypeCounts[inq.propertyType] || 0) + 1;
    }
    
    if (inq.location) {
      locationCounts[inq.location] = (locationCounts[inq.location] || 0) + 1;
    }
  });
  
  // Conversion rate (price inquiries / searches)
  const conversionRate = intentCounts.search > 0 
    ? ((intentCounts.price_inquiry / intentCounts.search) * 100).toFixed(1) 
    : '0';
  
  return {
    totalConversations: inquiries.length,
    totalSessions: sessions.size,
    intentCounts,
    propertyTypeCounts,
    locationCounts,
    statusCounts,
    conversionRate: `${conversionRate}%`,
    // Most popular
    mostSearchedType: Object.entries(propertyTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
    mostSearchedLocation: Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
  };
};

// Save lead to localStorage
export const saveLead = (data: LeadData) => {
  const leads = JSON.parse(localStorage.getItem('manasat_leads') || '[]');
  leads.push({
    ...data,
    id: Date.now().toString(),
    timestamp: new Date().toLocaleString('ar-SA')
  });
  localStorage.setItem('manasat_leads', JSON.stringify(leads));
};

const MOCK_PROPERTIES: Property[] = [
  {
    id: "1",
    title: "فيلا فاخرة في حطين",
    price: "",
    location: "الرياض، حي حطين، شارع الأمير محمد بن سلمان",
    description: "فيلا بتصميم عصري على مساحة 450 متر مربع. تتكون من 5 غرف نوم و 6 دورات مياه. تحتوي على مسبح خاص وحديقة واسعة. موقف سيارات يتسع لـ 4 سيارات. تشطيب سوبر ديلوكس.",
    type: "فيلا",
    images: [
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800"
    ]
  },
  {
    id: "2",
    title: "شقة استثمارية في الملقا",
    price: "",
    location: "الرياض، حي الملقا، قريبة من طريق الملك فهد",
    description: "شقة فاخرة مساحتها 180 متر مربع. تتكون من 3 غرف نوم وصالة واسعة و 3 دورات مياه. تشطيب سوبر لوكس. قريبة من المدارس والمستشفيات.",
    type: "شقة",
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800"
    ]
  },
  {
    id: "3",
    title: "أرض سكنية في النرجس",
    price: "",
    location: "الرياض، حي النرجس، المخطط الجديد",
    description: "أرض سكنية مساحتها 600 متر مربع. موقع مميز على شارعين. قريبة من جميع الخدمات. صك إلكتروني جاهز.",
    type: "أرض",
    images: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800",
      "https://images.unsplash.com/photo-1628624747186-a941c476b7ef?w=800",
      "https://images.unsplash.com/photo-1595880500386-4b33823094d4?w=800"
    ]
  },
  {
    id: "4",
    title: "فيلا دوبلكس في جدة",
    price: "",
    location: "جدة، حي الشاطئ، قريبة من الكورنيش",
    description: "فيلا دوبلكس فاخرة على مساحة 350 متر مربع. تتكون من 4 غرف نوم ماستر و 5 دورات مياه. إطلالة بحرية مميزة. مسبح خاص وتراس واسع.",
    type: "فيلا",
    images: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
      "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800",
      "https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800"
    ]
  },
  {
    id: "5",
    title: "شقة فاخرة في العليا",
    price: "",
    location: "الرياض، حي العليا، برج المملكة",
    description: "شقة فاخرة مساحتها 250 متر مربع. تتكون من 4 غرف نوم و 4 دورات مياه. إطلالة بانورامية على المدينة. تشطيب فندقي 5 نجوم.",
    type: "شقة",
    images: [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800",
      "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800",
      "https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?w=800",
      "https://images.unsplash.com/photo-1560185008-b033106af5c3?w=800"
    ]
  },
  {
    id: "6",
    title: "فيلا مودرن في الياسمين",
    price: "",
    location: "الرياض، حي الياسمين، شارع أنس بن مالك",
    description: "فيلا مودرن على مساحة 500 متر مربع. تتكون من 6 غرف نوم و 7 دورات مياه. مسبح داخلي وخارجي. سينما منزلية. جيم خاص.",
    type: "فيلا",
    images: [
      "https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800",
      "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800",
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800",
      "https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?w=800"
    ]
  },
  {
    id: "7",
    title: "أرض تجارية في الدمام",
    price: "",
    location: "الدمام، حي الفيصلية، طريق الملك فهد",
    description: "أرض تجارية مساحتها 1200 متر مربع. موقع استراتيجي على طريق رئيسي. مناسبة لمشروع تجاري أو برج مكاتب.",
    type: "أرض",
    images: [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
      "https://images.unsplash.com/photo-1464938050520-ef2571e0d6e6?w=800",
      "https://images.unsplash.com/photo-1577415124269-fc1140354693?w=800"
    ]
  },
  {
    id: "8",
    title: "شقة عزاب في الخبر",
    price: "",
    location: "الخبر، حي العقربية، قريبة من الكورنيش",
    description: "شقة مفروشة مساحتها 90 متر مربع. تتكون من غرفتين نوم وصالة ومطبخ. مناسبة للعزاب أو الموظفين.",
    type: "شقة",
    images: [
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",
      "https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=800",
      "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800"
    ]
  },
  {
    id: "9",
    title: "فيلا عصرية في المحمدية",
    price: "",
    location: "جدة، حي المحمدية، شارع التحلية",
    description: "فيلا عصرية مساحتها 400 متر مربع. 4 غرف نوم ماستر. حديقة خاصة ومسبح. قريبة من المولات والمطاعم.",
    type: "فيلا",
    images: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
      "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800",
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800"
    ]
  },
  {
    id: "10",
    title: "شقة بإطلالة بحرية",
    price: "",
    location: "جدة، حي الشاطئ، أبراج الكورنيش",
    description: "شقة فاخرة مساحتها 200 متر مربع. 3 غرف نوم. إطلالة مباشرة على البحر. تشطيب فاخر.",
    type: "شقة",
    images: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800"
    ]
  },
  {
    id: "11",
    title: "أرض سكنية في العزيزية",
    price: "",
    location: "الرياض، حي العزيزية، قريبة من الدائري",
    description: "أرض سكنية مساحتها 750 متر مربع. زاوية على شارعين. موقع مميز قريب من الخدمات.",
    type: "أرض",
    images: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800",
      "https://images.unsplash.com/photo-1595880500386-4b33823094d4?w=800"
    ]
  },
  {
    id: "12",
    title: "فيلا كلاسيكية في الروضة",
    price: "",
    location: "الرياض، حي الروضة، شارع الثلاثين",
    description: "فيلا كلاسيكية مساحتها 550 متر مربع. 6 غرف نوم. مجلس رجال ونساء منفصل. حوش واسع.",
    type: "فيلا",
    images: [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800"
    ]
  }
];

// Track last shown property to avoid repetition
let lastShownPropertyId: string | null = null;

export const searchProperties = async (query: string): Promise<Property[]> => {
  console.log("Searching API for:", query);
  const q = query.toLowerCase();
  
  // Check if query includes a specific location
  const hasLocationQuery = q.includes('رياض') || q.includes('جدة') || q.includes('دمام') || q.includes('خبر') || 
                          q.includes('حطين') || q.includes('ملقا') || q.includes('نرجس') || q.includes('ياسمين') ||
                          q.includes('عليا') || q.includes('روضة') || q.includes('شاطئ') || q.includes('محمدية');
  
  // Check if query includes a specific type
  const hasTypeQuery = q.includes('فيلا') || q.includes('شقة') || q.includes('شقق') || q.includes('أرض') || q.includes('ارض');
  
  // Search with strict matching
  let results = MOCK_PROPERTIES.filter(p => {
    const locationMatch = p.location.toLowerCase();
    const typeMatch = p.type.toLowerCase();
    
    // If user specified location, must match location
    if (hasLocationQuery) {
      const locationMatches = 
        (q.includes('رياض') && locationMatch.includes('الرياض')) ||
        (q.includes('جدة') && locationMatch.includes('جدة')) ||
        (q.includes('دمام') && locationMatch.includes('الدمام')) ||
        (q.includes('خبر') && locationMatch.includes('الخبر')) ||
        (q.includes('حطين') && locationMatch.includes('حطين')) ||
        (q.includes('ملقا') && locationMatch.includes('الملقا')) ||
        (q.includes('نرجس') && locationMatch.includes('النرجس')) ||
        (q.includes('ياسمين') && locationMatch.includes('الياسمين')) ||
        (q.includes('عليا') && locationMatch.includes('العليا')) ||
        (q.includes('روضة') && locationMatch.includes('الروضة')) ||
        (q.includes('شاطئ') && locationMatch.includes('الشاطئ')) ||
        (q.includes('محمدية') && locationMatch.includes('المحمدية'));
      
      if (!locationMatches) return false;
    }
    
    // If user specified type, must match type
    if (hasTypeQuery) {
      const typeMatches = 
        ((q.includes('فيلا')) && typeMatch === 'فيلا') ||
        ((q.includes('شقة') || q.includes('شقق')) && typeMatch === 'شقة') ||
        ((q.includes('أرض') || q.includes('ارض')) && typeMatch === 'أرض');
      
      if (!typeMatches) return false;
    }
    
    // If no specific query, match anything
    if (!hasLocationQuery && !hasTypeQuery) {
      return true;
    }
    
    return true;
  });
  
  // DON'T return random properties if no match - return empty
  if (results.length === 0) {
    return new Promise(resolve => setTimeout(() => resolve([]), 500));
  }
  
  // Try to show a different property than last time
  if (results.length > 1 && lastShownPropertyId) {
    // Move last shown to end of array
    const lastIndex = results.findIndex(p => p.id === lastShownPropertyId);
    if (lastIndex !== -1) {
      const [lastShown] = results.splice(lastIndex, 1);
      results.push(lastShown);
    }
  }
  
  // Update last shown
  if (results.length > 0) {
    lastShownPropertyId = results[0].id;
  }
  
  return new Promise(resolve => setTimeout(() => resolve(results), 800));
};

// Get alternative locations for a property type
export const getAlternativeLocations = (propertyType: string): string[] => {
  const type = propertyType.toLowerCase();
  const locations: string[] = [];
  
  MOCK_PROPERTIES.forEach(p => {
    if (
      (type.includes('فيلا') && p.type === 'فيلا') ||
      (type.includes('شقة') && p.type === 'شقة') ||
      (type.includes('شقق') && p.type === 'شقة') ||
      (type.includes('أرض') && p.type === 'أرض') ||
      (type.includes('ارض') && p.type === 'أرض')
    ) {
      // Extract neighborhood from location
      const parts = p.location.split('،');
      if (parts.length >= 2) {
        const neighborhood = parts[1].trim();
        if (!locations.includes(neighborhood)) {
          locations.push(neighborhood);
        }
      }
    }
  });
  
  return locations;
};

export const submitLead = async (data: LeadData): Promise<boolean> => {
  console.log("Submitting lead to Dashboard API:", data);
  saveLead(data);
  return new Promise(resolve => setTimeout(() => resolve(true), 1200));
};
