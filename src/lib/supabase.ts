import { createClient } from '@supabase/supabase-js';

// 1. Read from the .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. Debug Log (Check Console if it fails)
console.log("Supabase Config:", {
    url: supabaseUrl ? "Found ✅" : "Missing ❌",
    key: supabaseKey ? "Found ✅" : "Missing ❌"
});

// 3. Safety Check
if (!supabaseUrl || !supabaseKey) {
    throw new Error("❌ CRITICAL: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file");
}

// 4. Initialize
export const supabase = createClient(supabaseUrl, supabaseKey);