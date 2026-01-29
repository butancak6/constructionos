import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import NavBar from "./NavBar";

export default function Layout() {
  const location = useLocation();
  const isDashboard = location.pathname === "/";

  return (
    <div className="min-h-screen w-full bg-[#111] flex items-center justify-center py-10 font-sans selection:bg-primary/20">
      <div className="w-[390px] h-[844px] bg-slate-50 relative overflow-hidden shadow-2xl rounded-[40px] border-[8px] border-slate-900 flex flex-col">
         {!isDashboard && <Header />}

         <main className={`flex-1 overflow-y-auto overflow-x-hidden pb-36 scrollbar-hide ${!isDashboard ? "pt-28 px-4" : ""}`}>
            <Outlet />
         </main>

         <NavBar />
      </div>
    </div>
  );
}
