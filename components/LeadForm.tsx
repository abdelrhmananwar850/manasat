
import React, { useState } from 'react';
import { LeadData } from '../types';
import { submitLead } from '../services/mockApi';

interface LeadFormProps {
  onClose: () => void;
  onSubmitSuccess: () => void;
}

const LeadForm: React.FC<LeadFormProps> = ({ onClose, onSubmitSuccess }) => {
  const [formData, setFormData] = useState<LeadData>({
    name: '',
    phone: '',
    city: '',
    propertyType: 'فيلا'
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await submitLead(formData);
    if (success) {
      setSubmitted(true);
    }
    setLoading(false);
  };

  // Success screen with WhatsApp button
  if (submitted) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-center p-6 md:p-8">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
            <svg className="w-8 h-8 md:w-10 md:h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">تم استلام طلبك بنجاح!</h3>
          <p className="text-gray-500 text-sm md:text-base mb-4 md:mb-6">سيتواصل معك فريق المبيعات قريباً</p>
          
          <a
            href="https://wa.me/966508404422?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D8%8C%20%D8%A3%D8%A8%D9%8A%20%D8%A3%D8%B3%D8%AA%D9%81%D8%B3%D8%B1%20%D8%B9%D9%86%20%D8%B9%D9%82%D8%A7%D8%B1"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 md:py-4 rounded-xl transition-all flex items-center justify-center gap-2 md:gap-3 mb-3 text-sm md:text-base"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            التواصل عبر واتساب
          </a>
          
          <button
            onClick={onSubmitSuccess}
            className="w-full py-2 md:py-3 text-gray-500 hover:text-gray-700 transition-colors text-sm md:text-base"
          >
            إغلاق
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="bg-blue-600 p-4 md:p-6 text-white text-center">
          <h3 className="text-lg md:text-xl font-bold">تسجيل طلب اهتمام</h3>
          <p className="text-blue-100 text-xs md:text-sm mt-1">سيقوم فريق المبيعات بالتواصل معك فوراً</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 md:p-8 space-y-3 md:space-y-4">
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">الاسم الكامل</label>
            <input
              required
              type="text"
              className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm md:text-base"
              placeholder="مثال: محمد الشمري"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">رقم الجوال</label>
            <input
              required
              type="tel"
              className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm md:text-base"
              placeholder="05xxxxxxxx"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">المدينة</label>
              <select 
                className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border border-gray-200 outline-none transition-all text-sm md:text-base"
                value={formData.city}
                onChange={e => setFormData({...formData, city: e.target.value})}
              >
                <option value="">اختر</option>
                <option value="الرياض">الرياض</option>
                <option value="جدة">جدة</option>
                <option value="الشرقية">الشرقية</option>
              </select>
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">نوع العقار</label>
              <select 
                className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border border-gray-200 outline-none transition-all text-sm md:text-base"
                value={formData.propertyType}
                onChange={e => setFormData({...formData, propertyType: e.target.value})}
              >
                <option value="فيلا">فيلا</option>
                <option value="شقة">شقة</option>
                <option value="أرض">أرض</option>
                <option value="تجاري">تجاري</option>
              </select>
            </div>
          </div>

          <div className="pt-3 md:pt-4 flex gap-2 md:gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 md:py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm md:text-base"
            >
              {loading ? 'جاري الإرسال...' : 'إرسال الطلب'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 md:px-6 py-2.5 md:py-3 rounded-xl border border-gray-200 font-semibold text-gray-600 hover:bg-gray-50 transition-all text-sm md:text-base"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeadForm;
