export type CommandIntent = 'create_invoice' | 'create_calendar' | 'create_task' | 'create_client';

export interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  duration_minutes: number;
}

export interface Task {
  id: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  done: boolean;
  due_date?: string | null;
  type?: 'task'; // Added for UI grouping
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  company?: string;
}

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
  intent?: string; // Optional for backward compatibility with check
  created_at?: string;
  date?: string;
  type?: 'invoice'; // Added for UI grouping
}

export interface Contact {
  intent?: "CONTACT";
  id: string;
  name: string;
  phone: string;
  company?: string | null;
  created_at: string;
}

export interface Expense {
  intent?: "EXPENSE";
  id: string;
  merchant: string;
  amount: number;
  category: string;
  date: string;
  image_path?: string;
  status: string;
}

export interface FinancialSummary {
  revenue: number;
  expenses: number;
  profit: number;
}

export interface ActivityItem {
  id: string;
  intent: "INVOICE" | "EXPENSE";
  description: string;
  amount: number;
  date: string;
  file_path?: string;
}

export type Tab = "DASHBOARD" | "INVOICES" | "CONTACTS" | "TASKS" | "CALENDAR" | "SETTINGS";
