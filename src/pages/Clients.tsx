import ClientCard from "../components/ui/ClientCard";
import EmptyState from "../components/ui/EmptyState";
import { useApp } from "../context/AppContext";

export default function Clients() {
  const { clients } = useApp();

  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Client List</h2>
      {clients.map(c => <ClientCard key={c.id} client={c} />)}
      {clients.length === 0 && <EmptyState message="No clients saved." />}
    </div>
  );
}
