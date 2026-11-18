-- =====================================================================
-- SnapNote — Mises à jour en direct (Supabase Realtime)
-- À exécuter UNE fois sur une base créée AVANT cet ajout (SQL Editor → Run).
-- L'app est ainsi prévenue dès que n8n passe une note de « envoi en cours » à « envoyée ».
-- (001_receipts.sql contient déjà cette activation pour les nouvelles bases.)
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'receipts'
  ) then
    alter publication supabase_realtime add table public.receipts;
  end if;
end $$;
