import { createClient } from "@supabase/supabase-js";
import type { Database } from "../shared/types/database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL. Add it to your frontend environment.");
}

if (!supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY. Add it to your frontend environment.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
