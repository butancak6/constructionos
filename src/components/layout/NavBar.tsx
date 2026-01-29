import { Home, Users, FileText, Settings as SettingsIcon, Mic } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useApp } from "../../context/AppContext";

export default function NavBar() {
  const { isRecording, startRecordingFlow, stopRecordingFlow, isBusy, status } = useApp();
  // We can use location to determine active state if NavLink isn't enough (e.g. for styling)
  // But NavLink has built-in isActive support.

  const NavItem = ({ to, icon: Icon }: { to: string; icon: any }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center w-12 h-12 transition-colors ${
          isActive ? "text-primary" : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
        }`
      }
    >
      {({ isActive }) => <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />}
    </NavLink>
  );

  return (
    <nav className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] bg-white dark:bg-card-dark h-16 rounded-[24px] shadow-xl flex items-center justify-around px-4 border border-slate-100 dark:border-white/10 z-50">
      <NavItem to="/" icon={Home} />
      <NavItem to="/clients" icon={Users} />

      {/* Floating Action Wrapper (Mic) */}
      <div className="relative -top-8">
        <button
          disabled={isBusy || status === "THINKING"}
          onMouseDown={startRecordingFlow}
          onMouseUp={stopRecordingFlow}
          onTouchStart={startRecordingFlow}
          onTouchEnd={stopRecordingFlow}
          className={`w-16 h-16 rounded-full bg-primary text-white shadow-lg shadow-blue-500/40 flex items-center justify-center transform transition-transform ring-8 ring-white dark:ring-[#000000] ${
            isBusy || status === "THINKING" ? "opacity-50 cursor-not-allowed" : "active:scale-95 hover:scale-105"
          }`}
        >
          {isBusy ? (
            <span className="text-xs font-bold">...</span>
          ) : isRecording ? (
            <div className="w-4 h-4 bg-white rounded-sm" />
          ) : (
            <Mic size={30} />
          )}
        </button>
      </div>

      <NavItem to="/invoices" icon={FileText} />
      <NavItem to="/settings" icon={SettingsIcon} />
    </nav>
  );
}
