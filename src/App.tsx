import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import Tasks from "./pages/Tasks";
import Clients from "./pages/Clients";
import Calendar from "./pages/Calendar";
import Settings from "./pages/Settings";

import VoiceOverlay from "./components/ui/VoiceOverlay";
import ThinkingOverlay from "./components/ui/ThinkingOverlay";
import InvoiceModal from "./components/ui/InvoiceModal";
import DebugOverlay from "./components/ui/DebugOverlay";
import DiagnosticButton from "./components/ui/DiagnosticButton";
import Toast from "./components/ui/Toast";

function AppRoutes() {
  const { status, draft, toast } = useApp();

  return (
    <>
      <DebugOverlay />
      <DiagnosticButton />
      {toast && <Toast message={toast.message} type={toast.type} />}

      {status === "RECORDING" && <VoiceOverlay />}
      {status === "THINKING" && <ThinkingOverlay />}
      {draft && draft.intent === "INVOICE" && <InvoiceModal />}

      <Routes>
         <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="clients" element={<Clients />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="settings" element={<Settings />} />
         </Route>
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
