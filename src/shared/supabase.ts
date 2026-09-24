import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseKonfiguriert = Boolean(url && anon);

// Alle Trainingsdaten liegen im Schema `training` (RLS: user_id = auth.uid()).
// Auth wird mit der Platzbelegung geteilt (gleiches Projekt, gleicher Login).
export const supabase = createClient(url ?? "https://example.invalid", anon ?? "anon", {
  db: { schema: "training" },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "trn.auth" },
});

export const FUNCTIONS_URL = `${url ?? ""}/functions/v1`;
