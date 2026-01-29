import { invoke as tauriInvoke } from "@tauri-apps/api/core";

// Define the shape of the Window object with Tauri internals if needed,
// but we just want to catch the error.
// Actually, checking window.__TAURI_INTERNALS__ is the v2 way to see if we are in Tauri.

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function invoke<T>(cmd: string, args?: any): Promise<T> {
  if (isTauri) {
    return tauriInvoke(cmd, args);
  } else {
    console.warn(`[Browser Mock] invoke("${cmd}") called with:`, args);
    // Return mock data based on command to allow UI to render
    switch (cmd) {
      case "get_invoices": return [] as any;
      case "get_tasks": return [] as any;
      case "get_contacts": return [] as any;
      case "get_expenses": return [] as any;
      case "get_calendar_events": return [] as any;
      case "get_financial_summary": return { revenue: 0, expenses: 0, profit: 0 } as any;
      case "get_recent_activity": return [] as any;
      case "init_db": return null as any;
      default: return null as any;
    }
  }
}
