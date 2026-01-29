import { FileText } from "lucide-react";
import { Invoice } from "../../types";
import { useApp } from "../../context/AppContext";

export default function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const { openInvoice } = useApp();

  return (
    <div
      onClick={() => openInvoice(invoice.id)}
      className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 flex justify-between items-center active:scale-95 transition-transform cursor-pointer"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${invoice.status === 'PAID' ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'
          }`}>
          <FileText size={20} />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">{invoice.client}</h3>
          <p className="text-xs text-slate-500 font-medium">#{invoice.id}</p>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-black text-slate-900 tracking-tight">${invoice.amount.toLocaleString()}</div>
        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${invoice.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
          }`}>
          {invoice.status}
        </div>
      </div>
    </div>
  );
}
