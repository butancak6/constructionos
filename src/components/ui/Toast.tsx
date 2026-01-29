import { CheckCircle2, AlertCircle } from "lucide-react";

interface ToastProps {
  message: string;
  type: 'success' | 'error';
}

export default function Toast({ message, type }: ToastProps) {
  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top fade-in duration-300 pointer-events-none">
      <div className={`px-4 py-3 rounded-full shadow-xl flex items-center gap-2 border ${
          type === 'success' ? 'bg-white border-green-200 text-green-700' : 'bg-white border-red-200 text-red-600'
      }`}>
          {type === 'success' ? <CheckCircle2 size={18} className="text-green-500" /> : <AlertCircle size={18} className="text-red-500" />}
          <span className="font-bold text-sm">{message}</span>
      </div>
    </div>
  );
}
