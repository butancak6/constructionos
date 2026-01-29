import { Brain, Loader2 } from "lucide-react";

export default function ThinkingOverlay() {
  return (
    <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-purple-500/30 rounded-full animate-ping blur-xl"></div>
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl relative z-10">
            <Brain size={48} className="text-purple-600 animate-pulse" />
        </div>
        <div className="absolute -bottom-2 -right-2 bg-purple-600 text-white p-2 rounded-full border-4 border-white shadow-lg animate-bounce">
          <Loader2 size={16} className="animate-spin" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Thinking...</h2>
      <p className="text-white/60 text-sm font-medium animate-pulse">Analyzing your request</p>
    </div>
  );
}
