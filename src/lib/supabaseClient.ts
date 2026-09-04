import { createClient } from '@supabase/supabase-js';

// Nur für den Login-Check (Zugriffssperre auf die App) - Offerten, Vergleiche und alle
// sonstigen Projektdaten bleiben weiterhin ausschliesslich lokal im Browser (IndexedDB),
// es wird nichts davon an Supabase gesendet.
//
// Projekt-URL und "publishable"-Key sind bewusst öffentlich (kein Geheimnis): Sie
// identifizieren nur das Supabase-Projekt, echte Sicherheit kommt aus den Supabase-
// Zugriffsregeln (hier: Self-Signup deaktiviert, Konten werden manuell eingeladen).
const SUPABASE_URL = 'https://ntzlalupizrylsgsrqhy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YWFReySze6ghuwpKQGm4ow_cYOkXaLq';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
