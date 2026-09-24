import { NavLink, Outlet } from "react-router-dom";
import { useOfflineQueue } from "../offline/sync";
import { useInvalidateAll } from "../shared/queries";
import { cx } from "../shared/ui";

const TABS = [
  { to: "/", label: "Heute", icon: "◉" },
  { to: "/erfassen", label: "Erfassen", icon: "＋" },
  { to: "/woche", label: "Woche", icon: "▦" },
  { to: "/verlauf", label: "Verlauf", icon: "∿" },
  { to: "/einstellungen", label: "Mehr", icon: "⚙" },
];

export default function Layout() {
  const invalidate = useInvalidateAll();
  const { entries, online, sync } = useOfflineQueue(invalidate);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      {(entries.length > 0 || !online) && (
        <button
          type="button"
          onClick={() => sync()}
          className={cx(
            "sticky top-0 z-20 px-3 py-2 pt-[max(env(safe-area-inset-top),0.5rem)] text-left text-sm",
            online ? "bg-amber-500 text-slate-950" : "bg-slate-700 text-white",
          )}
        >
          {!online ? "Offline — " : ""}
          {entries.length > 0
            ? `${entries.length} Erfassung${entries.length === 1 ? "" : "en"} gepuffert${online ? " · antippen zum Synchronisieren" : ", wird bei Verbindung gesendet"}`
            : "Erfassungen werden zwischengespeichert."}
          {entries.some((e) => e.fehler && e.versuche > 0) && (
            <span className="block text-xs opacity-80">Letzter Fehler: {entries.find((e) => e.fehler)?.fehler}</span>
          )}
        </button>
      )}

      <main className="flex-1 px-3 pb-24 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-slate-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-[#0b1220]/95">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === "/"}
              className={({ isActive }) =>
                cx("tap flex flex-col items-center justify-center py-1 text-xs", isActive ? "text-lime-600 dark:text-lime-400" : "text-slate-500 dark:text-slate-400")
              }
            >
              <span className="text-xl leading-none" aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
