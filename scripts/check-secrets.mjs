// Prüft den Build (dist/) und das Repo auf versehentlich eingebettete Secrets.
// Exit 1 bei Fund. Läuft im CI nach dem Build.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PATTERNS = [/sk-ant-[A-Za-z0-9_-]{10,}/, /SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S/, /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}/];
const ROOTS = ["dist", "src", "supabase"];
const SKIP = new Set(["node_modules", ".git"]);

let hits = 0;
function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(js|mjs|ts|tsx|html|css|json|md|sql)$/.test(name)) {
      const text = readFileSync(p, "utf8");
      for (const re of PATTERNS) {
        if (re.test(text)) {
          console.error(`Secret-Muster ${re} in ${p}`);
          hits++;
        }
      }
    }
  }
}
for (const r of ROOTS) walk(r);
if (hits > 0) {
  console.error(`${hits} Fund(e) — Abbruch.`);
  process.exit(1);
}
console.log("Keine Secret-Muster gefunden.");
