import InvoiceCard from "../components/ui/InvoiceCard";
import EmptyState from "../components/ui/EmptyState";
import { useApp } from "../context/AppContext";

export default function Invoices() {
  const { invoices } = useApp();

  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">All Invoices</h2>
      {invoices.map(inv => <InvoiceCard key={inv.id} invoice={inv} />)}
      {invoices.length === 0 && <EmptyState message="No invoices found." />}
    </div>
  );
}
