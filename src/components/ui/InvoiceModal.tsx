import { X } from "lucide-react";
import { useApp } from "../../context/AppContext";

export default function InvoiceModal() {
  const { draft, setDraft, handleApproveInvoice, isSaving } = useApp();

  if (!draft || draft.intent !== "INVOICE") return null;

  return (
    <div className="absolute inset-0 z-[100] bg-white animate-in slide-in-from-bottom duration-300 flex flex-col">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md">
        <h2 className="text-xl font-bold text-slate-800">New Invoice</h2>
        <button onClick={() => setDraft(null)} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-full active:scale-95"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Client</label>
          <input
            className="w-full text-2xl font-bold text-slate-800 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none pb-2 transition-colors placeholder:text-slate-300"
            value={draft.client}
            onChange={e => setDraft({ ...draft, client: e.target.value })}
            placeholder="Client Name"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Amount</label>
            <div className="relative">
              <span className="absolute left-0 top-1 text-xl font-bold text-slate-400">$</span>
              <input
                type="number"
                className="w-full text-2xl font-bold text-slate-800 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none pb-2 pl-6 transition-colors"
                value={draft.amount}
                onChange={e => setDraft({ ...draft, amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Date</label>
            <input
              type="date"
              className="w-full text-lg font-medium text-slate-800 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none pb-2 transition-colors"
              value={draft.created_at ? draft.created_at.split('T')[0] : ''}
              onChange={e => setDraft({ ...draft, created_at: new Date(e.target.value).toISOString() })}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Description</label>
          <textarea
            className="w-full h-32 text-lg text-slate-600 bg-slate-50 rounded-xl p-4 border border-slate-100 focus:border-blue-500 outline-none resize-none transition-all"
            value={draft.description}
            onChange={e => setDraft({ ...draft, description: e.target.value })}
            placeholder="Itemize services here..."
          />
        </div>

        <div className="pt-4">
          <button
            onClick={handleApproveInvoice}
            disabled={isSaving}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Processing...
              </>
            ) : (
              <>Save & Send Invoice</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
