// Edge Function `trn-plan`: Wochenvorschlag mit Claude (oder Kopie der Vorwoche als Fallback).
// Ablauf: Auth → Rate Limit → Kontext (RLS) → Claude (Structured Output) → zod → Leitplanken →
// plan_week(status='vorschlag') → ai_log. Der API-Key liegt ausschließlich als Supabase Secret.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { PlanRequestSchema, PlanResponseAiSchema, PlanResponseSchema, normalizeAiResponse, type PlanItem, type Warnung } from "./_shared/schemas.ts";
import { addDays, todayIso, weekStart } from "./_shared/dates.ts";
import { checkPlan } from "./rules.ts";
import { buildContext } from "./context.ts";
import { PROMPT_VERSION, SYSTEM_PROMPT } from "./prompt.generated.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_PRO_TAG = 5;
const DEFAULT_MODEL = "claude-sonnet-5";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fallback = false,
  ) {
    super(message);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Nur POST" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    db: { schema: "training" },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const t0 = Date.now();
  let userId: string | null = null;
  let modell = Deno.env.get("CLAUDE_MODEL") || DEFAULT_MODEL;
  let logRequest: unknown = null;
  let logResponse: unknown = null;
  let tokens: { in: number; out: number } | null = null;

  const log = async (status: "ok" | "ungueltig" | "fehler" | "rate_limit", fehler?: string) => {
    if (!userId) return;
    await sb.from("ai_log").insert({
      user_id: userId,
      modell,
      prompt_version: PROMPT_VERSION,
      status,
      dauer_ms: Date.now() - t0,
      tokens_in: tokens?.in ?? null,
      tokens_out: tokens?.out ?? null,
      request: logRequest,
      response: logResponse,
      fehler: fehler ?? null,
    });
  };

  try {
    const { data: u, error: uErr } = await sb.auth.getUser();
    if (uErr || !u.user) throw new HttpError(401, "Nicht angemeldet.");
    userId = u.user.id;

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      /* leer */
    }
    const parsedReq = PlanRequestSchema.safeParse(body);
    if (!parsedReq.success) throw new HttpError(400, "Ungültige Anfrage: " + parsedReq.error.issues[0]?.message);
    const heute = todayIso();
    const wocheStart = weekStart(parsedReq.data.woche_start ?? addDays(weekStart(heute), 7));
    if (wocheStart < weekStart(heute)) throw new HttpError(400, "Zielwoche liegt in der Vergangenheit.");

    // Rate Limit: max. 5 Vorschläge je Nutzer und Tag (UTC)
    const tagStart = new Date();
    tagStart.setUTCHours(0, 0, 0, 0);
    const { count } = await sb.from("ai_log").select("id", { count: "exact", head: true }).gte("created_at", tagStart.toISOString()).neq("status", "rate_limit");
    if ((count ?? 0) >= MAX_PRO_TAG && parsedReq.data.modus === "claude") {
      await log("rate_limit", "Tageslimit erreicht");
      throw new HttpError(429, `Tageslimit erreicht (${MAX_PRO_TAG} Vorschläge pro Tag).`, true);
    }

    const { ruleCtx, prompt } = await buildContext(sb, wocheStart);

    let items: PlanItem[];
    let begruendung: string;
    let quelle: "claude" | "vorwoche";

    if (parsedReq.data.modus === "vorwoche") {
      // Fallback: aktiven Plan der Vorwoche (oder letzten aktiven Plan) um 7 Tage verschieben
      const { data: prev } = await sb
        .from("plan_week")
        .select("woche_start, plan_item(*)")
        .eq("status", "aktiv")
        .lt("woche_start", wocheStart)
        .order("woche_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!prev) throw new HttpError(404, "Kein aktiver Plan einer Vorwoche vorhanden.");
      const shift = Math.round((Date.parse(wocheStart) - Date.parse(prev.woche_start as string)) / 86_400_000);
      items = ((prev.plan_item as Record<string, unknown>[]) ?? []).map((i) => ({
        datum: addDays(i.datum as string, shift),
        tageszeit: i.tageszeit as PlanItem["tageszeit"],
        art: i.art as PlanItem["art"],
        unterart: (i.unterart as string | null) ?? null,
        dauer_min: i.dauer_min as number,
        intensitaet: i.intensitaet as PlanItem["intensitaet"],
        inhalt: (i.inhalt as Record<string, unknown>) ?? {},
        hinweis: (i.hinweis as string | null) ?? null,
      }));
      begruendung = `Kopie des Plans der Woche ab ${prev.woche_start} (um ${shift} Tage verschoben).`;
      quelle = "vorwoche";
      modell = "vorwoche";
    } else {
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) throw new HttpError(500, "ANTHROPIC_API_KEY ist nicht als Secret gesetzt.", true);
      const r = await claudeVorschlag(apiKey, modell, prompt, wocheStart);
      logRequest = { prompt, prompt_version: PROMPT_VERSION };
      logResponse = r.log;
      tokens = r.tokens;
      if (!r.ok) {
        await log("ungueltig", r.fehler);
        throw new HttpError(502, `Claude lieferte keine gültige Antwort: ${r.fehler}`, true);
      }
      items = r.plan.einheiten;
      begruendung = r.plan.begruendung;
      quelle = "claude";
    }

    const geprueft = checkPlan(items, ruleCtx, { korrigieren: true });
    const planId = await vorschlagSpeichern(sb, userId, wocheStart, quelle, begruendung, geprueft.items, geprueft.warnungen, {
      ...prompt.kennzahlen as Record<string, unknown>,
      last_geplant: geprueft.lastGeschaetzt,
      last_obergrenze: geprueft.lastObergrenze,
    }, quelle === "claude" ? modell : null);

    if (quelle === "claude") await log("ok");
    return json({ plan_week_id: planId, begruendung, warnungen: geprueft.warnungen, quelle });
  } catch (e) {
    if (e instanceof HttpError) {
      if (e.status >= 500 && e.status !== 502) await log("fehler", e.message);
      return json({ error: e.message, fallback_verfuegbar: e.fallback }, e.status);
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("trn-plan:", msg);
    await log("fehler", msg);
    return json({ error: msg, fallback_verfuegbar: true }, 500);
  }
});

// ---------------------------------------------------------------------------
type ClaudeResult =
  | { ok: true; plan: z.infer<typeof PlanResponseSchema>; tokens: { in: number; out: number }; log: unknown }
  | { ok: false; fehler: string; tokens: { in: number; out: number } | null; log: unknown };

async function claudeVorschlag(apiKey: string, modell: string, prompt: Record<string, unknown>, wocheStart: string): Promise<ClaudeResult> {
  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  const schema = z.toJSONSchema(PlanResponseAiSchema);
  const userText = `Erstelle den Wochenvorschlag für die Woche ab ${wocheStart} (Montag). Kontext als JSON:\n\n${JSON.stringify(prompt)}`;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userText }];
  const tokens = { in: 0, out: 0 };
  const versuche: unknown[] = [];
  let letzterFehler = "";

  for (let versuch = 0; versuch < 2; versuch++) {
    let res: Anthropic.Message;
    try {
      res = await client.messages.create({
        model: modell,
        max_tokens: 8000,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: { type: "json_schema", schema } },
      } as Anthropic.MessageCreateParamsNonStreaming);
    } catch (e) {
      // API-/Netzfehler → kein Retry auf Anwendungsebene (SDK hat bereits einmal wiederholt)
      const msg = e instanceof Anthropic.APIError ? `API ${e.status}: ${e.message}` : e instanceof Error ? e.message : String(e);
      return { ok: false, fehler: msg, tokens: versuche.length ? tokens : null, log: { versuche, fehler: msg } };
    }
    tokens.in += res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
    tokens.out += res.usage.output_tokens;
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("");
    versuche.push({ versuch, stop_reason: res.stop_reason, text: text.slice(0, 20_000) });

    if (res.stop_reason === "refusal") {
      letzterFehler = "Anfrage wurde vom Modell abgelehnt.";
      break;
    }
    if (res.stop_reason === "max_tokens") letzterFehler = "Antwort abgeschnitten (max_tokens).";
    else {
      try {
        const raw = JSON.parse(text);
        const ai = PlanResponseAiSchema.parse(raw);
        const strict = PlanResponseSchema.safeParse(normalizeAiResponse(ai));
        if (strict.success) {
          const plan = strict.data;
          if (plan.woche_start !== wocheStart) plan.woche_start = wocheStart;
          return { ok: true, plan, tokens, log: { versuche } };
        }
        letzterFehler = strict.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      } catch (e) {
        letzterFehler = e instanceof Error ? e.message.slice(0, 500) : String(e);
      }
    }
    // Ein Retry mit Fehlermeldung
    messages.push({ role: "assistant", content: text || "(leer)" });
    messages.push({
      role: "user",
      content: `Die Antwort war ungültig: ${letzterFehler}. Antworte erneut ausschließlich mit einem JSON-Objekt nach dem Schema, alle Datumswerte in der Woche ab ${wocheStart}.`,
    });
  }
  return { ok: false, fehler: letzterFehler || "unbekannt", tokens, log: { versuche } };
}

async function vorschlagSpeichern(
  sb: SupabaseClient,
  userId: string,
  wocheStart: string,
  quelle: "claude" | "vorwoche",
  begruendung: string,
  items: PlanItem[],
  warnungen: Warnung[],
  kennzahlen: Record<string, unknown>,
  modell: string | null,
): Promise<string> {
  // Alte Vorschläge dieser Woche verwerfen (ein Vorschlag je Woche)
  await sb.from("plan_week").update({ status: "verworfen", updated_at: new Date().toISOString() }).eq("woche_start", wocheStart).eq("status", "vorschlag");
  const { data: pw, error } = await sb
    .from("plan_week")
    .insert({ user_id: userId, woche_start: wocheStart, status: "vorschlag", quelle, begruendung, warnungen, kennzahlen, modell, prompt_version: modell ? PROMPT_VERSION : null })
    .select("id")
    .single();
  if (error) throw new Error("plan_week: " + error.message);
  const planId = pw.id as string;
  if (items.length) {
    const { error: iErr } = await sb.from("plan_item").insert(
      items.map((i, idx) => ({
        plan_week_id: planId,
        datum: i.datum,
        tageszeit: i.tageszeit,
        art: i.art,
        unterart: i.unterart ?? null,
        dauer_min: i.dauer_min,
        intensitaet: i.intensitaet,
        inhalt: i.inhalt ?? {},
        hinweis: i.hinweis ?? null,
        sortierung: idx,
      })),
    );
    if (iErr) throw new Error("plan_item: " + iErr.message);
  }
  return planId;
}
