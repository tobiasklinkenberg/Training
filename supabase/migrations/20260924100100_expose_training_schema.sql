-- =============================================================================
-- Schema `training` für PostgREST freigeben („Exposed schemas").
-- PostgREST liest die Konfiguration u. a. aus den Rollen-Settings von
-- `authenticator`; diese haben Vorrang vor der Konfigurationsdatei.
-- Zusätzlich im Dashboard prüfen: Project Settings → API → Exposed schemas
-- muss `training` enthalten (sonst überschreibt ein späteres Speichern dort
-- diese Einstellung nicht, aber die Anzeige ist inkonsistent).
-- =============================================================================
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, training';
notify pgrst, 'reload config';
