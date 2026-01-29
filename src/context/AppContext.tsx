import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { invoke } from "../lib/tauri";
import { useWavRecorder } from "../hooks/useWavRecorder";
import { generateInvoicePDF } from "../pdfGenerator";
import { supabase } from "../lib/supabase";
import {
  Invoice,
  Task,
  Client,
  CalendarEvent,
  Contact,
  Expense,
  FinancialSummary,
  ActivityItem,
} from "../types";

interface AppContextType {
  // State
  invoices: Invoice[];
  tasks: Task[];
  clients: Client[];
  calendarEvents: CalendarEvent[];
  financials: FinancialSummary;
  recentActivity: ActivityItem[];
  draft: any;
  draftImage: string | null;
  isSaving: boolean;
  status: string;
  debugLogs: string[];
  toast: { message: string; type: 'success' | 'error' } | null;

  // Recorder State
  isRecording: boolean;
  isBusy: boolean;

  // Actions
  setDraft: (draft: any) => void;
  setDraftImage: (image: string | null) => void;
  setStatus: (status: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  addDebug: (msg: string) => void;

  // Async Actions
  startRecordingFlow: () => Promise<void>;
  stopRecordingFlow: () => Promise<void>;
  handleApproveInvoice: () => Promise<void>;
  runDiagnostics: () => Promise<void>;
  refreshData: () => Promise<void>;
  openInvoice: (id: string) => Promise<void>;
  emailInvoice: (inv: Invoice) => void;
  openSystemLink: (url: string) => Promise<void>;
  analyzeImage: (base64: string) => Promise<void>;

  // Setters (for optimistic updates)
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState("IDLE");

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
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // TOAST STATE
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { isRecording, startRecording, stopRecording, isBusy } = useWavRecorder();

  // --- HELPERS ---
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const addDebug = (msg: string) => {
    console.log(msg);
    setDebugLogs(prev => [`[${new Date().toLocaleTimeString().split(' ')[0]}] ${msg}`, ...prev].slice(20));
  };

  const setIsProcessing = (isProc: boolean) => setStatus(isProc ? "THINKING" : "IDLE");

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

        // Re-hydrate to be safe (or fetch fresh)
        refreshData();
      } catch (e) { console.error(e); }
    }
    init();
  }, []);

  // Persist State to LocalStorage
  useEffect(() => { localStorage.setItem("invoices", JSON.stringify(invoices)); }, [invoices]);
  useEffect(() => { localStorage.setItem("tasks", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem("clients", JSON.stringify(clients)); }, [clients]);
  useEffect(() => { localStorage.setItem("calendarEvents", JSON.stringify(calendarEvents)); }, [calendarEvents]);

  // EXPOSE DEBUG TOOLS
  useEffect(() => {
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
  }, [draft]);

  async function refreshData() {
    try {
      const inv = await invoke("get_invoices") as Invoice[];
      if (inv) setInvoices(inv);
      const tsk = await invoke("get_tasks") as Task[];
      if (tsk) setTasks(tsk);
      const con = await invoke("get_contacts") as Contact[];
      if (con) {
        setContacts(con);
        // Map contacts to clients for UI display
        setClients(con.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          company: c.company || undefined
        })));
      }
      const exp = await invoke("get_expenses") as Expense[];
      if (exp) setExpenses(exp);
      const evts = await invoke("get_calendar_events") as CalendarEvent[];
      if (evts) setCalendarEvents(evts);
      const stats = await invoke("get_financial_summary") as FinancialSummary;
      if (stats) setFinancials(stats);
      const activity = await invoke("get_recent_activity") as ActivityItem[];
      if (activity) setRecentActivity(activity);
    } catch (e) { console.error(e); }
  }

  // --- ACTIONS ---

  async function openSystemLink(url: string) {
    if (!url) return;
    try {
      await invoke("open_system_link", { url });
    } catch (e) {
      showToast("Link Error: " + e, "error");
    }
  }

  async function openInvoice(id: string) {
    if (!id) return;
    try {
      await invoke("open_invoice_pdf", { id });
    } catch (e) {
      showToast("PDF Error: " + e, "error");
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
      showToast("Mic Error: " + err, "error");
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
      setStatus("IDLE");
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

      // --- STEP 1: TRANSCRIBE (Offline via whisper-rs) ---
      const audioData = await blobToUint8Array(blob);
      const bytes = Array.from(audioData);

      console.log("Creating invoice locally...");
      const text = await invoke<string>("transcribe_audio", { audioData: bytes });

      addDebug(`📝 Transcript (Local): "${text.substring(0, 20)}..."`);

      if (!text || text.trim().length < 5) {
        addDebug("⚠️ No voice detected or too short.");
        showToast("No voice detected. Please speak closer.", "error");
        setIsProcessing(false);
        return;
      }

      // --- STEP 2: CLASSIFY & EXTRACT (Groq Llama 3) ---
      addDebug("🧠 Thinking (Intent Classification)...");
      await processWithAI(text);

    } catch (error: any) {
      addDebug("❌ Process Failed: " + error.message);
      showToast(`AI Error: ${error.message}`, "error");
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

        const existingClient = clients.find(c => c.name.toLowerCase().includes(clientName.toLowerCase()));

        if (existingClient) {
          clientName = existingClient.name;
          clientPhone = existingClient.phone || "";
          clientCompany = existingClient.company || "";
          addDebug(`🔗 Linked to existing client: ${clientName}`);
        } else if (result.client_name) {
          const newAutoClient: Client = {
            id: `CLI-${Math.random().toString(36).substr(2, 9)}`,
            name: clientName,
            phone: "",
            address: ""
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
        // Navigation should be handled by consuming component if needed,
        // or by router redirection if we had access to router here.
        // For now, setting draft triggers the Modal in App.tsx.
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
        addDebug(`📅 Event Created: ${newEvent.title}`);
        // We can't easily switch tab from here without router context,
        // but since we are standardizing, we might want to expose a navigation helper
        // or just let the user navigate.
        // Ideally we redirect. We'll handle this later or via a listener.
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
        addDebug(`👤 Client Saved: ${newClient.name}`);
        break;

      default:
        addDebug("⚠️ Unknown Intent: " + result.intent);
        showToast("Could not understand command.", "error");
    }
  }

  // --- IMAGE HANDLING ---
  async function analyzeImage(base64: string) {
    setDraftImage(base64);
    setStatus("THINKING");
    try {
      const result = await invoke("analyze_image", { imageData: base64 }) as any;
      setDraft(result);
    } catch (err: any) { showToast("Image AI Error: " + err, "error"); }
    finally {
      setStatus("IDLE");
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
    showToast("🚀 Starting Process...", "success");

    // 0. Validate Data
    if (!draft.amount || !draft.client) {
      showToast("Error: Missing Invoice Data (Amount or Client)", "error");
      setIsSaving(false);
      return;
    }

    try {
      if (draft.intent === "INVOICE") {
        const invoiceData = { ...draft };

        // Step 1: PDF Generation
        try {
          console.log("📄 Requesting PDF generation for:", invoiceData.id);
          const pdfPath = await generateInvoicePDF(invoiceData);
          showToast(`PDF Saved to: ${pdfPath}`, "success");
          invoiceData.pdf_path = pdfPath;
        } catch (pdfErr) {
          console.error("⚠️ PDF GENERATION FAILED:", pdfErr);
          showToast("⚠️ PDF Failed to generate, but Invoice was saved to Cloud.", "error");
          invoiceData.pdf_path = null;
        }

        // Step 2: Supabase
        console.log("☁️ Step 2: Saving to Supabase...");
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
          showToast("Supabase Error: " + error.message, "error");
          throw error;
        }

        // Step 3: Webhook
        const webhookUrl = localStorage.getItem("webhook_url");
        if (webhookUrl) {
          try {
            await fetch(webhookUrl, {
              method: "POST",
              mode: "no-cors",
              headers: { "Content-Type": "text/plain" },
              body: JSON.stringify(invoiceData)
            });
            console.log("✅ Webhook Sent (Blindly)");
          } catch (webhookErr) {
            console.error("⚠️ Webhook Failed:", webhookErr);
          }
        }

        // Step 4: Local UI Update & Persistence
        console.log("🔄 Step 4: Updating Local State & DB");
        setInvoices(prev => [invoiceData, ...prev]);

        try {
          await invoke("confirm_invoice", { invoice: invoiceData });
        } catch (localErr) {
          console.error("⚠️ Local DB Save Failed:", localErr);
        }

        showToast("✅ Data Saved to Cloud & Local!", "success");

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

      setDraft(null);
      setDraftImage(null);

    } catch (e: any) {
      console.error("❌ Fn Failure:", e);
      showToast("Critical Failure: " + e.message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function runDiagnostics() {
    showToast("1. Starting Diagnostic Test...", "success");

    try {
      console.log("Checking Supabase Client...");
      if (!supabase) throw new Error("Supabase Client is UNDEFINED");

      const { data, error } = await supabase
        .from('invoices')
        .insert([{ client: "TEST_PING", amount: 1, status: "test", id: `TEST-${Date.now()}` }])
        .select();

      if (error) throw error;
      showToast("✅ DATABASE SUCCESS!", "success");

      const url = localStorage.getItem("webhook_url");
      if (url) {
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ test: true })
        });
        showToast("✅ WEBHOOK SUCCESS!", "success");
      } else {
        showToast("⚠️ No Webhook URL found in settings.", "error");
      }

    } catch (err: any) {
      console.error(err);
      showToast("❌ FAILURE: " + (err.message || JSON.stringify(err)), "error");
    }
  }

  return (
    <AppContext.Provider
      value={{
        invoices, tasks, clients, calendarEvents, financials, recentActivity,
        draft, draftImage, isSaving, status, debugLogs, toast,
        isRecording, isBusy,
        setDraft, setDraftImage, setStatus, showToast, addDebug,
        startRecordingFlow, stopRecordingFlow, handleApproveInvoice, runDiagnostics,
        refreshData, openInvoice, emailInvoice, openSystemLink, analyzeImage,
        setTasks, setClients, setInvoices
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
