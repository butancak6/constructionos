import { Users, Phone, Trash2 } from "lucide-react";
import { Client } from "../../types";
import { useApp } from "../../context/AppContext";

export default function ClientCard({ client }: { client: Client }) {
  const { setClients, showToast } = useApp();

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 flex items-center gap-4 group">
      <div className="bg-pink-50 text-pink-600 p-3 rounded-full">
        <Users size={20} />
      </div>
      <div className="flex-1">
        <p className="font-bold text-slate-900">{client.name}</p>
        <p className="text-sm text-slate-500 flex items-center gap-1"><Phone size={12} /> {client.phone || "No Phone"}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if(confirm("Delete this client?")) {
             setClients(prev => prev.filter(c => c.id !== client.id));
             showToast("Client Deleted", "success");
          }
        }}
        className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity active:scale-95"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
