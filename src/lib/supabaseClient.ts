
import { createClient } from "@supabase/supabase-js";

// You must add your Supabase URL and public (anon) key here.
const SUPABASE_URL = "YOUR_SUPABASE_URL"; // <-- Replace this
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"; // <-- Replace this

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
