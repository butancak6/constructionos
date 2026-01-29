import { X } from "lucide-react";
import { useApp } from "../../context/AppContext";

export default function VoiceOverlay() {
  const { stopRecordingFlow } = useApp();

  return (
    <div className="absolute inset-0 z-[60] bg-gradient-to-b from-blue-600 to-blue-500 flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="absolute top-12 right-6 z-20">
        <button onClick={() => stopRecordingFlow()} className="text-white/60 hover:text-white p-2 bg-white/10 rounded-full backdrop-blur-md"><X size={24} /></button>
      </div>

      <div className="relative mb-12">
        <div className="absolute inset-0 bg-white/20 rounded-full animate-ping blur-md"></div>
        <div className="absolute inset-0 bg-white/20 rounded-full animate-ping delay-150 blur-sm"></div>
        <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-2xl relative z-10">
          <div className="text-blue-600">
            <div className="flex gap-1 h-8 items-center justify-center">
              <div className="w-1.5 bg-blue-600 rounded-full animate-[bounce_1s_infinite] h-4"></div>
              <div className="w-1.5 bg-blue-600 rounded-full animate-[bounce_1s_infinite_100ms] h-8"></div>
              <div className="w-1.5 bg-blue-600 rounded-full animate-[bounce_1s_infinite_200ms] h-6"></div>
              <div className="w-1.5 bg-blue-600 rounded-full animate-[bounce_1s_infinite_150ms] h-8"></div>
              <div className="w-1.5 bg-blue-600 rounded-full animate-[bounce_1s_infinite_50ms] h-5"></div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Smart Invoicing</h2>
      <p className="text-blue-100 text-lg mb-8 font-medium">Speak your invoice...</p>

      <div className="w-[90%] bg-white/10 backdrop-blur-md rounded-3xl p-6 text-white text-center border border-white/20 shadow-inner">
        <p className="italic opacity-80 leading-relaxed">"Invoice Jason Park for HVAC installation, 5 hours..."</p>
      </div>

      <button onClick={() => stopRecordingFlow()} className="mt-12 bg-white text-blue-600 px-8 py-4 rounded-full font-bold shadow-xl hover:scale-105 transition-transform active:scale-95">
        Stop Recording
      </button>
    </div>
  );
}
