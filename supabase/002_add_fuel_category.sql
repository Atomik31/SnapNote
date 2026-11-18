-- =====================================================================
-- SnapNote — Ajout de la catégorie « Carburant »
-- À exécuter UNE fois sur une base créée AVANT cet ajout (SQL Editor → Run).
-- Sans effet de bord : les notes existantes ne sont pas modifiées.
-- (001_receipts.sql contient déjà la catégorie pour les nouvelles bases.)
-- =====================================================================
alter table public.receipts drop constraint if exists receipts_category_check;

alter table public.receipts
  add constraint receipts_category_check
  check (category in ('Restaurant', 'Transport', 'Carburant', 'Fournitures', 'Hébergement', 'Autre'));
