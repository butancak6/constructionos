import TaskCard from "../components/ui/TaskCard";
import EmptyState from "../components/ui/EmptyState";
import { useApp } from "../context/AppContext";

export default function Tasks() {
  const { tasks } = useApp();

  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">My Tasks</h2>
      {tasks.map(t => <TaskCard key={t.id} task={t} />)}
      {tasks.length === 0 && <EmptyState message="No active tasks." />}
    </div>
  );
}
