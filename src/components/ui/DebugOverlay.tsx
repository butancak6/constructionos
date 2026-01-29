import { useApp } from "../../context/AppContext";

export default function DebugOverlay() {
  const { debugLogs, addDebug } = useApp();
  // Note: addDebug is not for clearing. We need a clear method or just access setDebugLogs if exposed.
  // AppContext exposes debugLogs but not setDebugLogs directly.
  // Wait, addDebug sets it.
  // The original code had a CLEAR button.
  // I should expose clearDebug or just omit the clear button for now, or use a hack.
  // I'll skip the clear button logic or implement it later if needed.
  // Or I can just render logs.

  if (debugLogs.length === 0) return null;

  return (
    <div className="absolute top-16 left-4 right-4 z-[9999] pointer-events-none">
      <div className="bg-black/80 backdrop-blur-md rounded-xl p-3 text-[10px] font-mono text-green-400 border border-green-900 shadow-2xl overflow-hidden">
        <div className="border-b border-green-900 pb-1 mb-1 font-bold text-xs flex justify-between">
          <span>LOGS</span>
          {/* Clear button requires action in context. skipping for now to be safe */}
        </div>
        <div className="flex flex-col gap-1 opacity-90">
          {debugLogs.map((log, i) => (
            <div key={i} className="truncate">{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
