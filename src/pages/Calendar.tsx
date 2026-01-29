import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "../context/AppContext";
import TaskCard from "../components/ui/TaskCard";
import InvoiceCard from "../components/ui/InvoiceCard";
import EventCard from "../components/ui/EventCard";

export default function Calendar() {
  const { calendarEvents, tasks, invoices } = useApp();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  const getDayItems = (day: number) => {
    // Pad month/day with 0 if needed for string comparison, or rely on Date objects.
    // App.tsx relied on string startsWith on ISO string.
    // ISO string is YYYY-MM-DD...
    // new Date(year, month, day).toISOString().split('T')[0] works correctly for local -> UTC if logic matches.
    // Wait, ISO string is UTC. App.tsx logic:
    // const dateStr = new Date(year, month, day).toISOString().split('T')[0];
    // This creates a date in local time, then converts to ISO (UTC).
    // If the event strings are stored in ISO, this comparison is correct if both are UTC or both logic matches.
    // Let's assume consistent logic from App.tsx.

    // Actually, new Date(year, month, day) creates local midnight. .toISOString() converts to UTC.
    // If events are stored as new Date().toISOString() (which is UTC), then we are comparing UTC dates.
    // However, if I select "today" in local time, it might overlap differently in UTC.
    // But since I'm refactoring, I'll stick to the exact logic from App.tsx to avoid regressions.

    const dateObj = new Date(year, month, day);
    // Adjust for timezone offset to ensure the date string matches the local day "start" if that was the intent,
    // or just use the same logic:
    const dateStr = dateObj.toISOString().split('T')[0];

    const evts = calendarEvents.filter(e => e.start_time.startsWith(dateStr));
    const tsks = tasks.filter(t => t.due_date && t.due_date.startsWith(dateStr)).map(t => ({ ...t, type: 'task' as const }));
    const invs = invoices.filter(i => i.created_at && i.created_at.startsWith(dateStr)).map(i => ({ ...i, type: 'invoice' as const }));
    return [...evts, ...tsks, ...invs];
  };

  const getSelectedItems = () => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const evts = calendarEvents.filter(e => e.start_time.startsWith(dateStr));
    const tsks = tasks.filter(t => t.due_date && t.due_date.startsWith(dateStr)).map(t => ({ ...t, type: 'task' as const }));
    const invs = invoices.filter(i => i.created_at && i.created_at.startsWith(dateStr)).map(i => ({ ...i, type: 'invoice' as const }));
    return [...evts, ...tsks, ...invs];
  };

  const selectedItems = getSelectedItems();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-2">
        <button onClick={prevMonth} className="p-2 text-slate-400 hover:text-slate-800 active:scale-95 transition-transform"><ChevronLeft size={24} /></button>
        <h2 className="text-xl font-bold text-slate-800">{monthNames[month]} {year}</h2>
        <button onClick={nextMonth} className="p-2 text-slate-400 hover:text-slate-800 active:scale-95 transition-transform"><ChevronRight size={24} /></button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["S", "M", "T", "W", "T", "F", "S"].map(d => (
            <div key={d} className="text-center text-xs font-bold text-slate-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {blanks.map(x => <div key={`blank-${x}`} className="h-14"></div>)}
          {days.map(day => {
            const date = new Date(year, month, day);
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());
            const items = getDayItems(day);
            const hasItems = items.length > 0;

            return (
              <div
                key={day}
                onClick={() => setSelectedDate(date)}
                className={`h-14 rounded-xl flex flex-col items-center justify-start pt-2 text-sm font-medium cursor-pointer relative transition-all border border-transparent
                  ${isSelected ? 'bg-primary text-white shadow-md scale-105 z-10' : 'hover:bg-slate-50 text-slate-700'}
                  ${isToday && !isSelected ? 'border-primary text-primary' : ''}
                  ${hasItems && !isSelected ? 'bg-slate-50/50' : ''}
                `}
              >
                <span className="leading-none">{day}</span>
                <div className="flex flex-col gap-0.5 mt-1 w-full px-1">
                  {items.slice(0, 2).map((item: any, idx) => {
                     let bgClass = "bg-indigo-100";
                     if (item.type === 'invoice') bgClass = "bg-blue-100";
                     if (item.type === 'task') bgClass = "bg-green-100";
                     return (
                       <div key={idx} className={`h-1.5 w-full rounded-full ${bgClass} ${isSelected ? 'bg-white/30' : ''}`} />
                     );
                  })}
                  {items.length > 2 && (
                      <div className={`h-1.5 w-1.5 rounded-full mx-auto bg-slate-300 ${isSelected ? 'bg-white/50' : ''}`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Schedule */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-3 px-2">
          Schedule for {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </h3>
        <div className="space-y-3">
          {selectedItems.map((item: any) => {
            if (item.type === 'task') return <TaskCard key={item.id} task={item} />;
            if (item.type === 'invoice') return <InvoiceCard key={item.id} invoice={item} />;
            return <EventCard key={item.id} event={item} />;
          })}
          {selectedItems.length === 0 && (
            <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border-dashed border-2 border-slate-200">
              No events for this day
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
