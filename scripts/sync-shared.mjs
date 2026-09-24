// Kopiert die gemeinsamen Module (zod-Schemas, Leitplanken, Datumshelfer) in die Edge Function
// und erzeugt prompt.generated.ts aus prompt.md, damit Frontend und Deno-Function exakt
// denselben Code bzw. Prompt verwenden. Deno braucht Dateiendungen in Imports → werden ergänzt.
// Aufruf: npm run sync-shared  (vor jedem Deploy der Function)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join("src", "shared");
const FN = join("supabase", "functions", "trn-plan");
const DST = join(FN, "_shared");
mkdirSync(DST, { recursive: true });

for (const f of ["schemas.ts", "rules.ts", "dates.ts"]) {
  const code = readFileSync(join(SRC, f), "utf8").replace(/from "(\.\/[a-z]+)"/g, 'from "$1.ts"');
  writeFileSync(join(DST, f), `// GENERIERT aus src/shared/${f} — nicht hier bearbeiten (npm run sync-shared)\n${code}`);
  console.log(`${f} → ${DST}`);
}

const md = readFileSync(join(FN, "prompt.md"), "utf8");
const version = /<!--\s*version:\s*([\w.-]+)\s*-->/.exec(md)?.[1] ?? "0.0.0";
const body = md.replace(/<!--[\s\S]*?-->\s*/, "");
writeFileSync(
  join(FN, "prompt.generated.ts"),
  `// GENERIERT aus prompt.md — nicht hier bearbeiten (npm run sync-shared)\nexport const PROMPT_VERSION = ${JSON.stringify(version)};\nexport const SYSTEM_PROMPT = ${JSON.stringify(body)};\n`,
);
console.log(`prompt.md (v${version}) → prompt.generated.ts`);
