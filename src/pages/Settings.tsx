import { Trash2 } from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <h2 className="text-2xl font-black text-slate-900 mb-4">Settings</h2>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200">
            <h3 className="font-bold text-slate-900 mb-2">App Info</h3>
            <div className="flex justify-between py-2 border-b border-stone-100">
                <span className="text-slate-500">Version</span>
                <span className="font-medium">v0.2.0 (Alpha)</span>
            </div>
            <div className="flex justify-between py-2">
                <span className="text-slate-500">Build</span>
                <span className="font-medium">Production</span>
            </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200">
            <h3 className="font-bold text-slate-900 mb-2">Data Management</h3>
            <button
                onClick={() => {
                    if(confirm("Clear all local data? This cannot be undone.")) {
                        localStorage.clear();
                        window.location.reload();
                    }
                }}
                className="w-full py-3 text-red-600 font-bold bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2 active:scale-95"
            >
                <Trash2 size={18} />
                Clear All Data
            </button>
        </div>
    </div>
  );
}
