import { useEffect, useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseKonfiguriert } from "../shared/supabase";
import Layout from "./Layout";
import Login from "./Login";
import Hinweis, { hinweisBestaetigt } from "./Hinweis";
import Today from "../features/today/Today";
import Log from "../features/log/Log";
import Week from "../features/week/Week";
import History from "../features/history/History";
import SettingsScreen from "../features/settings/Settings";
import { Banner } from "../shared/ui";

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
});

function Gate() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [hinweis, setHinweis] = useState(hinweisBestaetigt());
  const [defaultsOk, setDefaultsOk] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Beim ersten Login: Übungskatalog + Startverfügbarkeit anlegen (nur, was fehlt).
  useEffect(() => {
    if (!session) {
      setDefaultsOk(false);
      qc.clear();
      return;
    }
    supabase
      .rpc("ensure_defaults")
      .then(({ error }) => {
        if (error) console.warn("ensure_defaults:", error.message);
        setDefaultsOk(true);
      });
  }, [session]);

  if (!supabaseKonfiguriert) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Banner tone="error">
          Supabase ist nicht konfiguriert: <code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_ANON_KEY</code> fehlen (siehe .env.example).
        </Banner>
      </div>
    );
  }
  if (session === undefined) return null;
  if (!session) return <Login />;
  if (!hinweis) return <Hinweis onAccept={() => setHinweis(true)} />;
  if (!defaultsOk) return null;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Today />} />
        <Route path="/erfassen" element={<Log />} />
        <Route path="/erfassen/:art" element={<Log />} />
        <Route path="/woche" element={<Week />} />
        <Route path="/woche/:start" element={<Week />} />
        <Route path="/verlauf" element={<History />} />
        <Route path="/einstellungen" element={<SettingsScreen />} />
        <Route path="*" element={<Today />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <HashRouter>
        <Gate />
      </HashRouter>
    </QueryClientProvider>
  );
}
