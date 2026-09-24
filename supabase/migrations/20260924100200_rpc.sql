-- =============================================================================
-- RPCs (security invoker → RLS greift). Atomar, idempotent über client_id,
-- damit die Offline-Queue Erfassungen gefahrlos wiederholen kann.
-- =============================================================================

-- Einheit inkl. Details in einer Transaktion speichern. Rückgabe: session.id
create or replace function training.save_session(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = training, pg_temp
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  art text := p->>'art';
  r jsonb;
  dist numeric := nullif(p->>'distanz_km','')::numeric;
begin
  if uid is null then raise exception 'nicht angemeldet'; end if;

  select id into sid from training.session where client_id = (p->>'client_id')::uuid and user_id = uid;
  if sid is not null then return sid; end if;

  insert into training.session (user_id, client_id, datum, startzeit, art, unterart, geplant, dauer_min, srpe,
                                befinden_vorher, beschwerden, beschwerden_stelle, notiz, plan_item_id)
  values (uid, (p->>'client_id')::uuid, (p->>'datum')::date, nullif(p->>'startzeit','')::time, art,
          nullif(p->>'unterart',''), coalesce((p->>'geplant')::boolean, false), (p->>'dauer_min')::int,
          (p->>'srpe')::smallint, nullif(p->>'befinden_vorher','')::smallint, nullif(p->>'beschwerden',''),
          nullif(p->>'beschwerden_stelle',''), nullif(p->>'notiz',''), nullif(p->>'plan_item_id','')::uuid)
  returning id into sid;

  if art = 'tennis' then
    insert into training.tennis_detail (session_id, schwerpunkte, programm)
    values (sid, coalesce(array(select jsonb_array_elements_text(coalesce(p->'schwerpunkte','[]'::jsonb))), '{}'), nullif(p->>'programm',''));
  elsif art = 'lauf_ga1' then
    insert into training.run_detail (session_id, distanz_km, pace_sek_pro_km, hf_avg, hf_max, strecke_id)
    values (sid, dist,
            case when dist > 0 then round((p->>'dauer_min')::numeric * 60 / dist)::int end,
            nullif(p->>'hf_avg','')::int, nullif(p->>'hf_max','')::int, nullif(p->>'strecke_id','')::uuid);
  elsif art = 'lauf_4x4' then
    for r in select * from jsonb_array_elements(coalesce(p->'intervalle','[]'::jsonb)) loop
      insert into training.interval_rep (session_id, nr, dauer_sek, distanz_m, hf_avg, hf_max, rpe)
      values (sid, (r->>'nr')::smallint, nullif(r->>'dauer_sek','')::int, nullif(r->>'distanz_m','')::int,
              nullif(r->>'hf_avg','')::int, nullif(r->>'hf_max','')::int, nullif(r->>'rpe','')::smallint);
    end loop;
  elsif art = 'kraft' then
    for r in select * from jsonb_array_elements(coalesce(p->'saetze','[]'::jsonb)) loop
      insert into training.strength_set (session_id, exercise_id, satz_nr, wdh, gewicht_kg, rir)
      values (sid, (r->>'exercise_id')::uuid, (r->>'satz_nr')::smallint, (r->>'wdh')::smallint,
              coalesce(nullif(r->>'gewicht_kg','')::numeric, 0), nullif(r->>'rir','')::smallint);
    end loop;
  end if;

  if nullif(p->>'plan_item_id','') is not null then
    update training.plan_item set erledigt = true where id = (p->>'plan_item_id')::uuid;
  end if;
  return sid;
end $$;

-- Plan aktivieren: andere aktive Pläne derselben Woche werden verworfen.
create or replace function training.activate_plan(p_plan_week_id uuid)
returns void
language plpgsql
security invoker
set search_path = training, pg_temp
as $$
declare w record;
begin
  select * into w from training.plan_week where id = p_plan_week_id;
  if w is null then raise exception 'Plan nicht gefunden'; end if;
  update training.plan_week set status = 'verworfen', updated_at = now()
   where user_id = w.user_id and woche_start = w.woche_start and status in ('aktiv','vorschlag') and id <> p_plan_week_id;
  update training.plan_week set status = 'aktiv', updated_at = now() where id = p_plan_week_id;
end $$;

-- Planelemente eines Plans komplett ersetzen (Bearbeiten im Frontend). Erledigt-Status bleibt
-- erhalten, wenn die id mitgegeben wird.
create or replace function training.replace_plan_items(p_plan_week_id uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = training, pg_temp
as $$
declare r jsonb; keep uuid[] := '{}';
begin
  if not exists (select 1 from training.plan_week where id = p_plan_week_id) then
    raise exception 'Plan nicht gefunden';
  end if;
  for r in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    if nullif(r->>'id','') is not null and exists (select 1 from training.plan_item where id = (r->>'id')::uuid and plan_week_id = p_plan_week_id) then
      update training.plan_item set datum = (r->>'datum')::date, tageszeit = r->>'tageszeit', art = r->>'art',
             unterart = nullif(r->>'unterart',''), dauer_min = (r->>'dauer_min')::int, intensitaet = r->>'intensitaet',
             inhalt = coalesce(r->'inhalt','{}'::jsonb), hinweis = nullif(r->>'hinweis','')
       where id = (r->>'id')::uuid;
      keep := keep || (r->>'id')::uuid;
    else
      insert into training.plan_item (plan_week_id, datum, tageszeit, art, unterart, dauer_min, intensitaet, inhalt, hinweis)
      values (p_plan_week_id, (r->>'datum')::date, r->>'tageszeit', r->>'art', nullif(r->>'unterart',''), (r->>'dauer_min')::int,
              r->>'intensitaet', coalesce(r->'inhalt','{}'::jsonb), nullif(r->>'hinweis',''))
      returning id into r;
      keep := keep || (r::text)::uuid;
    end if;
  end loop;
  delete from training.plan_item where plan_week_id = p_plan_week_id and not (id = any(keep));
  update training.plan_week set updated_at = now() where id = p_plan_week_id;
end $$;

grant execute on all functions in schema training to authenticated, service_role;
