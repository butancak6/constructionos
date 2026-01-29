import { CheckCircle2, Trash2 } from "lucide-react";
import { Task } from "../../types";
import { useApp } from "../../context/AppContext";

export default function TaskCard({ task }: { task: Task }) {
  const { setTasks, showToast } = useApp();

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 flex items-center gap-4 group">
      <button
        onClick={() => {
           setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t));
        }}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors active:scale-95 ${
          task.done ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'
        }`}
      >
        {task.done && <CheckCircle2 size={14} />}
      </button>

      <div className="flex-1">
        <p className={`font-bold text-sm ${task.done ? 'line-through text-slate-400' : 'text-slate-900'}`}>
          {task.description}
        </p>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
          task.priority === 'High' ? 'bg-red-100 text-red-600' :
          task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
          'bg-blue-100 text-blue-600'
        }`}>
          {task.priority}
        </span>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          // Ideally use a better confirm dialog, but window.confirm is fine for now
          if(confirm("Delete this task?")) {
             setTasks(prev => prev.filter(t => t.id !== task.id));
             showToast("Task Deleted", "success");
          }
        }}
        className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity active:scale-95"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
