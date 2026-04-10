import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables.");
}

const normalizedUrl = supabaseUrl.startsWith("http")
  ? supabaseUrl
  : `https://${supabaseUrl}.supabase.co`;

export const supabase = createClient(normalizedUrl, supabaseAnonKey);
