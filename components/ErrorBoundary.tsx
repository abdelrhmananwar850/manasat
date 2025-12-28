/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🛡️ Error Boundary caught:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    
    try {
      const errorLog = JSON.parse(localStorage.getItem('manasat_error_log') || '[]');
      errorLog.push({
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
      localStorage.setItem('manasat_error_log', JSON.stringify(errorLog.slice(-20)));
    } catch {
      // Ignore localStorage errors
    }
  }

  handleReset = () => {
    (this as any).setState({ hasError: false, error: null });
    const onReset = (this as any).props.onReset;
    if (onReset) onReset();
  };

  render(): React.ReactNode {
    const state = (this as any).state as State;
    const props = (this as any).props as Props;
    
    if (state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {props.fallbackTitle || 'حدث خطأ غير متوقع'}
            </h3>
            
            <p className="text-gray-500 mb-6 text-sm">
              لا تقلق، باقي التطبيق يعمل بشكل طبيعي
            </p>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-xl transition-all"
              >
                حاول مرة أخرى
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-6 rounded-xl transition-all"
              >
                تحديث الصفحة
              </button>
            </div>
            
            {state.error && (
              <details className="mt-4 text-left">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                  تفاصيل تقنية
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs text-red-600 overflow-auto max-h-32" dir="ltr">
                  {state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return props.children;
  }
}

export default ErrorBoundary;
