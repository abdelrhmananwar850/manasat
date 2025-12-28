import React, { useState, useEffect } from 'react';
import { getAnalytics, ConversationLog } from '../services/mockApi';

interface PersonaSettings {
  name: string;
  gender: string;
  tone: string;
  language: string;
}

interface LeadData {
  id: string;
  name: string;
  phone: string;
  city: string;
  propertyType: string;
  timestamp: string;
}

// Intent labels in Arabic
const intentLabels: Record<string, string> = {
  greeting: 'ترحيب',
  search: 'بحث عن عقار',
  price_inquiry: 'استفسار عن السعر',
  booking: 'حجز/زيارة',
  info: 'معلومات',
  complaint: 'شكوى',
  other: 'أخرى'
};

// Status labels in Arabic
const statusLabels: Record<string, string> = {
  complete: 'مكتمل',
  interrupted: 'مقاطعة',
  error: 'خطأ',
  session_end: 'انتهاء جلسة'
};

const Dashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'persona' | 'knowledge' | 'inquiries' | 'leads'>('analytics');
  
  // Persona Settings
  const [persona, setPersona] = useState<PersonaSettings>({
    name: 'نورة',
    gender: 'أنثى',
    tone: 'ودود',
    language: 'سعودي مهذب'
  });

  // Knowledge Base
  const [knowledgeBase, setKnowledgeBase] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');

  // Inquiries & Leads
  const [inquiries, setInquiries] = useState<ConversationLog[]>([]);
  const [leads, setLeads] = useState<LeadData[]>([]);
  
  // Analytics
  const [analytics, setAnalytics] = useState<ReturnType<typeof getAnalytics> | null>(null);

  // Load data on mount
  useEffect(() => {
    // Load from localStorage (simulating file read)
    const savedPersona = localStorage.getItem('manasat_persona');
    const savedKB = localStorage.getItem('manasat_knowledge_base');
    const savedPrompt = localStorage.getItem('manasat_system_prompt');
    const savedInquiries = localStorage.getItem('manasat_inquiries');
    const savedLeads = localStorage.getItem('manasat_leads');

    if (savedPersona) setPersona(JSON.parse(savedPersona));
    if (savedKB) setKnowledgeBase(savedKB);
    if (savedPrompt) setSystemPrompt(savedPrompt);
    if (savedInquiries) setInquiries(JSON.parse(savedInquiries));
    if (savedLeads) setLeads(JSON.parse(savedLeads));
    
    // Load analytics
    setAnalytics(getAnalytics());
  }, []);

  const savePersona = () => {
    localStorage.setItem('manasat_persona', JSON.stringify(persona));
    // Dispatch event to notify App component
    window.dispatchEvent(new CustomEvent('personaUpdated', { detail: persona }));
    alert('تم حفظ إعدادات الشخصية ✅\nالتغييرات ستنطبق على الجلسة الصوتية الجديدة');
  };

  const saveKnowledgeBase = () => {
    localStorage.setItem('manasat_knowledge_base', knowledgeBase);
    window.dispatchEvent(new CustomEvent('knowledgeBaseUpdated'));
    alert('تم حفظ قاعدة المعرفة ✅\nالتغييرات ستنطبق على الجلسة الصوتية الجديدة');
  };

  const saveSystemPrompt = () => {
    localStorage.setItem('manasat_system_prompt', systemPrompt);
    window.dispatchEvent(new CustomEvent('systemPromptUpdated'));
    alert('تم حفظ System Prompt ✅\nالتغييرات ستنطبق على الجلسة الصوتية الجديدة');
  };

  const clearInquiries = () => {
    if (confirm('هل أنت متأكد من حذف جميع الاستفسارات؟')) {
      setInquiries([]);
      localStorage.setItem('manasat_inquiries', '[]');
    }
  };

  const exportLeads = () => {
    // Create CSV content (Excel compatible)
    const headers = ['الاسم', 'رقم الجوال', 'المدينة', 'نوع العقار', 'التاريخ'];
    const csvContent = [
      headers.join(','),
      ...leads.map(lead => [
        lead.name,
        lead.phone,
        lead.city,
        lead.propertyType,
        lead.timestamp
      ].join(','))
    ].join('\n');
    
    // Add BOM for Arabic support in Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
              <p className="text-sm text-gray-500">إدارة المساعد الذكي لمنصات العقارية</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            النظام يعمل
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-white p-2 rounded-xl shadow-sm overflow-x-auto">
          {[
            { id: 'analytics', label: 'الإحصائيات', icon: '📊' },
            { id: 'persona', label: 'شخصية البوت', icon: '🤖' },
            { id: 'knowledge', label: 'قاعدة المعرفة', icon: '📚' },
            { id: 'inquiries', label: 'الاستفسارات', icon: '💬' },
            { id: 'leads', label: 'العملاء المحتملين', icon: '👥' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="ml-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Analytics Tab */}
        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 shadow-lg shadow-blue-500/20 transform hover:scale-105 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">إجمالي المحادثات</p>
                    <p className="text-3xl font-bold text-white mt-1">{analytics.totalConversations}</p>
                  </div>
                  <div className="bg-white/20 rounded-xl p-3">
                    <span className="text-2xl">💬</span>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 shadow-lg shadow-emerald-500/20 transform hover:scale-105 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-100 text-sm">عدد الجلسات</p>
                    <p className="text-3xl font-bold text-white mt-1">{analytics.totalSessions}</p>
                  </div>
                  <div className="bg-white/20 rounded-xl p-3">
                    <span className="text-2xl">📊</span>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 shadow-lg shadow-purple-500/20 transform hover:scale-105 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">نسبة التحويل</p>
                    <p className="text-3xl font-bold text-white mt-1">{analytics.conversionRate}</p>
                  </div>
                  <div className="bg-white/20 rounded-xl p-3">
                    <span className="text-2xl">📈</span>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 shadow-lg shadow-orange-500/20 transform hover:scale-105 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm">العملاء المحتملين</p>
                    <p className="text-3xl font-bold text-white mt-1">{leads.length}</p>
                  </div>
                  <div className="bg-white/20 rounded-xl p-3">
                    <span className="text-2xl">👥</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Most Popular */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-6 border border-gray-100">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="bg-blue-100 p-2 rounded-lg">🏠</span> أكثر أنواع العقارات طلباً
                </h3>
                {Object.keys(analytics.propertyTypeCounts).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(analytics.propertyTypeCounts)
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .map(([type, count], index) => (
                        <div key={type} className="flex justify-between items-center bg-gradient-to-r from-blue-50 to-transparent rounded-xl p-4 border border-blue-100 hover:shadow-md transition-all">
                          <div className="flex items-center gap-3">
                            <span className="bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">{index + 1}</span>
                            <span className="font-medium text-gray-800">{type}</span>
                          </div>
                          <span className="bg-blue-500 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">{count}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <span className="text-4xl">📭</span>
                    <p className="text-gray-400 mt-2">لا توجد بيانات</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-6 border border-gray-100">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="bg-green-100 p-2 rounded-lg">📍</span> أكثر المواقع بحثاً
                </h3>
                {Object.keys(analytics.locationCounts).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(analytics.locationCounts)
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .map(([location, count], index) => (
                        <div key={location} className="flex justify-between items-center bg-gradient-to-r from-emerald-50 to-transparent rounded-xl p-4 border border-emerald-100 hover:shadow-md transition-all">
                          <div className="flex items-center gap-3">
                            <span className="bg-emerald-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">{index + 1}</span>
                            <span className="font-medium text-gray-800">{location}</span>
                          </div>
                          <span className="bg-emerald-500 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">{count}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <span className="text-4xl">📭</span>
                    <p className="text-gray-400 mt-2">لا توجد بيانات</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status Distribution */}
            <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-6 border border-gray-100">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="bg-purple-100 p-2 rounded-lg">📈</span> حالة المحادثات
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(analytics.statusCounts).map(([status, count]) => {
                  const statusStyles: Record<string, string> = {
                    complete: 'from-emerald-400 to-emerald-500 shadow-emerald-500/30',
                    interrupted: 'from-amber-400 to-amber-500 shadow-amber-500/30',
                    error: 'from-red-400 to-red-500 shadow-red-500/30',
                    session_end: 'from-slate-400 to-slate-500 shadow-slate-500/30'
                  };
                  return (
                    <div key={status} className={`bg-gradient-to-br ${statusStyles[status] || 'from-gray-400 to-gray-500'} rounded-xl p-4 text-center shadow-lg transform hover:scale-105 transition-all`}>
                      <p className="text-3xl font-bold text-white">{count}</p>
                      <p className="text-sm text-white/80 mt-1">{statusLabels[status] || status}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Persona Tab */}
        {activeTab === 'persona' && (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              إعدادات شخصية المساعد
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">اسم المساعد</label>
                <input
                  type="text"
                  value={persona.name}
                  onChange={e => setPersona({...persona, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="مثال: نورة"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الجنس</label>
                <select
                  value={persona.gender}
                  onChange={e => setPersona({...persona, gender: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="أنثى">أنثى</option>
                  <option value="ذكر">ذكر</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">أسلوب الكلام</label>
                <select
                  value={persona.tone}
                  onChange={e => setPersona({...persona, tone: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="ودود">ودود</option>
                  <option value="رسمي">رسمي</option>
                  <option value="حازم">حازم</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">اللهجة</label>
                <select
                  value={persona.language}
                  onChange={e => setPersona({...persona, language: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="سعودي مهذب">سعودي مهذب</option>
                  <option value="فصحى">فصحى</option>
                  <option value="خليجي">خليجي</option>
                </select>
              </div>
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-xl">
              <h3 className="font-medium text-blue-900 mb-2">معاينة الشخصية:</h3>
              <p className="text-blue-700">
                {persona.gender === 'أنثى' ? 'أنا' : 'أنا'} {persona.name}، مساعد{persona.gender === 'أنثى' ? 'ة' : ''} عقاري{persona.gender === 'أنثى' ? 'ة' : ''} {persona.tone} من شركة منصات العقارية.
              </p>
            </div>

            <button
              onClick={savePersona}
              className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all"
            >
              حفظ الإعدادات
            </button>
          </div>
        )}

        {/* Knowledge Base Tab */}
        {activeTab === 'knowledge' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-8">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="text-2xl">📚</span>
                قاعدة المعرفة (Knowledge Base)
              </h2>
              <p className="text-gray-500 mb-4">المعلومات التي يعتمد عليها المساعد للرد على العملاء</p>
              
              <textarea
                value={knowledgeBase}
                onChange={e => setKnowledgeBase(e.target.value)}
                className="w-full h-80 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                placeholder="أدخل معلومات الشركة والعقارات هنا..."
                dir="rtl"
              />

              <button
                onClick={saveKnowledgeBase}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all"
              >
                حفظ قاعدة المعرفة
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-8">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="text-2xl">⚙️</span>
                System Prompt
              </h2>
              <p className="text-gray-500 mb-4">التعليمات الأساسية للمساعد (الشخصية، القواعد، الممنوعات)</p>
              
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                className="w-full h-80 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                placeholder="أدخل System Prompt هنا..."
                dir="rtl"
              />

              <button
                onClick={saveSystemPrompt}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl transition-all"
              >
                حفظ System Prompt
              </button>
            </div>
          </div>
        )}

        {/* Inquiries Tab */}
        {activeTab === 'inquiries' && (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">💬</span>
                سجل الاستفسارات
              </h2>
              <button
                onClick={clearInquiries}
                className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-all"
              >
                مسح الكل
              </button>
            </div>

            {inquiries.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <span className="text-4xl">📭</span>
                <p className="mt-2">لا توجد استفسارات مسجلة</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {[...inquiries].reverse().map(inq => (
                  <div key={inq.id} className="border rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs text-gray-400">{inq.timestamp}</div>
                      <div className="flex gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          inq.intent === 'search' ? 'bg-blue-100 text-blue-700' :
                          inq.intent === 'price_inquiry' ? 'bg-purple-100 text-purple-700' :
                          inq.intent === 'greeting' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {intentLabels[inq.intent] || inq.intent}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          inq.status === 'complete' ? 'bg-green-100 text-green-700' :
                          inq.status === 'interrupted' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {statusLabels[inq.status] || inq.status}
                        </span>
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 mb-2">
                      <span className="text-xs text-blue-600 font-medium">العميل:</span>
                      <p className="text-gray-800">{inq.userMessage}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <span className="text-xs text-gray-600 font-medium">المساعد:</span>
                      <p className="text-gray-800">{inq.botResponse}</p>
                    </div>
                    {(inq.propertyType || inq.location || inq.toolsUsed?.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {inq.propertyType && (
                          <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded">🏠 {inq.propertyType}</span>
                        )}
                        {inq.location && (
                          <span className="bg-teal-100 text-teal-700 px-2 py-1 rounded">📍 {inq.location}</span>
                        )}
                        {inq.toolsUsed?.map((tool, i) => (
                          <span key={i} className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded">🔧 {tool}</span>
                        ))}
                        {inq.duration && (
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">⏱️ {(inq.duration / 1000).toFixed(1)}s</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">👥</span>
                العملاء المحتملين ({leads.length})
              </h2>
              <button
                onClick={exportLeads}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                تصدير Excel
              </button>
            </div>

            {leads.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <span className="text-4xl">👤</span>
                <p className="mt-2">لا يوجد عملاء محتملين</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">الاسم</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">الجوال</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">المدينة</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">نوع العقار</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">التاريخ</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leads.map(lead => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{lead.name}</td>
                        <td className="px-4 py-3">{lead.phone}</td>
                        <td className="px-4 py-3">{lead.city}</td>
                        <td className="px-4 py-3">{lead.propertyType}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{lead.timestamp}</td>
                        <td className="px-4 py-3">
                          <a
                            href={`https://wa.me/966${lead.phone.replace(/^0/, '')}?text=${encodeURIComponent(`مرحباً ${lead.name}، تواصل معك من منصات العقارية بخصوص طلبك لـ ${lead.propertyType} في ${lead.city}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-700"
                          >
                            واتساب
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
