import { ChevronLeft, Settings as SettingsIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();

  const getHeaderTitle = () => {
    switch (location.pathname) {
      case "/": return "Hello, Jason!";
      case "/invoices": return "Invoices";
      case "/clients": return "Clients";
      case "/settings": return "Settings";
      case "/tasks": return "Tasks";
      case "/calendar": return "Calendar";
      default: return "ConstructionOS";
    }
  };

  const isHome = location.pathname === "/";

  return (
    <header className="absolute top-0 left-0 right-0 h-24 bg-white/80 backdrop-blur-md flex flex-col justify-end px-6 pb-4 z-50 border-b border-slate-100/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          {!isHome ? (
            <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-slate-500 hover:text-slate-800 transition-colors">
              <ChevronLeft size={24} />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
              <img src="https://i.pravatar.cc/150?u=jason" alt="Profile" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
              <span className="text-xs font-bold text-slate-500">JP</span>
            </div>
          )}
          <h1 className="text-xl font-bold tracking-tight text-slate-900 truncate">{getHeaderTitle()}</h1>
        </div>
        <button onClick={() => navigate("/settings")} className="p-2 text-slate-400 hover:text-slate-600">
          <SettingsIcon size={24} />
        </button>
      </div>
    </header>
  );
}
