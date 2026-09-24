-- =============================================================================
-- Trainingssteuerung — Schema `training`
-- Idempotent: kann mehrfach ausgeführt werden (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
-- Berührt NICHTS in `public` (Platzbelegung). FK auf auth.users(id) wie public.profiles.
-- =============================================================================

create schema if not exists training;

-- Zugriff: nur eingeloggte Nutzer (authenticated) + service_role. anon bekommt nichts.
grant usage on schema training to authenticated, service_role;
alter default privileges in schema training grant all on tables to authenticated, service_role;
alter default privileges in schema training grant all on sequences to authenticated, service_role;
alter default privileges in schema training grant execute on functions to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Einstellungen je Nutzer
-- -----------------------------------------------------------------------------
create table if not exists training.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hf_max int check (hf_max is null or hf_max between 100 and 230),
  hf_ruhe int check (hf_ruhe is null or hf_ruhe between 30 and 120),
  ziel text not null default 'allgemeine Spielfitness',
  ziel_typ text not null default 'spielfitness' check (ziel_typ in ('spielfitness','ausdauer','kraft','wettkampf','sonstiges')),
  wochenstart smallint not null default 1 check (wochenstart between 1 and 7),
  kraft_pro_woche_ziel smallint not null default 2 check (kraft_pro_woche_ziel between 0 and 7),
  intervall_pro_woche_max smallint not null default 1 check (intervall_pro_woche_max between 0 and 3),
  entlastungswoche_aktiv boolean not null default true,
  hinweis_bestaetigt_at timestamptz,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Zeitfenster (fest / möglich)
-- -----------------------------------------------------------------------------
create table if not exists training.availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wochentag smallint not null check (wochentag between 1 and 7),          -- 1 = Montag
  tageszeit text not null check (tageszeit in ('morgens','mittags','abends')),
  typ text not null check (typ in ('fix_tennis','moeglich')),
  erlaubte_arten text[] not null default '{}',                              -- tennis | ballmaschine | lauf_ga1 | lauf_4x4 | kraft
  dauer_min int not null default 60 check (dauer_min between 10 and 300),
  created_at timestamptz not null default now()
);
create index if not exists availability_user_idx on training.availability(user_id, wochentag);

-- -----------------------------------------------------------------------------
-- Ausnahmen (Urlaub, Termine)
-- -----------------------------------------------------------------------------
create table if not exists training.week_constraint (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  datum date not null,
  typ text not null check (typ in ('nicht_verfuegbar','eingeschraenkt')),
  notiz text,
  created_at timestamptz not null default now()
);
create index if not exists week_constraint_user_idx on training.week_constraint(user_id, datum);

-- -----------------------------------------------------------------------------
-- Strecken (Laufen)
-- -----------------------------------------------------------------------------
create table if not exists training.strecke (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  distanz_km numeric(5,2),
  aktiv boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Übungskatalog (Kraft)
-- -----------------------------------------------------------------------------
create table if not exists training.exercise (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kategorie text not null default 'sonstiges',
  aktiv boolean not null default true,
  sortierung smallint not null default 100,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- -----------------------------------------------------------------------------
-- Wochenpläne
-- -----------------------------------------------------------------------------
create table if not exists training.plan_week (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  woche_start date not null,
  status text not null default 'vorschlag' check (status in ('vorschlag','aktiv','verworfen')),
  quelle text not null default 'manuell' check (quelle in ('claude','manuell','vorwoche')),
  begruendung text,
  warnungen jsonb not null default '[]'::jsonb,
  kennzahlen jsonb,
  modell text,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Max. ein aktiver Plan je Woche (verworfene dürfen sich häufen).
create unique index if not exists plan_week_one_active_idx
  on training.plan_week(user_id, woche_start) where status = 'aktiv';
create index if not exists plan_week_user_idx on training.plan_week(user_id, woche_start desc);

create table if not exists training.plan_item (
  id uuid primary key default gen_random_uuid(),
  plan_week_id uuid not null references training.plan_week(id) on delete cascade,
  datum date not null,
  tageszeit text not null default 'abends' check (tageszeit in ('morgens','mittags','abends')),
  art text not null check (art in ('tennis','lauf_ga1','lauf_4x4','kraft')),
  unterart text,
  dauer_min int not null check (dauer_min between 10 and 300),
  intensitaet text not null default 'mittel' check (intensitaet in ('locker','mittel','hart')),
  inhalt jsonb not null default '{}'::jsonb,
  hinweis text,
  erledigt boolean not null default false,
  sortierung smallint not null default 0
);
create index if not exists plan_item_week_idx on training.plan_item(plan_week_id, datum);

-- -----------------------------------------------------------------------------
-- Durchgeführte Einheiten
-- -----------------------------------------------------------------------------
create table if not exists training.session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  datum date not null,
  startzeit time,
  art text not null check (art in ('tennis','lauf_ga1','lauf_4x4','kraft')),
  unterart text,
  geplant boolean not null default false,
  dauer_min int not null check (dauer_min between 1 and 600),
  srpe smallint not null check (srpe between 1 and 10),
  last numeric generated always as (dauer_min * srpe) stored,              -- Foster-Last
  befinden_vorher smallint check (befinden_vorher is null or befinden_vorher between 1 and 5),
  beschwerden text,
  beschwerden_stelle text,
  notiz text,
  plan_item_id uuid references training.plan_item(id) on delete set null,
  client_id uuid unique,                                                    -- Idempotenz für Offline-Sync
  created_at timestamptz not null default now()
);
create index if not exists session_user_datum_idx on training.session(user_id, datum desc);

create table if not exists training.run_detail (
  session_id uuid primary key references training.session(id) on delete cascade,
  distanz_km numeric(6,2),
  pace_sek_pro_km int,
  hf_avg int,
  hf_max int,
  strecke_id uuid references training.strecke(id) on delete set null
);

create table if not exists training.interval_rep (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references training.session(id) on delete cascade,
  nr smallint not null,
  dauer_sek int,
  distanz_m int,
  hf_avg int,
  hf_max int,
  rpe smallint check (rpe is null or rpe between 1 and 10),
  unique (session_id, nr)
);

create table if not exists training.tennis_detail (
  session_id uuid primary key references training.session(id) on delete cascade,
  schwerpunkte text[] not null default '{}',
  programm text
);

create table if not exists training.strength_set (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references training.session(id) on delete cascade,
  exercise_id uuid not null references training.exercise(id) on delete restrict,
  satz_nr smallint not null,
  wdh smallint not null,
  gewicht_kg numeric(6,2) not null default 0,
  rir smallint check (rir is null or rir between 0 and 10)
);
create index if not exists strength_set_session_idx on training.strength_set(session_id);
create index if not exists strength_set_exercise_idx on training.strength_set(exercise_id);

-- -----------------------------------------------------------------------------
-- Tagesbefinden
-- -----------------------------------------------------------------------------
create table if not exists training.daily_check (
  user_id uuid not null references auth.users(id) on delete cascade,
  datum date not null,
  schlaf smallint check (schlaf is null or schlaf between 1 and 5),
  energie smallint check (energie is null or energie between 1 and 5),
  muskelkater smallint check (muskelkater is null or muskelkater between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, datum)
);

-- -----------------------------------------------------------------------------
-- KI-Protokoll (ohne Key)
-- -----------------------------------------------------------------------------
create table if not exists training.ai_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  modell text,
  prompt_version text,
  status text not null check (status in ('ok','ungueltig','fehler','rate_limit')),
  dauer_ms int,
  tokens_in int,
  tokens_out int,
  request jsonb,
  response jsonb,
  fehler text
);
create index if not exists ai_log_user_idx on training.ai_log(user_id, created_at desc);

-- =============================================================================
-- RLS: jede Tabelle, user_id = auth.uid(); Kindtabellen über die Elterntabelle.
-- =============================================================================
alter table training.settings        enable row level security;
alter table training.availability    enable row level security;
alter table training.week_constraint enable row level security;
alter table training.strecke         enable row level security;
alter table training.exercise        enable row level security;
alter table training.plan_week       enable row level security;
alter table training.plan_item       enable row level security;
alter table training.session         enable row level security;
alter table training.run_detail      enable row level security;
alter table training.interval_rep    enable row level security;
alter table training.tennis_detail   enable row level security;
alter table training.strength_set    enable row level security;
alter table training.daily_check     enable row level security;
alter table training.ai_log          enable row level security;

-- Tabellen mit user_id
do $$
declare t text;
begin
  foreach t in array array['settings','availability','week_constraint','strecke','exercise','plan_week','session','daily_check','ai_log'] loop
    execute format('drop policy if exists own_rows on training.%I', t);
    execute format(
      'create policy own_rows on training.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Kindtabellen von session
do $$
declare t text;
begin
  foreach t in array array['run_detail','interval_rep','tennis_detail','strength_set'] loop
    execute format('drop policy if exists own_rows on training.%I', t);
    execute format(
      'create policy own_rows on training.%I for all to authenticated
         using (exists (select 1 from training.session s where s.id = session_id and s.user_id = (select auth.uid())))
         with check (exists (select 1 from training.session s where s.id = session_id and s.user_id = (select auth.uid())))', t);
  end loop;
end $$;

-- Kindtabelle von plan_week
drop policy if exists own_rows on training.plan_item;
create policy own_rows on training.plan_item for all to authenticated
  using (exists (select 1 from training.plan_week w where w.id = plan_week_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from training.plan_week w where w.id = plan_week_id and w.user_id = (select auth.uid())));

-- =============================================================================
-- Views (security_invoker → RLS greift)
-- =============================================================================
create or replace view training.v_week_load with (security_invoker = true) as
select
  s.user_id,
  (date_trunc('week', s.datum))::date as woche_start,
  sum(s.last)::numeric as last_gesamt,
  count(*)::int as einheiten,
  count(*) filter (where s.art = 'tennis')::int as n_tennis,
  count(*) filter (where s.art = 'lauf_ga1')::int as n_lauf_ga1,
  count(*) filter (where s.art = 'lauf_4x4')::int as n_lauf_4x4,
  count(*) filter (where s.art = 'kraft')::int as n_kraft,
  count(*) filter (where s.srpe >= 7)::int as n_hart,
  sum(s.dauer_min)::int as minuten
from training.session s
group by s.user_id, date_trunc('week', s.datum);

create or replace view training.v_run_trend with (security_invoker = true) as
select
  s.user_id, s.id as session_id, s.datum, s.dauer_min, s.srpe,
  r.distanz_km, r.pace_sek_pro_km, r.hf_avg, r.hf_max, r.strecke_id,
  case when r.hf_avg > 0 and r.pace_sek_pro_km > 0
       then round((1000.0 / r.pace_sek_pro_km * 60) / r.hf_avg * 100, 2) end as effizienz  -- m/min je 100 Schläge
from training.session s
join training.run_detail r on r.session_id = s.id
where s.art = 'lauf_ga1';

create or replace view training.v_4x4_trend with (security_invoker = true) as
select
  s.user_id, s.id as session_id, s.datum, s.srpe,
  count(i.id)::int as wiederholungen,
  round(avg(case when i.distanz_m > 0 and i.dauer_sek > 0 then i.dauer_sek::numeric / (i.distanz_m / 1000.0) end))::int as pace_avg_sek_pro_km,
  round(avg(i.hf_avg))::int as hf_avg,
  max(i.hf_max)::int as hf_max,
  round(avg(i.rpe), 1) as rpe_avg
from training.session s
join training.interval_rep i on i.session_id = s.id
where s.art = 'lauf_4x4'
group by s.user_id, s.id, s.datum, s.srpe;

create or replace view training.v_strength_progress with (security_invoker = true) as
select
  s.user_id, s.datum, s.id as session_id, e.id as exercise_id, e.name as uebung,
  max(st.gewicht_kg) as max_gewicht_kg,
  max(st.wdh) filter (where st.gewicht_kg = (select max(gewicht_kg) from training.strength_set x where x.session_id = s.id and x.exercise_id = e.id))::int as wdh_bei_max,
  round(max(st.gewicht_kg * (1 + st.wdh / 30.0)), 1) as e1rm_epley,
  sum(st.wdh * st.gewicht_kg) as volumen_kg
from training.session s
join training.strength_set st on st.session_id = s.id
join training.exercise e on e.id = st.exercise_id
where s.art = 'kraft'
group by s.user_id, s.datum, s.id, e.id, e.name;

-- CSV-Export aller Einheiten (Einstellungen → Export)
create or replace view training.v_session_export with (security_invoker = true) as
select
  s.user_id, s.datum, s.startzeit, s.art, s.unterart, s.geplant, s.dauer_min, s.srpe, s.last,
  s.befinden_vorher, s.beschwerden, s.beschwerden_stelle, s.notiz,
  r.distanz_km, r.pace_sek_pro_km, r.hf_avg, r.hf_max,
  t.schwerpunkte, t.programm,
  (select count(*) from training.interval_rep i where i.session_id = s.id)::int as intervalle,
  (select string_agg(e.name || ' ' || st.satz_nr || 'x' || st.wdh || '@' || st.gewicht_kg, '; ' order by e.sortierung, st.satz_nr)
     from training.strength_set st join training.exercise e on e.id = st.exercise_id where st.session_id = s.id) as kraft
from training.session s
left join training.run_detail r on r.session_id = s.id
left join training.tennis_detail t on t.session_id = s.id;

-- =============================================================================
-- Seed je Nutzer: Übungskatalog + Startverfügbarkeit (Di/Do Tennis fix,
-- übrige Tage morgens Ballmaschine, abends Laufen/Kraft). Wird von der App
-- beim ersten Start aufgerufen; legt nur an, was fehlt.
-- =============================================================================
create or replace function training.ensure_defaults()
returns void
language plpgsql
security invoker
set search_path = training, pg_temp
as $$
declare
  uid uuid := auth.uid();
  d smallint;
begin
  if uid is null then
    raise exception 'nicht angemeldet';
  end if;

  insert into training.settings (user_id) values (uid) on conflict (user_id) do nothing;

  if not exists (select 1 from training.exercise where user_id = uid) then
    insert into training.exercise (user_id, name, kategorie, sortierung) values
      (uid, 'Kniebeuge', 'beine', 10),
      (uid, 'Kreuzheben rumänisch', 'beine', 20),
      (uid, 'Bankdrücken', 'druck', 30),
      (uid, 'Rudern', 'zug', 40),
      (uid, 'Schulterdrücken', 'druck', 50),
      (uid, 'Klimmzug/Latzug', 'zug', 60),
      (uid, 'Ausfallschritt', 'beine', 70),
      (uid, 'Wadenheben', 'beine', 80),
      (uid, 'Pallof Press', 'rumpf', 90),
      (uid, 'Rotationsübung am Kabel', 'rumpf', 100),
      (uid, 'Plank', 'rumpf', 110);
  end if;

  if not exists (select 1 from training.availability where user_id = uid) then
    -- Di (2) und Do (4): Tennistraining fest, abends, 90 min
    insert into training.availability (user_id, wochentag, tageszeit, typ, erlaubte_arten, dauer_min) values
      (uid, 2, 'abends', 'fix_tennis', '{tennis}', 90),
      (uid, 4, 'abends', 'fix_tennis', '{tennis}', 90);
    -- Übrige Tage: morgens Ballmaschine (60), abends Laufen/Kraft (60)
    foreach d in array array[1,3,5,6,7]::smallint[] loop
      insert into training.availability (user_id, wochentag, tageszeit, typ, erlaubte_arten, dauer_min) values
        (uid, d, 'morgens', 'moeglich', '{ballmaschine}', 60),
        (uid, d, 'abends',  'moeglich', '{lauf_ga1,lauf_4x4,kraft}', 60);
    end loop;
  end if;
end $$;

-- Grants für bereits angelegte Objekte (Default Privileges greifen nur für künftige)
grant all on all tables in schema training to authenticated, service_role;
grant all on all sequences in schema training to authenticated, service_role;
grant execute on all functions in schema training to authenticated, service_role;
