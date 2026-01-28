import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useOfflineQueue } from "./hooks/useOfflineQueue";
import { useWavRecorder } from "./hooks/useWavRecorder.ts";
import { generateInvoicePDF } from "./pdfGenerator";
import { dataService } from "./services/dataService";
import { supabase } from "./lib/supabase"; // Direct import for robust logic
import Settings from "./components/Settings";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings as SettingsIcon,
  Mic,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Menu,
  Phone,
  MapPin,
  Camera,
  X,
  Plus,
  Calendar,
  List,
  Brain,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Zap,
  UserPlus
} from "lucide-react";

// --- TYPES ---
// -- EXTENDED TYPES --
type CommandIntent = 'create_invoice' | 'create_calendar' | 'create_task' | 'create_client';

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  duration_minutes: number;
}

interface Task {
  id: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  done: boolean;
  due_date?: string | null;
}

interface Client {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  company?: string;
}

// -- EXISTING TYPES --
interface Invoice {
  id: string;
  client: string;
  amount: number;
  status: string;
  items: any[];
  description: string;
  client_phone?: string;
  client_company?: string;
  pdf_path?: string | null;
  intent?: string; // Optional for backward compatibility with check
  created_at?: string;
  date?: string;
}

interface Contact {
  intent?: "CONTACT";
  id: string;
  name: string;
  phone: string;
  company?: string | null;
  created_at: string;
}

interface Expense {
  intent?: "EXPENSE";
  id: string;
  merchant: string;
  amount: number;
  category: string;
  date: string;
  image_path?: string;
  status: string;
}

interface FinancialSummary {
  revenue: number;
  expenses: number;
  profit: number;
}

interface ActivityItem {
  id: string;
  intent: "INVOICE" | "EXPENSE";
  description: string;
  amount: number;
  date: string;
  file_path?: string;
}

type Tab = "DASHBOARD" | "INVOICES" | "CONTACTS" | "TASKS" | "CALENDAR" | "SETTINGS";

export default function App() {
  const [status, setStatus] = useState("IDLE");
  const [currentTab, setCurrentTab] = useState<Tab>("DASHBOARD");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [financials, setFinancials] = useState<FinancialSummary>({ revenue: 0, expenses: 0, profit: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  // DRAFT STATE
  const [draft, setDraft] = useState<any>(null);
  const [draftImage, setDraftImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]); // Visual Debugger State

  // TOAST STATE
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Function alias for compatibility with new Groq code
  const setIsProcessing = (isProc: boolean) => setStatus(isProc ? "THINKING" : "IDLE");
  const setShowInvoiceModal = (show: boolean) => { /* No-op, setDraft handles modal visibility */ };

  const addDebug = (msg: string) => {
    console.log(msg);
    setDebugLogs(prev => [`[${new Date().toLocaleTimeString().split(' ')[0]}] ${msg}`, ...prev].slice(0, 20));
  };

  // Voice Recording
  // const [isRecording, setIsRecording] = useState(false); // Managed by hook now
  // const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // const chunksRef = useRef<Blob[]>([]);
  const { isRecording, startRecording, stopRecording, isBusy } = useWavRecorder();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- INIT & PERSISTENCE ---
  useEffect(() => {
    // 1. Hydrate from LocalStorage
    const storedInvoices = localStorage.getItem("invoices");
    if (storedInvoices) setInvoices(JSON.parse(storedInvoices));

    const storedTasks = localStorage.getItem("tasks");
    if (storedTasks) setTasks(JSON.parse(storedTasks));

    const storedClients = localStorage.getItem("clients");
    if (storedClients) setClients(JSON.parse(storedClients));

    const storedEvents = localStorage.getItem("calendarEvents");
    if (storedEvents) setCalendarEvents(JSON.parse(storedEvents));

    // 2. Sync with Backend
    async function init() {
      try {
        await invoke("init_db");

        // Hydrate from localStorage
        const localInvoices = localStorage.getItem("invoices");
        if (localInvoices) setInvoices(JSON.parse(localInvoices));

        const localTasks = localStorage.getItem("tasks");
        if (localTasks) setTasks(JSON.parse(localTasks));

        const localClients = localStorage.getItem("clients");
        if (localClients) setClients(JSON.parse(localClients));

        refreshFeed();
        refreshData();
      } catch (e) { console.error(e); }
    }
    init();
  }, []);

  // --- PERSISTENCE ---
  useEffect(() => { localStorage.setItem("invoices", JSON.stringify(invoices)); }, [invoices]);
  useEffect(() => { localStorage.setItem("tasks", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem("clients", JSON.stringify(clients)); }, [clients]);

  // Persist State to LocalStorage
  useEffect(() => { localStorage.setItem("invoices", JSON.stringify(invoices)); }, [invoices]);
  useEffect(() => { localStorage.setItem("tasks", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem("clients", JSON.stringify(clients)); }, [clients]);
  useEffect(() => { localStorage.setItem("calendarEvents", JSON.stringify(calendarEvents)); }, [calendarEvents]);

  // EXPOSE DEBUG TOOLS
  useEffect(() => {
    // Expose tools to the console
    (window as any).debugTools = {
      testSupabase: async () => {
        console.log("⚡ TESTING SUPABASE CONNECTION...");
        try {
          const { data, error } = await supabase.from('invoices').select('count', { count: 'exact', head: true });
          if (error) throw error;
          console.log("✅ SUPABASE IS CONNECTED! Data:", data);
          alert("✅ SUPABASE WORKS!");
        } catch (e: any) {
          console.error("❌ SUPABASE FAILED:", e);
          alert("❌ SUPABASE FAILED: " + e.message);
        }
      },
      forceSave: () => {
        console.log("⚡ FORCING SAVE...");
        handleApproveInvoice();
      },
      logState: () => {
        console.log("Current Invoice State (draft):", draft);
      }
    };

    console.log("🔧 DEBUG TOOLS READY. Type 'window.debugTools.testSupabase()' to run.");
  }, [draft]);

  async function refreshFeed() {
    try {
      const stats = await invoke("get_financial_summary") as FinancialSummary;
      setFinancials(stats);
      const activity = await invoke("get_recent_activity") as ActivityItem[];
      setRecentActivity(activity);
    } catch (e) { console.error(e); }
  }

  async function refreshData() {
    try {
      const inv = await invoke("get_invoices") as Invoice[];
      setInvoices(inv);
      const tsk = await invoke("get_tasks") as Task[];
      setTasks(tsk);
      const con = await invoke("get_contacts") as Contact[];
      setContacts(con);
      // Map contacts to clients for UI display
      setClients(con.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        company: c.company || undefined
      })));
      const exp = await invoke("get_expenses") as Expense[];
      setExpenses(exp);
      const evts = await invoke("get_calendar_events") as CalendarEvent[];
      setCalendarEvents(evts);
      const stats = await invoke("get_financial_summary") as FinancialSummary;
      setFinancials(stats);
      const activity = await invoke("get_recent_activity") as ActivityItem[];
      setRecentActivity(activity);
    } catch (e) { console.error(e); }
  }

  // --- ACTIONS ---

  async function openSystemLink(url: string) {
    if (!url) return;
    try {
      await invoke("open_system_link", { url });
    } catch (e) {
      alert("Link Error: " + e);
    }
  }

  async function openInvoice(id: string) {
    if (!id) return;
    try {
      await invoke("open_invoice_pdf", { id });
    } catch (e) {
      alert("PDF Error: " + e);
    }
  }

  function emailInvoice(inv: Invoice) {
    const subject = encodeURIComponent(`Invoice from ConstructionOS: ${inv.id}`);
    const body = encodeURIComponent(`Hi ${inv.client},\n\nPlease find attached the invoice for ${inv.description}.\nTotal Amount: $${inv.amount.toFixed(2)}.\n\nThank you for your business!`);
    const mailto = `mailto:?subject=${subject}&body=${body}`;
    openSystemLink(mailto);
  }

  // --- RECORDING ---
  async function startRecordingFlow() {
    if (isBusy) return;
    addDebug("🎤 Initializing Recorder...");
    try {
      addDebug("🎙️ Starting Recording (WAV)...");
      await startRecording();
      addDebug("🔴 Recording STARTED");
      setStatus("RECORDING");
    } catch (err: any) {
      addDebug("❌ Mic Error: " + err.message);
      alert("Mic Error: " + err);
    }
  }

  async function stopRecordingFlow() {
    addDebug("⏹️ Recording Stopped.");
    try {
      const wavBlob = await stopRecording();
      handleStopRecording(wavBlob, "audio/wav");
    } catch (e: any) {
      console.error("Stop Recording Error:", e);
      addDebug("❌ Stop Failed: " + e.message);
    }
  }

  const handleStopRecording = async (blob: Blob, mimeType: string) => {
    addDebug(`🔄 Analyzing... Size: ${blob.size}`);

    setIsProcessing(true);

    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;

      if (!apiKey) {
        addDebug("❌ ERROR: No API Key found.");
        throw new Error("Missing API Key");
      }

      // Determine extension
      let ext = "wav"; // Always WAV now with useWavRecorder

      addDebug("🚀 Transcribing (Offline)...");

      // --- STEP 1: TRANSCRIBE (Offline via whisper-rs) ---
      const audioData = await blobToUint8Array(blob);
      const bytes = Array.from(audioData);

      console.log("Creating invoice locally...");
      const text = await invoke<string>("transcribe_audio", { audioData: bytes });


      addDebug(`📝 Transcript (Local): "${text.substring(0, 20)}..."`);

      if (!text || text.trim().length < 5) {
        addDebug("⚠️ No voice detected or too short.");
        alert("⚠️ No voice detected. Please speak closer.");
        setIsProcessing(false);
        return;
      }

      // --- STEP 2: CLASSIFY & EXTRACT (Groq Llama 3) ---
      addDebug("🧠 Thinking (Intent Classification)...");
      await processWithAI(text);

    } catch (error: any) {
      addDebug("❌ Process Failed: " + error.message);
      alert(`AI Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  async function processWithAI(text: string) {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) throw new Error("Missing Groq API Key");

    const systemPrompt = `You are the AI Operating System for a construction business.
Input: Raw voice transcription (may contain phonetic typos: "Ingeauch"->"Invoice", "Skedule"->"Schedule").
Output: Strictly formatted JSON.

CLASSIFY INTENT (Pick One):
'create_invoice': Billing, money, completed jobs.
'create_calendar': Meetings, visits, appointments.
'create_task': To-dos, lists, reminders.
'create_client': Contact info (names, phones).

RETURN JSON (Select structure):
IF Invoice: { "intent": "create_invoice", "client_name": "String", "items": ["String"], "total": Number }
IF Calendar: { "intent": "create_calendar", "title": "String", "start_time": "ISO String (Estimate future date from now)", "duration_minutes": Number }
IF Task: { "intent": "create_task", "description": "String", "priority": "High" | "Medium" | "Low" }
IF Client: { "intent": "create_client", "name": "String", "phone": "String or null", "address": "String or null" }`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Current Date: ${new Date().toISOString()}\nTranscription: "${text}"` }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) throw new Error("AI Brain Failed");
    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    console.log("🧠 AI Brain Result:", result);
    addDebug(`🧠 Intent: ${result.intent}`);

    // --- DISPATCHER ---
    const id = Math.random().toString(36).substr(2, 9);

    switch (result.intent) {
      case 'create_invoice':
        let clientName = result.client_name || "New Client";
        let clientPhone = "";
        let clientCompany = "";

        // LOGIC: Link to existing client or auto-create
        const existingClient = clients.find(c => c.name.toLowerCase().includes(clientName.toLowerCase()));

        if (existingClient) {
          clientName = existingClient.name;
          clientPhone = existingClient.phone || "";
          clientCompany = existingClient.company || "";
          addDebug(`🔗 Linked to existing client: ${clientName}`);
        } else if (result.client_name) {
          // Create new client automatically if name was provided but not found
          const newAutoClient: Client = {
            id: `CLI-${Math.random().toString(36).substr(2, 9)}`,
            name: clientName,
            phone: "",
            address: "" // We don't have this info yet
          };
          setClients(prev => [newAutoClient, ...prev]);
          addDebug(`👤 Created new client: ${clientName}`);
        }

        setDraft({
          id: `INV-${Math.floor(Math.random() * 90000) + 10000}`,
          intent: "INVOICE",
          created_at: new Date().toISOString(),
          client: clientName,
          client_phone: clientPhone,
          client_company: clientCompany,
          amount: result.total || 0,
          description: (result.items || []).join(", ") || "Services",
          status: "draft",
          items: []
        });
        setCurrentTab("INVOICES"); // Auto-switch
        setShowInvoiceModal(true);
        break;

      case 'create_calendar':
        const newEvent: CalendarEvent = {
          id: `EVT-${id}`,
          title: result.title || "New Meeting",
          start_time: result.start_time || new Date().toISOString(),
          duration_minutes: result.duration_minutes || 60
        };
        setCalendarEvents(prev => [newEvent, ...prev]);
        invoke("confirm_calendar_event", { event: newEvent }).catch(e => console.error(e));
        setCurrentTab("CALENDAR"); // Auto-switch
        addDebug(`📅 Event Created: ${newEvent.title}`);
        break;

      case 'create_task':
        const newTask: Task = {
          id: `TSK-${id}`,
          description: result.description || "New Task",
          priority: (result.priority as any) || "Medium",
          done: false,
          due_date: null
        };
        setTasks(prev => [newTask, ...prev]);
        invoke("confirm_task", { task: newTask }).catch(e => console.error(e));
        setCurrentTab("TASKS"); // Auto-switch
        addDebug(`✅ Task Created: ${newTask.description}`);
        break;

      case 'create_client':
        const newClient: Client = {
          id: `CLI-${id}`,
          name: result.name || "Unknown",
          phone: result.phone,
          address: result.address
        };
        setClients(prev => [newClient, ...prev]);
        invoke("confirm_contact", { contact: {
          id: newClient.id,
          name: newClient.name,
          phone: newClient.phone || "",
          company: newClient.company || null,
          created_at: new Date().toISOString()
        }}).catch(e => console.error(e));
        setCurrentTab("CONTACTS"); // Auto-switch
        addDebug(`👤 Client Saved: ${newClient.name}`);
        break;

      default:
        addDebug("⚠️ Unknown Intent: " + result.intent);
        alert("Could not understand command.");
    }
  }

  // --- IMAGE HANDLING ---
  function onCameraClick() { fileInputRef.current?.click(); }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (ev) => {
        if (ev.target?.result) {
          const base64 = ev.target.result as string;
          setDraftImage(base64);
          setStatus("THINKING");
          try {
            const result = await invoke("analyze_image", { imageData: base64 }) as any;
            setDraft(result);
          } catch (err: any) { alert("Image AI Error: " + err); }
          finally {
            setStatus("IDLE");
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        }
      };
      reader.readAsDataURL(file);
    }
  }

  function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(new Uint8Array(reader.result as ArrayBuffer));
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }


  async function handleApproveInvoice() {
    if (!draft) return;
    setIsSaving(true);
    alert("🚀 Starting Process...");

    // 0. Validate Data
    console.log("Saving Invoice Data:", draft);
    if (!draft.amount || !draft.client) {
      alert("Error: Missing Invoice Data (Amount or Client)");
      setIsSaving(false);
      return;
    }

    try {
      if (draft.intent === "INVOICE") {
        const invoiceData = { ...draft };

        // Step 1: PDF Generation (Decoupled)
        try {
          console.log("📄 Requesting PDF generation for:", invoiceData.id);

          // Using existing frontend generator that wraps the Rust backend
          const pdfPath = await generateInvoicePDF(invoiceData);

          console.log("✅ PDF Generated at:", pdfPath);
          alert(`PDF Saved to: ${pdfPath}`);
          invoiceData.pdf_path = pdfPath;

        } catch (pdfErr) {
          console.error("⚠️ PDF GENERATION FAILED:", pdfErr);
          // We DO NOT throw the error here. We let the app continue to save to Supabase.
          // This prevents the "Freeze" if Rust fails.
          alert("⚠️ PDF Failed to generate, but Invoice was saved to Cloud.");
          invoiceData.pdf_path = null;
        }

        // Step 2: Supabase
        console.log("☁️ Step 2: Saving to Supabase...");

        // Prepare data for Supabase (remove intent/local fields if strictly needed, but let's assume loose schema or JSONB)
        // Adjusting object to match likely schema
        const dbPayload = {
          id: invoiceData.id,
          client: invoiceData.client,
          amount: invoiceData.amount,
          status: invoiceData.status || 'DRAFT',
          description: invoiceData.description,
          client_phone: invoiceData.client_phone,
          client_company: invoiceData.client_company,
          pdf_path: invoiceData.pdf_path
        };

        const { error } = await supabase.from('invoices').insert([dbPayload]);

        if (error) {
          console.error("Supabase Error:", error);
          alert("Supabase Error: " + error.message);
          throw error;
        }

        // --- WEBHOOK STEP (Final Fix) ---
        const webhookUrl = localStorage.getItem("webhook_url");

        if (webhookUrl) {
          try {
            console.log(" Sending Webhook to:", webhookUrl);

            await fetch(webhookUrl, {
              method: "POST",
              mode: "no-cors", // Bypasses security check
              headers: {
                "Content-Type": "text/plain" // <--- TRICK: Browser allows this without preflight
              },
              body: JSON.stringify(invoiceData) // We still send the data!
            });

            console.log("✅ Webhook Sent (Blindly)");

          } catch (webhookErr) {
            console.error("⚠️ Webhook Failed:", webhookErr);
            // Don't stop the app, just log it
          }
        } else {
          console.warn("⚠️ No Webhook URL found in Settings. Skipping.");
        }
        // --------------------------------

        // Step 4: Local UI Update & Persistence
        console.log("🔄 Step 4: Updating Local State & DB");

        // 1. Optimistic Update (Immediate)
        setInvoices(prev => [invoiceData, ...prev]);

        // 2. Sync to Local SQLite (so it persists on reload)
        try {
          await invoke("confirm_invoice", { invoice: invoiceData });
          console.log("✅ Saved to Local DB");
        } catch (localErr) {
          console.error("⚠️ Local DB Save Failed:", localErr);
        }

        alert("✅ Data Saved to Cloud & Local!");

      } else if (draft.intent === "TASK") {
        await invoke("confirm_task", { task: draft });
      } else if (draft.intent === "CONTACT") {
        await invoke("confirm_contact", { contact: draft });
      } else if (draft.intent === "EXPENSE") {
        let finalDraft = { ...draft };
        if (draftImage) {
          const savedPath = await invoke("save_image", { imageData: draftImage });
          finalDraft.image_path = savedPath;
        }
        await invoke("confirm_expense", { expense: finalDraft });
      }

      // Cleanup
      setDraft(null);
      setDraftImage(null);
      // NOTE: Removed refreshData() to prevent race condition overwriting the optimistic update.
      // refreshData(); 

    } catch (e: any) {
      console.error("❌ Fn Failure:", e);
      alert("Critical Failure: " + e.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function runDiagnostics() {
    alert("1. Starting Diagnostic Test...");

    try {
      // Test 1: Check Supabase Config
      console.log("Checking Supabase Client...");
      if (!supabase) throw new Error("Supabase Client is UNDEFINED");

      // Test 2: Write to Database
      alert("2. Attempting Database Write...");
      // NOTE: Using 'client' instead of 'client_name' to match schema inferred from handleApproveInvoice
      const { data, error } = await supabase
        .from('invoices')
        .insert([{ client: "TEST_PING", amount: 1, status: "test", id: `TEST-${Date.now()}` }])
        .select();

      if (error) throw error;
      alert("✅ DATABASE SUCCESS! Row ID: " + data[0].id);

      // Test 3: Fire Webhook
      const url = localStorage.getItem("webhook_url");
      if (url) {
        alert("3. Testing Webhook...");
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ test: true })
        });
        alert("✅ WEBHOOK SUCCESS!");
      } else {
        alert("⚠️ No Webhook URL found in settings.");
      }

    } catch (err: any) {
      console.error(err);
      alert("❌ FAILURE: " + (err.message || JSON.stringify(err)));
    }
  }

  function applyContact(contact: any) {
    setDraft({ ...draft, client: contact.name, client_phone: contact.phone || "", client_company: contact.company || "" });
  }

  // --- CALCULATED STATS ---
  const stats = {
    outstanding: invoices.filter(i => i.status !== "PAID").length,
    paid: invoices.filter(i => i.status === "PAID").length,
    overdue: invoices.filter(i => i.status === "OVERDUE").length, // Assuming OVERDUE status exists or defaults to 0
    unapproved: 0
  };

  const getHeaderTitle = () => {
    switch (currentTab) {
      case "DASHBOARD": return "Hello, Jason!";
      case "INVOICES": return "Invoices";
      case "CONTACTS": return "Clients";
      case "SETTINGS": return "Settings";
      case "TASKS": return "Tasks";
      default: return "ConstructionOS";
    }
  };

  // --- UI COMPONENTS ---

  const Header = () => (
    <header className="absolute top-0 left-0 right-0 h-24 bg-white/80 backdrop-blur-md flex flex-col justify-end px-6 pb-4 z-50 border-b border-slate-100/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          {currentTab !== "DASHBOARD" ? (
            <button onClick={() => setCurrentTab("DASHBOARD")} className="p-1 -ml-1 text-slate-500 hover:text-slate-800 transition-colors">
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
        <button onClick={() => setCurrentTab("SETTINGS")} className="p-2 text-slate-400 hover:text-slate-600">
          <SettingsIcon size={24} />
        </button>
      </div>
    </header>
  );



  const NavBar = () => (
    <nav className="fixed bottom-0 left-0 right-0 h-24 bg-white/95 backdrop-blur-md border-t border-slate-100 flex items-center justify-around px-6 z-50 pb-safe pb-4">
      <NavItem tab="DASHBOARD" label="Home" icon={LayoutDashboard} />
      <NavItem tab="INVOICES" label="Invoices" icon={FileText} />

      {/* Floating Action Wrapper */}
      <div className="relative -top-8">
        <button
          disabled={isBusy || status === "THINKING"}
          onMouseDown={startRecordingFlow}
          onMouseUp={() => stopRecordingFlow()}
          onTouchStart={startRecordingFlow}
          onTouchEnd={() => stopRecordingFlow()}
          className={`w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-blue-500/50 flex items-center justify-center transform transition-transform border-4 border-white ${isBusy || status === "THINKING" ? "opacity-50 cursor-not-allowed" : "active:scale-95 hover:scale-105"
            }`}
        >
          {isBusy ? (
            <span className="text-xs font-bold">Wait</span>
          ) : isRecording ? (
            <div className="w-4 h-4 bg-white rounded-sm" />
          ) : (
            <Mic size={24} />
          )}
        </button>
      </div>

      <NavItem tab="TASKS" label="Tasks" icon={List} />
      <NavItem tab="CALENDAR" label="Calendar" icon={Calendar} />
      <NavItem tab="CONTACTS" label="Clients" icon={Users} />
    </nav>
  );

  const NavItem = ({ tab, label, icon: Icon }: { tab: Tab; label: string; icon: any }) => {
    const isActive = currentTab === tab;
    return (
      <button
        onClick={() => setCurrentTab(tab)}
        className={`flex flex-col items-center gap-1 p-2 w-14 transition-colors ${isActive ? "text-primary" : "text-slate-400 hover:text-slate-600"
          }`}
      >
        <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
        <span className="text-[10px] font-bold tracking-wide truncate w-full text-center">{label}</span>
      </button>
    );
  };

  const StatCard = ({ label, value, icon: Icon, colorClass }: { label: string; value: number; icon: any; colorClass: string }) => (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex flex-col justify-between h-24 relative overflow-hidden group">
      <div className={`absolute right-2 top-2 opacity-10 transform scale-150 group-hover:scale-125 transition-transform duration-500 ${colorClass}`}>
        <Icon size={48} />
      </div>
      <div className="text-xs text-slate-400 font-bold uppercase tracking-wider z-10">{label}</div>
      <div className={`text-2xl font-bold z-10 ${colorClass}`}>
        {value.toString().padStart(2, '0')}
      </div>
    </div>
  );

  const CalendarTab = () => {
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
      const dateStr = new Date(year, month, day).toISOString().split('T')[0];
      const evts = calendarEvents.filter(e => e.start_time.startsWith(dateStr));
      const tsks = tasks.filter(t => t.due_date && t.due_date.startsWith(dateStr)).map(t => ({ ...t, type: 'task' }));
      const invs = invoices.filter(i => i.created_at && i.created_at.startsWith(dateStr)).map(i => ({ ...i, type: 'invoice' }));
      return [...evts, ...tsks, ...invs];
    };

    const getSelectedItems = () => {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const evts = calendarEvents.filter(e => e.start_time.startsWith(dateStr)) as any[];
      const tsks = tasks.filter(t => t.due_date && t.due_date.startsWith(dateStr)).map(t => ({ ...t, type: 'task' })) as any[];
      const invs = invoices.filter(i => i.created_at && i.created_at.startsWith(dateStr)).map(i => ({ ...i, type: 'invoice' })) as any[];
      return [...evts, ...tsks, ...invs];
    };

    const selectedItems = getSelectedItems();

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Calendar Header */}
        <div className="flex items-center justify-between px-2">
          <button onClick={prevMonth} className="p-2 text-slate-400 hover:text-slate-800"><ChevronLeft size={24} /></button>
          <h2 className="text-xl font-bold text-slate-800">{monthNames[month]} {year}</h2>
          <button onClick={nextMonth} className="p-2 text-slate-400 hover:text-slate-800"><ChevronRight size={24} /></button>
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
  };

  // --- CARDS ---
  const InvoiceCard = ({ invoice }: { invoice: Invoice }) => (
    <div
      onClick={() => openInvoice(invoice.id)}
      className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 flex justify-between items-center active:scale-95 transition-transform"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${invoice.status === 'PAID' ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'
          }`}>
          <FileText size={20} />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">{invoice.client}</h3>
          <p className="text-xs text-slate-500 font-medium">#{invoice.id}</p>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-black text-slate-900 tracking-tight">${invoice.amount.toLocaleString()}</div>
        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${invoice.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
          }`}>
          {invoice.status}
        </div>
      </div>
    </div>
  );

  const TaskCard = ({ task }: { task: Task }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 flex items-center gap-4 group">
      <button
        onClick={() => {
           setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t));
        }}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
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
          if(confirm("Delete this task?")) {
             setTasks(prev => prev.filter(t => t.id !== task.id));
             showToast("Task Deleted", "success");
          }
        }}
        className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );

  const EventCard = ({ event }: { event: CalendarEvent }) => (
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

  const ClientCard = ({ client }: { client: Client }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 flex items-center gap-4 group">
      <div className="bg-pink-50 text-pink-600 p-3 rounded-full">
        <Users size={20} />
      </div>
      <div className="flex-1">
        <p className="font-bold text-slate-900">{client.name}</p>
        <p className="text-sm text-slate-500 flex items-center gap-1"><Phone size={12} /> {client.phone || "No Phone"}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if(confirm("Delete this client?")) {
             setClients(prev => prev.filter(c => c.id !== client.id));
             showToast("Client Deleted", "success");
          }
        }}
        className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
        <Users className="text-slate-300" size={32} />
      </div>
      <p className="text-slate-500 font-medium">{message}</p>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#111] flex items-center justify-center py-10 font-sans selection:bg-primary/20">
      {/* Mobile Simulator Frame */}
      <div className="w-[390px] h-[844px] bg-slate-50 relative overflow-hidden shadow-2xl rounded-[40px] border-[8px] border-slate-900 flex flex-col">

        {/* VOICE DEBUG OVERLAY */}
        <div className="absolute top-16 left-4 right-4 z-[9999] pointer-events-none">
          {debugLogs.length > 0 && (
            <div className="bg-black/80 backdrop-blur-md rounded-xl p-3 text-[10px] font-mono text-green-400 border border-green-900 shadow-2xl overflow-hidden">
              <div className="border-b border-green-900 pb-1 mb-1 font-bold text-xs flex justify-between">
                <span>LOGS</span>
                <button onClick={() => setDebugLogs([])} className="pointer-events-auto hover:text-white">CLEAR</button>
              </div>
              <div className="flex flex-col gap-1 opacity-90">
                {debugLogs.map((log, i) => (
                  <div key={i} className="truncate">{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* TOAST NOTIFICATION */}
        {toast && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top fade-in duration-300">
                <div className={`px-4 py-3 rounded-full shadow-xl flex items-center gap-2 border ${
                    toast.type === 'success' ? 'bg-white border-green-200 text-green-700' : 'bg-white border-red-200 text-red-600'
                }`}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} className="text-green-500" /> : <AlertCircle size={18} className="text-red-500" />}
                    <span className="font-bold text-sm">{toast.message}</span>
                </div>
            </div>
        )}

        {/* DIAGNOSTIC TEST BUTTON */}
        <button
          onClick={runDiagnostics}
          className="fixed top-4 left-4 z-[99999] bg-red-600 text-white p-4 rounded-full shadow-xl font-bold text-xs hover:scale-110 transition-transform"
        >
          TEST CONNECTION
        </button>

        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={onFileChange} />

        {/* Full Screen Voice Overlay */}
        {status === "RECORDING" && (
          <div className="absolute inset-0 z-[60] bg-gradient-to-b from-blue-600 to-blue-500 flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="absolute top-12 right-6 z-20">
              <button onClick={() => stopRecordingFlow()} className="text-white/60 hover:text-white p-2 bg-white/10 rounded-full backdrop-blur-md"><X size={24} /></button>
            </div>

            <div className="relative mb-12">
              <div className="absolute inset-0 bg-white/20 rounded-full animate-ping blur-md"></div>
              <div className="absolute inset-0 bg-white/20 rounded-full animate-ping delay-150 blur-sm"></div>
              <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-2xl relative z-10">
                <div className="text-blue-600">
                  <div className="flex gap-1 h-8 items-center justify-center">
                    <div className="w-1.5 bg-blue-600 rounded-full animate-[bounce_1s_infinite] h-4"></div>
                    <div className="w-1.5 bg-blue-600 rounded-full animate-[bounce_1s_infinite_100ms] h-8"></div>
                    <div className="w-1.5 bg-blue-600 rounded-full animate-[bounce_1s_infinite_200ms] h-6"></div>
                    <div className="w-1.5 bg-blue-600 rounded-full animate-[bounce_1s_infinite_150ms] h-8"></div>
                    <div className="w-1.5 bg-blue-600 rounded-full animate-[bounce_1s_infinite_50ms] h-5"></div>
                  </div>
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Smart Invoicing</h2>
            <p className="text-blue-100 text-lg mb-8 font-medium">Speak your invoice...</p>

            <div className="w-[90%] bg-white/10 backdrop-blur-md rounded-3xl p-6 text-white text-center border border-white/20 shadow-inner">
              <p className="italic opacity-80 leading-relaxed">"Invoice Jason Park for HVAC installation, 5 hours..."</p>
            </div>

            <button onClick={() => stopRecordingFlow()} className="mt-12 bg-white text-blue-600 px-8 py-4 rounded-full font-bold shadow-xl hover:scale-105 transition-transform">
              Stop Recording
            </button>
          </div>
        )}

        {/* Thinking Overlay */}
        {status === "THINKING" && (
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-purple-500/30 rounded-full animate-ping blur-xl"></div>
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl relative z-10">
                 <Brain size={48} className="text-purple-600 animate-pulse" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-purple-600 text-white p-2 rounded-full border-4 border-white shadow-lg animate-bounce">
                <Loader2 size={16} className="animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Thinking...</h2>
            <p className="text-white/60 text-sm font-medium animate-pulse">Analyzing your request</p>
          </div>
        )}

        <Header />

        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-28 pb-36 px-4 scrollbar-hide">

          {currentTab === "DASHBOARD" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* Quick Actions */}
              <div>
                <h2 className="text-lg font-black text-slate-900 mb-3 ml-1">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={startRecordingFlow}
                    className="bg-blue-600 text-white p-4 rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-transform flex flex-col items-center justify-center gap-2"
                  >
                    <Mic size={24} />
                    <span className="font-bold text-sm">Record Voice</span>
                  </button>
                  <button
                    onClick={() => {
                        const name = prompt("Client Name:");
                        if(name) {
                            const newClient: Client = { id: `CLI-${Date.now()}`, name };
                            setClients(prev => [newClient, ...prev]);
                            showToast("Client Added", "success");
                        }
                    }}
                    className="bg-white text-slate-900 border border-stone-200 p-4 rounded-xl shadow-sm active:scale-95 transition-transform flex flex-col items-center justify-center gap-2"
                  >
                    <UserPlus size={24} className="text-blue-600" />
                    <span className="font-bold text-sm">Add Client</span>
                  </button>
                </div>
              </div>

              {/* Today's Agenda */}
              <div>
                <h2 className="text-lg font-black text-slate-900 mb-3 ml-1">Today's Agenda</h2>
                <div className="space-y-3">
                  {tasks.slice(0, 3).map(t => <TaskCard key={t.id} task={t} />)}
                  {tasks.length === 0 && <EmptyState message="No tasks due soon" />}
                </div>
              </div>

              {/* Recent Invoices */}
              <div>
                <h2 className="text-lg font-black text-slate-900 mb-3 ml-1">Recent Invoices</h2>
                <div className="space-y-3">
                  {invoices.slice(0, 3).map(inv => <InvoiceCard key={inv.id} invoice={inv} />)}
                  {invoices.length === 0 && <EmptyState message="No invoices yet" />}
                </div>
              </div>
            </div>
          )}

          {currentTab === "INVOICES" && (
            <div className="space-y-4 animate-in slide-in-from-right duration-300">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">All Invoices</h2>
              {invoices.map(inv => <InvoiceCard key={inv.id} invoice={inv} />)}
              {invoices.length === 0 && <EmptyState message="No invoices found." />}
            </div>
          )}

          {currentTab === "TASKS" && (
            <div className="space-y-4 animate-in slide-in-from-right duration-300">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">My Tasks</h2>
              {tasks.map(t => <TaskCard key={t.id} task={t} />)}
              {tasks.length === 0 && <EmptyState message="No active tasks." />}
            </div>
          )}

          {currentTab === "CONTACTS" && (
            <div className="space-y-4 animate-in slide-in-from-right duration-300">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Client List</h2>
              {clients.map(c => <ClientCard key={c.id} client={c} />)}
              {clients.length === 0 && <EmptyState message="No clients saved." />}
            </div>
          )}

          {currentTab === "CALENDAR" && <CalendarTab />}

          {currentTab === "SETTINGS" && (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
                <h2 className="text-2xl font-black text-slate-900 mb-4">Settings</h2>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200">
                    <h3 className="font-bold text-slate-900 mb-2">App Info</h3>
                    <div className="flex justify-between py-2 border-b border-stone-100">
                        <span className="text-slate-500">Version</span>
                        <span className="font-medium">v0.2.0 (Alpha)</span>
                    </div>
                    <div className="flex justify-between py-2">
                        <span className="text-slate-500">Build</span>
                        <span className="font-medium">Production</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200">
                    <h3 className="font-bold text-slate-900 mb-2">Data Management</h3>
                    <button
                        onClick={() => {
                            if(confirm("Clear all local data? This cannot be undone.")) {
                                localStorage.clear();
                                window.location.reload();
                            }
                        }}
                        className="w-full py-3 text-red-600 font-bold bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                    >
                        <Trash2 size={18} />
                        Clear All Data
                    </button>
                </div>
            </div>
          )}

        </main>

        <NavBar />

        {/* INVOICE MODAL */}
        {draft && draft.intent === "INVOICE" && (
          <div className="absolute inset-0 z-[100] bg-white animate-in slide-in-from-bottom duration-300 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md">
              <h2 className="text-xl font-bold text-slate-800">New Invoice</h2>
              <button onClick={() => setDraft(null)} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-full"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Client</label>
                <input
                  className="w-full text-2xl font-bold text-slate-800 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none pb-2 transition-colors placeholder:text-slate-300"
                  value={draft.client}
                  onChange={e => setDraft({ ...draft, client: e.target.value })}
                  placeholder="Client Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Amount</label>
                  <div className="relative">
                    <span className="absolute left-0 top-1 text-xl font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      className="w-full text-2xl font-bold text-slate-800 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none pb-2 pl-6 transition-colors"
                      value={draft.amount}
                      onChange={e => setDraft({ ...draft, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Date</label>
                  <input
                    type="date"
                    className="w-full text-lg font-medium text-slate-800 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none pb-2 transition-colors"
                    value={draft.created_at ? draft.created_at.split('T')[0] : ''}
                    onChange={e => setDraft({ ...draft, created_at: new Date(e.target.value).toISOString() })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Description</label>
                <textarea
                  className="w-full h-32 text-lg text-slate-600 bg-slate-50 rounded-xl p-4 border border-slate-100 focus:border-blue-500 outline-none resize-none transition-all"
                  value={draft.description}
                  onChange={e => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Itemize services here..."
                />
              </div>

              <div className="pt-4">
                <button
                  onClick={handleApproveInvoice}
                  disabled={isSaving}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    <>Save & Send Invoice</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}