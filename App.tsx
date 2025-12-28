import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, Type, LiveServerMessage } from '@google/genai';
import { Property } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioHelpers';
import { searchProperties, saveInquiry, getAlternativeLocations, resetSessionId } from './services/mockApi';
import Gallery from './components/Gallery';
import LeadForm from './components/LeadForm';
import Notification from './components/Notification';
import Dashboard from './pages/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'search_property',
        description: `⛔ ممنوع استخدامها عند الترحيب أو السلام. 
استخدمها فقط إذا طلب العميل صراحةً البحث عن عقار بكلمات مثل: "أبي فيلا"، "عندكم شقق؟"، "أبي أرض"، "ابحث لي عن عقار".
❌ لا تستخدمها مع: السلام عليكم، مرحبا، كيف حالك، شكراً.`,
        parameters: {
          type: Type.OBJECT,
          properties: { 
            query: { type: Type.STRING, description: 'نوع العقار والمدينة (مثال: فيلا في الرياض)' } 
          },
          required: ['query'],
        },
      },
      { 
        name: 'open_gallery', 
        description: `⛔ ممنوع استخدامها عند الترحيب أو بدون بحث سابق.
استخدمها فقط بعد نجاح search_property وإيجاد عقار.
❌ لا تفتحها تلقائياً أبداً.`, 
        parameters: { type: Type.OBJECT, properties: {} } 
      },
      { 
        name: 'close_gallery', 
        description: 'إغلاق معرض الصور عند طلب العميل.', 
        parameters: { type: Type.OBJECT, properties: {} } 
      },
      { 
        name: 'open_lead_form', 
        description: `⛔ ممنوع استخدامها عند الترحيب.
استخدمها فقط إذا قال العميل صراحةً: "مهتم"، "كم السعر"، "أبي أحجز"، "أبي زيارة"، "تفاوض".
❌ لا تفتحها مع: السلام عليكم، مرحبا، شكراً.`, 
        parameters: { type: Type.OBJECT, properties: {} } 
      },
      {
        name: 'show_previous_property',
        description: `استخدمها عندما يطلب العميل الرجوع لعقار سابق أو يقول: "ارجع للشقة الأولى"، "العقار اللي قبله"، "الفيلا السابقة".`,
        parameters: {
          type: Type.OBJECT,
          properties: {
            index: { type: Type.NUMBER, description: 'رقم العقار (1 = الأول، 2 = الثاني، الخ)' }
          },
          required: ['index'],
        },
      }
    ],
  },
];

const BG_IMAGE = "/assets/assistant_bg.png";
const LOGO_IMAGE = "/assets/logo.webp";

const App: React.FC = () => {
  const [showDashboard, setShowDashboard] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeProperty, setActiveProperty] = useState<Property | null>(null);
  const [propertyHistory, setPropertyHistory] = useState<Property[]>([]); // Track shown properties
  const [showGallery, setShowGallery] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [statusMessage, setStatusMessage] = useState('جاهزة لخدمتك.. اضغط للتحدث');
  const [transcript, setTranscript] = useState<{ user: string; model: string }[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  const showGalleryRef = useRef(false); // Track gallery state for interruption
  const isProcessingRef = useRef(false); // Prevent multiple simultaneous tool calls
  const showLeadFormRef = useRef(false); // Track lead form state
  const reconnectAttemptsRef = useRef(0); // Track reconnection attempts
  const maxReconnectAttempts = 3;
  const toolsUsedRef = useRef<string[]>([]); // Track tools used in current turn
  const turnStartTimeRef = useRef<number>(0); // Track turn start time
  const abortControllerRef = useRef<AbortController | null>(null); // For cancelling retry

  // Safe retry helper with exponential backoff
  const withRetry = async <T,>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number;
      onRetry?: (attempt: number) => void;
    } = {}
  ): Promise<T> => {
    const { maxAttempts = 3, onRetry } = options;
    const delays = [500, 1000, 2000]; // 0.5s, 1s, 2s
    let lastError: Error = new Error('Unknown error');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Connection cancelled');
      }
      
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const errMsg = lastError.message.toLowerCase();
        
        // Don't retry auth/quota errors - they won't succeed
        if (errMsg.includes('api key') || errMsg.includes('quota') || 
            errMsg.includes('unauthorized') || errMsg.includes('forbidden') ||
            errMsg.includes('invalid')) {
          console.error('Non-retryable error:', errMsg);
          throw lastError;
        }
        
        // Retry for network/temporary errors
        if (attempt < maxAttempts) {
          console.log(`Retry attempt ${attempt}/${maxAttempts}...`);
          onRetry?.(attempt);
          
          // Wait before retry (check abort during wait)
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(resolve, delays[attempt - 1]);
            abortControllerRef.current?.signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('Connection cancelled'));
            });
          });
        }
      }
    }
    
    throw lastError;
  };

  // Check if error is retryable
  const getErrorMessage = (err: Error): string => {
    const msg = err.message.toLowerCase();
    if (msg.includes('api key') || msg.includes('unauthorized')) {
      return 'خطأ في المصادقة - تواصل مع الدعم';
    }
    if (msg.includes('quota')) {
      return 'تم تجاوز الحد المسموح - حاول لاحقاً';
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'تأكد من اتصال الإنترنت';
    }
    return 'حدث خطأ - اضغط للمحاولة مرة أخرى';
  };

  // Get persona from localStorage
  const getPersona = () => {
    const saved = localStorage.getItem('manasat_persona');
    return saved ? JSON.parse(saved) : { name: 'نورة', gender: 'أنثى', tone: 'ودود', language: 'سعودي مهذب' };
  };

  // Get system prompt from localStorage or default
  const getSystemPrompt = () => {
    const persona = getPersona();
    const knowledgeBase = localStorage.getItem('manasat_knowledge_base') || '';
    const customSystemPrompt = localStorage.getItem('manasat_system_prompt') || '';
    const f = persona.gender === 'أنثى'; // female flag
    
    // If user has custom system prompt, use it with persona variables
    if (customSystemPrompt.trim()) {
      return `
${customSystemPrompt}

## إعدادات الشخصية الحالية:
- الاسم: ${persona.name}
- الجنس: ${persona.gender}
- الأسلوب: ${persona.tone}
- اللهجة: ${persona.language}

${knowledgeBase ? '## قاعدة المعرفة:\n' + knowledgeBase : ''}
      `.trim();
    }
    
    // Default system prompt
    return `
أنت${f ? 'ِ' : ''} ${persona.name}، مساعد${f ? 'ة' : ''} عقاري${f ? 'ة' : ''} لشركة "منصات العقارية".

## 🌐 اللغة:
- اللغة الأساسية: عربي سعودي
- إذا تكلم العميل بالإنجليزية، رد${f ? 'ي' : ''} بالإنجليزية
- If the client speaks English, respond in English

## 🏢 معلومات الشركة:
شركة منصات العقارية - شركة سعودية تقدم خدمات عقارية بأعلى المعايير الدولية باستخدام أحدث التقنيات الذكية.

**خدماتنا:**
- التقييم العقاري
- التسويق العقاري
- إدارة الأملاك
- الدراسات العقارية
- المزادات

**العنوان:** 6873 شارع المؤرخ بن بشر، الربوة، الرياض 12816، المملكة العربية السعودية

## ⛔⛔⛔ قاعدة حاسمة - الكلام vs الفعل ⛔⛔⛔
❌ ممنوع تقول${f ? 'ي' : ''} "هعمل X" أو "هعرضلك" أو "هفتحلك" - نفذ${f ? 'ي' : ''} الأداة مباشرة!
✅ استخدم${f ? 'ي' : ''} الأداة أولاً، ثم اشرح${f ? 'ي' : ''} النتيجة

## ⛔ قاعدة الترحيب ⛔
عند الترحيب (السلام عليكم، مرحبا، أهلاً، Hello، Hi):
❌ ممنوع منعاً باتاً استخدام أي أداة
✅ فقط رد${f ? 'ي' : ''} بالكلام وعرّف${f ? 'ي' : ''} نفسك

## متى تستخدم${f ? 'ين' : ''} الأدوات:
| الأداة | متى تستخدمها | متى لا تستخدمها |
|--------|-------------|----------------|
| search_property | العميل طلب عقار (أبي فيلا، عندكم شقق) | الترحيب، الأسئلة العامة |
| open_gallery | بعد نجاح البحث مباشرة | بدون بحث سابق |
| open_lead_form | العميل قال: مهتم، كم السعر، أبي أحجز | الترحيب، الاستفسارات |

## الترحيب:
رد${f ? 'ي' : ''} بشكل طبيعي ودود بنفس أسلوب ولغة تحية العميل، عرّف${f ? 'ي' : ''} نفسك كمساعد${f ? 'ة' : ''} ذكي${f ? 'ة' : ''} لشركة منصات العقارية.

## الشخصية:
- ${persona.gender}، لبِق${f ? 'ة' : ''}، محترف${f ? 'ة' : ''}، واثق${f ? 'ة' : ''}.
- الأسلوب: ${persona.tone}، اللهجة: ${persona.language}.
- تتكلم${f ? 'ين' : ''} بصيغة ${f ? 'المؤنث' : 'المذكر'} عن نفسك.

## القواعد الصارمة:
1. لا تذكر${f ? 'ي' : ''} أنك ذكاء اصطناعي - قول${f ? 'ي' : ''} "المساعد${f ? 'ة' : ''} الذكي${f ? 'ة' : ''}".
2. لا تغير${f ? 'ي' : ''} اسمك أو شخصيتك أو اسم الشركة.
3. لا تتحدث${f ? 'ي' : ''} خارج موضوع العقارات والشركة.
4. ممنوع ذكر أي شركة منافسة.

## عند طلب عقار:
1. استخدم${f ? 'ي' : ''} search_property فوراً
2. إذا وجدت${f ? 'ي' : ''} نتائج، استخدم${f ? 'ي' : ''} open_gallery فوراً
3. اشرح${f ? 'ي' : ''} تفاصيل العقار (المساحة، الموقع، المميزات)
4. لا تذكر${f ? 'ي' : ''} السعر - إذا سأل، استخدم${f ? 'ي' : ''} open_lead_form

## الرجوع لعقار سابق:
إذا طلب العميل الرجوع لعقار سابق:
- استخدم${f ? 'ي' : ''} show_previous_property مع رقم العقار

## فتح نموذج البيانات:
عندما العميل يسأل عن السعر أو يقول "مهتم" أو "أبي أحجز":
1. استخدم${f ? 'ي' : ''} open_lead_form فوراً
2. قول${f ? 'ي' : ''}: "تفضل املي النموذج وأحد ممثلينا هيتواصل معك"

## إذا غير العميل رأيه:
إذا كان النموذج مفتوح والعميل قال "لا" أو "عايز شقة تانية" أو "غيرت رأيي":
1. استخدم${f ? 'ي' : ''} search_property للبحث الجديد (النموذج هيتقفل تلقائياً)
2. اسأل${f ? 'ي' : ''}: "تمام، تبغى في أي حي؟"

## ممنوعات:
❌ إغلاق صفقات
❌ إقناع بالشراء
❌ ذكر أسعار غير مؤكدة
❌ استشارات قانونية/مالية
❌ السؤال عن الميزانية - هذا شغل المندوب

## التحويل للمسوق:
عبدالرحمن - 0508404422 (للأسئلة القانونية، الشكاوى، التفاوض، الزيارات)

## إذا مفهمتش الكلام:
إذا الكلام مش واضح أو فيه تشويش:
- قول${f ? 'ي' : ''}: "عذراً، ممكن تعيد السؤال؟" أو "وضح${f ? 'ي' : ''} أكثر لو سمحت"
- لا توقف${f ? 'ي' : ''} عن الرد - دايماً رد${f ? 'ي' : ''} بشيء

## إذا جاك أكثر من سؤال:
إذا العميل سأل أكثر من سؤال في نفس الوقت:
- رد${f ? 'ي' : ''} على السؤال الأول
- ثم اسأل${f ? 'ي' : ''}: "وبخصوص سؤالك الثاني..."

${knowledgeBase ? '## قاعدة المعرفة:\n' + knowledgeBase : ''}
    `.trim();
  };

  const handleCloseGallery = useCallback(() => {
    setShowGallery(false);
    showGalleryRef.current = false;
    setNotification({ message: 'تم إغلاق معرض الصور', type: 'info' });
  }, []);

  // Stop AI audio playback - aggressive approach with immediate suspension
  const stopAudioPlayback = useCallback(() => {
    // First suspend the context to stop all audio immediately
    if (outputAudioContextRef.current && outputAudioContextRef.current.state === 'running') {
      outputAudioContextRef.current.suspend().catch(() => {});
    }
    
    // Stop all scheduled audio sources
    sourcesRef.current.forEach(s => {
      try { 
        s.stop(0); // Stop immediately
        s.disconnect();
      } catch (e) { /* ignore */ }
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    
    // Close output audio context completely
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close().catch(() => {});
      outputAudioContextRef.current = null;
    }
  }, []);

  // Close lead form and stop audio
  const handleCloseLeadForm = useCallback(() => {
    setShowLeadForm(false);
    showLeadFormRef.current = false;
    stopAudioPlayback();
  }, [stopAudioPlayback]);

  const handleToolCall = useCallback(async (fc: any) => {
    // Prevent multiple simultaneous tool calls
    if (isProcessingRef.current) {
      console.log("Skipping tool call - already processing:", fc.name);
      return;
    }
    isProcessingRef.current = true;
    
    console.log("Function Call:", fc.name, fc.args);
    toolsUsedRef.current.push(fc.name); // Track tool usage
    let response = "تم تنفيذ الأمر";

    try {
      // Close lead form if user is searching for something else
      if (fc.name === 'search_property' || fc.name === 'show_previous_property') {
        if (showLeadFormRef.current) {
          setShowLeadForm(false);
          showLeadFormRef.current = false;
        }
      }

      switch (fc.name) {
        case 'search_property':
          try {
            const results = await searchProperties(fc.args.query);
            if (results.length > 0) {
              const property = results[0];
              setActiveProperty(property);
              // Add to history if not already there
              setPropertyHistory(prev => {
                if (!prev.find(p => p.id === property.id)) {
                  return [...prev, property];
                }
                return prev;
              });
              setShowGallery(true);
              showGalleryRef.current = true;
              const historyIndex = propertyHistory.length + 1;
              response = `تم فتح معرض الصور. العقار رقم ${historyIndex}: ${property.title}. الموقع: ${property.location}. النوع: ${property.type}. ${property.description}. الصور معروضة الآن.`;
            } else {
              const alternatives = getAlternativeLocations(fc.args.query);
              if (alternatives.length > 0) {
                response = `عذراً، لا يوجد عقارات بهذه المواصفات هنا. عندنا في: ${alternatives.join('، ')}. تحب أي حي؟`;
              } else {
                response = "عذراً، لا يوجد عقارات متوفرة. تحب أسجل طلبك؟";
              }
            }
          } catch (err) {
            console.error("Search error:", err);
            response = "حدث خطأ في البحث. حاول مرة ثانية.";
          }
          break;
        case 'show_previous_property':
          const index = (fc.args.index || 1) - 1;
          if (index >= 0 && index < propertyHistory.length) {
            const prevProperty = propertyHistory[index];
            setActiveProperty(prevProperty);
            setShowGallery(true);
            showGalleryRef.current = true;
            response = `تم فتح العقار رقم ${index + 1}: ${prevProperty.title}. الصور معروضة.`;
          } else {
            response = `ما عندي عقار بهذا الرقم. عرضت ${propertyHistory.length} عقارات.`;
          }
          break;
        case 'open_gallery':
          if (activeProperty) {
            if (showGalleryRef.current) {
              response = `معرض الصور مفتوح فعلاً: ${activeProperty.title}.`;
            } else {
              setShowGallery(true);
              showGalleryRef.current = true;
              response = `تم فتح معرض الصور: ${activeProperty.title}.`;
            }
          } else {
            response = "ابحث عن عقار أولاً.";
          }
          break;
        case 'close_gallery':
          handleCloseGallery();
          response = "تم إغلاق معرض الصور.";
          break;
        case 'open_lead_form':
          setShowLeadForm(true);
          showLeadFormRef.current = true;
          response = "تم فتح نموذج التسجيل. اطلب من العميل تعبئة بياناته.";
          break;
      }

      // Send response back to AI
      if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then((session) => {
          session.sendToolResponse({
            functionResponses: { id: fc.id, name: fc.name, response: { result: response } }
          });
        }).catch(err => console.error("Tool response error:", err));
      }
    } catch (err) {
      console.error("Tool call error:", err);
    } finally {
      // Allow next tool call after a small delay
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 100);
    }
  }, [activeProperty, handleCloseGallery, propertyHistory]);

  const connectSession = async () => {
    if (sessionRef.current) return;
    const persona = getPersona();
    reconnectAttemptsRef.current = 0;
    
    // Create new abort controller for this connection attempt
    abortControllerRef.current = new AbortController();

    try {
      setStatusMessage("جاري الاتصال...");
      
      // Get microphone with retry
      const stream = await withRetry(
        () => navigator.mediaDevices.getUserMedia({ audio: true }),
        {
          maxAttempts: 2,
          onRetry: () => setStatusMessage("جاري طلب صلاحية الميكروفون...")
        }
      ).catch(err => {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw new Error('يرجى السماح بالوصول للميكروفون');
        }
        throw err;
      });
      
      streamRef.current = stream;
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });

      // Connect to Gemini with retry
      const sessionPromise = await withRetry(
        () => ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: getSystemPrompt(),
            tools: TOOLS,
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.gender === 'أنثى' ? 'Kore' : 'Puck' } }
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {}
          },
          callbacks: {
            onopen: () => {
              setIsRecording(true);
              setStatusMessage("أنا أسمعك الآن..");
              const source = audioContextRef.current!.createMediaStreamSource(streamRef.current!);
              scriptProcessorRef.current = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
              scriptProcessorRef.current.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                sessionPromiseRef.current?.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
              };
              source.connect(scriptProcessorRef.current);
              scriptProcessorRef.current.connect(audioContextRef.current!.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
              try {
                // Don't process if session is stopped
                if (!sessionRef.current) return;
                
                const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (audioData && outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
                  const ctx = outputAudioContextRef.current;
                  nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                  const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
                  
                  // Double check context is still valid before playing
                  if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') return;
                  
                  const source = ctx.createBufferSource();
                  source.buffer = buffer;
                  source.connect(ctx.destination);
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += buffer.duration;
                  sourcesRef.current.add(source);
                  source.onended = () => sourcesRef.current.delete(source);
                }

                if (message.serverContent?.interrupted) {
                  // Save partial conversation before clearing
                  if (currentInputTranscription.current || currentOutputTranscription.current) {
                    saveInquiry(
                      currentInputTranscription.current || '[مقاطعة]',
                      currentOutputTranscription.current || '[تم المقاطعة]',
                      {
                        propertyId: activeProperty?.id,
                        toolsUsed: [...toolsUsedRef.current],
                        status: 'interrupted',
                        startTime: turnStartTimeRef.current
                      }
                    );
                    toolsUsedRef.current = [];
                    currentInputTranscription.current = '';
                    currentOutputTranscription.current = '';
                  }
                  
                  sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
                  sourcesRef.current.clear();
                  nextStartTimeRef.current = 0;
                  if (showGalleryRef.current) {
                    setShowGallery(false);
                    showGalleryRef.current = false;
                  }
                }

                if (message.serverContent?.inputTranscription) {
                  // Start timing when user starts speaking
                  if (!turnStartTimeRef.current) {
                    turnStartTimeRef.current = Date.now();
                  }
                  currentInputTranscription.current += message.serverContent.inputTranscription.text;
                }
                if (message.serverContent?.outputTranscription) {
                  currentOutputTranscription.current += message.serverContent.outputTranscription.text;
                }

                if (message.serverContent?.turnComplete) {
                  const userMsg = currentInputTranscription.current;
                  const botMsg = currentOutputTranscription.current;
                  setTranscript(prev => [...prev, { user: userMsg, model: botMsg }].slice(-5));
                  
                  if (userMsg || botMsg) {
                    saveInquiry(userMsg, botMsg, {
                      propertyId: activeProperty?.id,
                      toolsUsed: [...toolsUsedRef.current],
                      status: 'complete',
                      startTime: turnStartTimeRef.current
                    });
                  }
                  
                  // Reset for next turn
                  currentInputTranscription.current = '';
                  currentOutputTranscription.current = '';
                  toolsUsedRef.current = [];
                  turnStartTimeRef.current = 0;
                }

                if (message.toolCall) {
                  for (const fc of message.toolCall.functionCalls) {
                    handleToolCall(fc);
                  }
                }
              } catch (err) {
                console.error("Message processing error:", err);
              }
            },
            onerror: (e: any) => {
              console.error("Session Error:", e);
              // Try to recover from errors
              if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                reconnectAttemptsRef.current++;
                setStatusMessage("جاري إعادة الاتصال...");
                setTimeout(() => {
                  stopSession();
                  connectSession();
                }, 1000);
              } else {
                setStatusMessage("حدث خطأ - اضغط للمحاولة مرة أخرى");
                stopSession();
              }
            },
            onclose: () => {
              // Only stop if not reconnecting
              if (reconnectAttemptsRef.current >= maxReconnectAttempts || !isRecording) {
                stopSession();
              }
            }
          }
        }),
        {
          maxAttempts: 3,
          onRetry: (attempt) => setStatusMessage(`جاري إعادة الاتصال (${attempt}/3)...`)
        }
      );

      sessionPromiseRef.current = Promise.resolve(sessionPromise);
      sessionRef.current = sessionPromise;
    } catch (err) {
      console.error("Connection Failed:", err);
      const error = err as Error;
      
      // Clean up on failure
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close().catch(() => {});
        outputAudioContextRef.current = null;
      }
      
      // Show appropriate error message
      if (error.message === 'Connection cancelled') {
        setStatusMessage("جاهزة لخدمتك.. اضغط للتحدث");
      } else {
        setStatusMessage(getErrorMessage(error));
      }
    }
  };

  const stopSession = () => {
    // Cancel any pending retry attempts
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Save any pending conversation before stopping
    if (currentInputTranscription.current || currentOutputTranscription.current) {
      saveInquiry(
        currentInputTranscription.current || '[انتهاء الجلسة]',
        currentOutputTranscription.current || '[تم إنهاء الجلسة]',
        {
          propertyId: activeProperty?.id,
          toolsUsed: [...toolsUsedRef.current],
          status: 'session_end',
          startTime: turnStartTimeRef.current
        }
      );
      currentInputTranscription.current = '';
      currentOutputTranscription.current = '';
      toolsUsedRef.current = [];
      turnStartTimeRef.current = 0;
    }
    
    // Reset session ID for next session
    resetSessionId();
    // First suspend output context to stop audio immediately
    if (outputAudioContextRef.current && outputAudioContextRef.current.state === 'running') {
      outputAudioContextRef.current.suspend().catch(() => {});
    }
    
    // Stop all playing audio sources
    sourcesRef.current.forEach(s => {
      try { 
        s.stop(0);
        s.disconnect();
      } catch (e) { /* ignore */ }
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    
    // Close output audio context
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close().catch(() => {});
      outputAudioContextRef.current = null;
    }
    
    // Close input audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    
    // Close session first to stop receiving new audio
    if (sessionRef.current) { 
      try { sessionRef.current.close(); } catch (e) { /* ignore */ }
      sessionRef.current = null; 
    }
    sessionPromiseRef.current = null;
    
    if (scriptProcessorRef.current) { 
      try { scriptProcessorRef.current.disconnect(); } catch (e) { /* ignore */ }
      scriptProcessorRef.current = null; 
    }
    if (streamRef.current) { 
      streamRef.current.getTracks().forEach(t => t.stop()); 
      streamRef.current = null; 
    }
    setIsRecording(false);
    setStatusMessage("جاهزة لخدمتك.. اضغط للتحدث");
  };

  const toggleSession = () => isRecording ? stopSession() : connectSession();

  // Handle Dashboard navigation - stop session when entering, reset when leaving
  const handleOpenDashboard = () => {
    stopSession();
    stopAudioPlayback();
    setShowDashboard(true);
  };

  const handleCloseDashboard = () => {
    setShowDashboard(false);
    // Reset property history for fresh start
    setPropertyHistory([]);
    setActiveProperty(null);
  };

  // Show Dashboard
  if (showDashboard) {
    return (
      <ErrorBoundary fallbackTitle="حدث خطأ في لوحة التحكم" onReset={handleCloseDashboard}>
        <Dashboard onBack={handleCloseDashboard} />
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center">
      {notification && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
      )}
      
      <div className="absolute inset-0 z-0 bg-cover md:bg-center bg-[center_right_-8rem]" style={{ backgroundImage: `url('${BG_IMAGE}')` }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60 backdrop-blur-[2px]" />
      </div>

      <header className="fixed top-0 inset-x-0 h-16 md:h-20 bg-white/10 backdrop-blur-md border-b border-white/20 flex items-center justify-between px-4 md:px-8 z-40">
        <div className="flex items-center gap-2 md:gap-4">
          <img src={LOGO_IMAGE} alt="Menassat Logo" className="h-8 md:h-10 w-auto object-contain" />
          <div className="h-8 w-[1px] bg-white/30 hidden md:block" />
          <div className="hidden md:block">
            <h1 className="font-bold text-white leading-tight">منصات العقارية</h1>
            <p className="text-[10px] text-white/70 uppercase tracking-widest">Smart Assistant</p>
          </div>
        </div>
        
        <button 
          onClick={handleOpenDashboard}
          className="flex items-center gap-1 md:gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-all text-sm md:text-base"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">لوحة التحكم</span>
        </button>
      </header>

      <main className="relative z-10 w-full max-w-4xl flex flex-col items-center gap-6 md:gap-12 pt-20 md:pt-24 pb-24 md:pb-28 px-4">
        <div className="relative flex items-center justify-center">
          <div className={`absolute inset-0 bg-blue-500 rounded-full blur-3xl opacity-40 transition-all duration-1000 ${isRecording ? 'scale-150 animate-pulse' : 'scale-0'}`} />
          <button 
            onClick={toggleSession}
            className={`relative z-10 w-28 h-28 md:w-44 md:h-44 rounded-full flex flex-col items-center justify-center transition-all duration-500 shadow-2xl border-4 ${
              isRecording ? 'bg-blue-600/80 border-white scale-110' : 'bg-white/10 border-white/30 hover:border-white/60 hover:bg-white/20'
            } backdrop-blur-lg group`}
          >
            {isRecording ? (
              <div className="flex gap-1.5 md:gap-2 h-8 md:h-12 items-center">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="w-1 md:w-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s`, height: `${15 + Math.random() * 25}px` }} />
                ))}
              </div>
            ) : (
              <svg className="w-10 h-10 md:w-16 md:h-16 text-white/80 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4z" />
                <path d="M4 8a1 1 0 011-1h1a1 1 0 010 2H5a1 1 0 01-1-1zm10-1a1 1 0 100 2h1a1 1 0 100-2h-1z" />
                <path fillRule="evenodd" d="M3 12a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm5 4a1 1 0 100-2H6a1 1 0 100 2h2z" clipRule="evenodd" />
              </svg>
            )}
            <span className={`mt-2 md:mt-4 text-xs md:text-sm font-bold tracking-wide ${isRecording ? 'text-white' : 'text-white/60'}`}>
              {isRecording ? 'أنا أسمعك..' : 'اضغط للتحدث'}
            </span>
          </button>
        </div>

        <div className="text-center space-y-2 md:space-y-3 px-2">
          <p className="text-blue-400 font-bold tracking-[0.15em] md:tracking-[0.2em] uppercase text-[10px] md:text-xs">AI Real Estate Agent</p>
          <h2 className="text-xl md:text-4xl font-extrabold text-white drop-shadow-lg leading-tight">{statusMessage}</h2>
          <p className="text-white/70 text-xs md:text-base max-w-lg mx-auto leading-relaxed">المساعد الذكي لمنصات العقارية - حلول ذكية، دقة في التقييم، وسرعة في الإنجاز</p>
        </div>
      </main>

      {activeProperty && (
        <div className="fixed bottom-20 md:bottom-10 left-4 md:left-10 z-30">
          <button onClick={() => setShowGallery(true)} className="flex items-center gap-2 md:gap-4 bg-white/10 backdrop-blur-xl px-3 py-2 md:px-6 md:py-4 rounded-2xl md:rounded-3xl shadow-2xl border border-white/20 hover:bg-white/20 transition-all group">
            <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl overflow-hidden border border-white/30">
              <img src={activeProperty.images[0]} alt="Property" className="w-full h-full object-cover" />
            </div>
            <div className="text-right">
              <p className="text-[8px] md:text-[10px] text-blue-400 font-bold uppercase tracking-wider">آخر عقار</p>
              <p className="text-sm md:text-lg font-bold text-white truncate max-w-[120px] md:max-w-none">{activeProperty.title}</p>
            </div>
          </button>
        </div>
      )}

      {showGallery && activeProperty && (
        <ErrorBoundary fallbackTitle="حدث خطأ في عرض الصور" onReset={() => setShowGallery(false)}>
          <Gallery 
            property={activeProperty} 
            onClose={handleCloseGallery}
            onInterested={() => {
              setShowLeadForm(true);
              showLeadFormRef.current = true;
            }}
          />
        </ErrorBoundary>
      )}
      
      {showLeadForm && (
        <ErrorBoundary fallbackTitle="حدث خطأ في نموذج التسجيل" onReset={handleCloseLeadForm}>
          <LeadForm 
            onClose={handleCloseLeadForm} 
            onSubmitSuccess={() => {
              setShowLeadForm(false);
              showLeadFormRef.current = false;
              stopAudioPlayback();
              setStatusMessage("تم استلام طلبك بنجاح");
              setNotification({ message: 'تم إرسال بياناتك بنجاح! سيتواصل معك فريق المبيعات قريباً', type: 'success' });
            }} 
          />
        </ErrorBoundary>
      )}

      <footer className="fixed bottom-0 md:bottom-4 left-0 right-0 text-center text-white/40 text-[8px] md:text-[10px] w-full px-4 md:px-10 py-2 md:py-0 bg-black/30 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none">
        <div className="flex flex-col md:flex-row justify-between items-center gap-1 md:gap-0 max-w-6xl mx-auto">
          <p className="hidden md:block">© 2025 شركة منصات العقارية - الحلول الذكية والتقييم العقاري</p>
          <div className="flex gap-3 md:gap-6 items-center">
            <span className="flex items-center gap-1 md:gap-2">
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse shadow-sm shadow-green-400"></span>
              <span className="hidden sm:inline">Live Session</span>
            </span>
            <a href="https://wa.me/966508404422?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7" target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors">واتساب</a>
          </div>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};

export default App;
