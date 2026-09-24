-- RLS-Test: Nutzer A legt Daten an, Nutzer B sieht 0 Zeilen. Läuft in einer Transaktion und
-- wird zurückgerollt (keine Daten bleiben). Ausführen im SQL-Editor oder per MCP execute_sql.
-- :A und :B durch zwei vorhandene auth.users.id ersetzen.
begin;

select set_config('request.jwt.claims', json_build_object('sub', ':A', 'role', 'authenticated')::text, true);
set local role authenticated;

select training.ensure_defaults();
insert into training.session (user_id, datum, art, dauer_min, srpe) values (':A', current_date, 'tennis', 60, 5);
insert into training.plan_week (user_id, woche_start, status) values (':A', date_trunc('week', current_date)::date, 'vorschlag');

-- als A: alles sichtbar
select 'A' as wer, (select count(*) from training.session) as sessions, (select count(*) from training.settings) as settings,
       (select count(*) from training.exercise) as exercises, (select count(*) from training.plan_week) as plans;

-- als B: nichts sichtbar
select set_config('request.jwt.claims', json_build_object('sub', ':B', 'role', 'authenticated')::text, true);
select 'B' as wer, (select count(*) from training.session) as sessions, (select count(*) from training.settings) as settings,
       (select count(*) from training.exercise) as exercises, (select count(*) from training.plan_week) as plans;

rollback;
