import { Calendar } from "lucide-react";
import { CalendarEvent } from "../../types";

export default function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 flex items-center gap-4">
      <div className="bg-orange-50 text-orange-600 p-3 rounded-xl">
        <Calendar size={20} />
      </div>
      <div>
        <p className="font-bold text-slate-900">{event.title}</p>
        <p className="text-sm text-slate-500">{new Date(event.start_time).toLocaleString()} ({event.duration_minutes}m)</p>
      </div>
    </div>
  );
}
