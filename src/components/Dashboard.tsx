import {
  Moon,
  Bell,
  Hourglass,
  FileText,
  Clock,
  XCircle,
  ChevronRight,
  Wifi,
  Signal,
  Battery
} from "lucide-react";

// Types (mirrored from App.tsx for now)
export interface Invoice {
  id: string;
  client: string;
  amount: number;
  status: string;
  items: any[];
  description: string;
  client_phone?: string;
  client_company?: string;
  pdf_path?: string | null;
  intent?: string;
  created_at?: string;
  date?: string;
}

export interface Task {
  id: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  done: boolean;
  due_date?: string | null;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  company?: string;
}

export interface FinancialSummary {
  revenue: number;
  expenses: number;
  profit: number;
}

interface DashboardProps {
  invoices: Invoice[];
  tasks: Task[];
  financials: FinancialSummary;
  clients: Client[];
  userName?: string;
}

export default function Dashboard({ invoices, tasks, financials, clients, userName = "Jason" }: DashboardProps) {

  // Computed Stats
  const outstandingCount = invoices.filter(i => i.status !== "PAID").length;
  const paidCount = invoices.filter(i => i.status === "PAID").length;
  const overdueCount = invoices.filter(i => i.status === "OVERDUE").length;
  const unapprovedCount = invoices.filter(i => i.status === "UNAPPROVED" || i.status === "draft").length;

  const unpaidInvoices = invoices.filter(i => i.status !== "PAID");

  // This Month Stats (Mock logic for now as we don't have date filtering strictly enforced yet in props)
  const paidAmount = invoices.filter(i => i.status === "PAID").reduce((sum, inv) => sum + inv.amount, 0);
  const unpaidAmount = invoices.filter(i => i.status !== "PAID").reduce((sum, inv) => sum + inv.amount, 0);
  const totalAmount = paidAmount + unpaidAmount || 1; // Avoid div by zero

  const completedTasks = tasks.filter(t => t.done).length;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-background-dark relative">

      {/* Top Status Bar (Simulated) */}
      <div className="h-12 flex items-center justify-between px-8 pt-4 bg-primary text-white relative z-10 shrink-0">
        <span className="text-sm font-semibold">9:41</span>
        <div className="flex items-center gap-1.5">
          <Signal size={18} />
          <Wifi size={18} />
          <Battery size={18} />
        </div>
      </div>

      {/* Header */}
      <header className="bg-primary pt-4 pb-8 px-6 rounded-b-[32px] relative shrink-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-white/30 overflow-hidden bg-white/20">
              <img
                alt="User Avatar"
                className="w-full h-full object-cover"
                src="https://i.pravatar.cc/150?u=jason"
              />
            </div>
            <div>
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-wider">GOOD MORNING</p>
              <h1 className="text-white text-2xl font-bold">Hello, {userName}!</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md transition-colors hover:bg-white/20" onClick={() => document.documentElement.classList.toggle('dark')}>
              <Moon size={20} />
            </button>
            <button className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-md transition-colors hover:bg-white/30">
              <Bell size={20} />
            </button>
          </div>
        </div>
        <div className="mt-6">
          <p className="text-white/70 text-sm mb-1 font-medium">Total Invoices</p>
          <div className="flex items-baseline gap-2">
            <span className="text-white text-4xl font-extrabold tracking-tight">{invoices.length} Invoices</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pb-36 overflow-y-auto hide-scrollbar relative bg-white dark:bg-[#000000] pt-6">

        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">

          {/* Outstanding */}
          <div className="bg-primary/95 dark:bg-primary p-4 rounded-3xl shadow-lg relative overflow-hidden h-[110px] group">
            <p className="text-white/80 text-xs font-semibold">Outstanding</p>
            <p className="text-white text-3xl font-bold mt-2">{outstandingCount.toString().padStart(2, '0')}</p>
            <Hourglass className="absolute -bottom-1 -right-2 text-white/10 w-16 h-16 rotate-12 transition-transform group-hover:scale-110" />
          </div>

          {/* Paid Invoices */}
          <div className="bg-[#1E4D9C] p-4 rounded-3xl shadow-lg relative overflow-hidden h-[110px] group">
            <p className="text-white/80 text-xs font-semibold">Paid Invoices</p>
            <p className="text-white text-3xl font-bold mt-2">{paidCount.toString().padStart(2, '0')}</p>
            <FileText className="absolute -bottom-1 -right-2 text-white/10 w-16 h-16 -rotate-12 transition-transform group-hover:scale-110" />
          </div>

          {/* Overdue Invoices */}
          <div className="bg-[#4176CE] p-4 rounded-3xl shadow-lg relative overflow-hidden h-[110px] group">
            <p className="text-white/80 text-xs font-semibold">Overdue Invoices</p>
            <p className="text-white text-3xl font-bold mt-2">{overdueCount.toString().padStart(2, '0')}</p>
            <Clock className="absolute -bottom-1 -right-2 text-white/10 w-16 h-16 transition-transform group-hover:scale-110" />
          </div>

          {/* Unapproved */}
          <div className="bg-[#2B5EB1] p-4 rounded-3xl shadow-lg relative overflow-hidden h-[110px] group">
            <p className="text-white/80 text-xs font-semibold">Unapproved</p>
            <p className="text-white text-3xl font-bold mt-2">{unapprovedCount.toString().padStart(2, '0')}</p>
            <XCircle className="absolute -bottom-1 -right-2 text-white/10 w-16 h-16 transition-transform group-hover:scale-110" />
          </div>
        </div>

        {/* Unpaid Invoices Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between px-2 mb-4">
            <h2 className="text-xl font-bold dark:text-white text-slate-900">Unpaid Invoices</h2>
            <button className="text-primary text-sm font-bold hover:opacity-80">View All</button>
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar px-2 pb-2">
            {unpaidInvoices.length > 0 ? unpaidInvoices.map((inv) => (
              <div key={inv.id} className="min-w-[280px] bg-white dark:bg-card-dark p-5 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm active:scale-95 transition-transform">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                     <span className="text-lg font-bold text-slate-400">{inv.client.substring(0,2).toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-base dark:text-white leading-tight text-slate-900 truncate max-w-[160px]">{inv.client}</h3>
                    <p className="text-xs text-rose-500 font-bold mt-0.5">{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : 'No Date'}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-extrabold dark:text-white text-slate-900">${inv.amount.toLocaleString()}</span>
                  <span className="px-3 py-1.5 bg-slate-100 dark:bg-white/10 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter">Outstanding</span>
                </div>
              </div>
            )) : (
              <div className="min-w-[280px] bg-slate-50 p-5 rounded-3xl border border-dashed border-slate-200 flex items-center justify-center text-slate-400 font-medium">
                No unpaid invoices
              </div>
            )}
          </div>
        </section>

        {/* This Month Section */}
        <section className="px-2">
          <h2 className="text-xl font-bold mb-4 dark:text-white text-slate-900">This Month</h2>
          <div className="bg-white dark:bg-card-dark rounded-3xl p-6 border border-slate-100 dark:border-white/5 shadow-sm mb-4">
            <div className="flex justify-between gap-6 mb-8">
              <div className="flex-1">
                <p className="text-xs text-slate-500 font-bold mb-2">Paid Invoices</p>
                <p className="text-xl font-extrabold text-emerald-500">${paidAmount.toLocaleString()}</p>
                <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(paidAmount / totalAmount) * 100}%` }}></div>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500 font-bold mb-2">Unpaid Invoices</p>
                <p className="text-xl font-extrabold text-rose-500">${unpaidAmount.toLocaleString()}</p>
                <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(unpaidAmount / totalAmount) * 100}%` }}></div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-5 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span className="text-sm font-bold text-slate-500">{completedTasks} Completed Tasks</span>
              </div>
              <ChevronRight className="text-slate-300" size={20} />
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
