-- =====================================================================
-- SnapNote — Étape 3 : table des notes, bucket privé des photos, RLS
-- À exécuter UNE fois dans Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- 1. La table : une ligne = une note de frais scannée par un employé
create table public.receipts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade, -- QUI a scanné
  user_email    text not null default (auth.jwt() ->> 'email'),                                 -- QUI (lisible)
  merchant      text not null,
  receipt_date  date not null,
  amount_ht     numeric(10, 2),
  amount_vat    numeric(10, 2),
  amount_ttc    numeric(10, 2) not null,
  category      text not null default 'Autre'
                check (category in ('Restaurant', 'Transport', 'Carburant', 'Fournitures', 'Hébergement', 'Autre')),
  image_path    text,                                                                           -- chemin dans le bucket
  source        text not null default 'manual' check (source in ('manual', 'ai')),
  status        text not null default 'draft'  check (status in ('draft', 'sent')),
  created_at    timestamptz not null default now(),                                             -- QUAND
  sent_at       timestamptz
);

create index receipts_user_date_idx on public.receipts (user_id, receipt_date desc);

-- 2. Traçabilité infalsifiable : pour un utilisateur connecté, la base impose elle-même
--    l'auteur, son email, la date de scan et le statut. Le navigateur ne peut pas les tricher.
--    (Quand il n'y a pas d'utilisateur, ex. n8n avec la clé service_role, on ne force rien.)
create or replace function public.receipts_enforce_trace()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.user_id    := auth.uid();
      new.user_email := auth.jwt() ->> 'email';
      new.created_at := now();
      new.status     := 'draft';
      new.sent_at    := null;
    else -- UPDATE : ces colonnes ne bougent plus
      new.user_id    := old.user_id;
      new.user_email := old.user_email;
      new.created_at := old.created_at;
      new.status     := old.status;
      new.sent_at    := old.sent_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger receipts_enforce_trace
  before insert or update on public.receipts
  for each row execute function public.receipts_enforce_trace();

-- 3. RLS : chaque employé ne voit et ne touche que SES notes.
alter table public.receipts enable row level security;

create policy "receipts_select_own" on public.receipts
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "receipts_insert_own" on public.receipts
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Une note déjà envoyée au comptable ne se modifie plus et ne se supprime plus.
create policy "receipts_update_own_draft" on public.receipts
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'draft')
  with check (user_id = (select auth.uid()));

create policy "receipts_delete_own_draft" on public.receipts
  for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'draft');

-- 4. Photos : bucket PRIVÉ (jamais d'URL publique), 5 Mo max, images uniquement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Convention de chemin : <id de l'employé>/<id de la note>.jpg
-- Un employé n'accède qu'au dossier portant son propre identifiant.
create policy "receipt_images_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "receipt_images_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "receipt_images_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 5. Mises à jour en direct : l'app est prévenue quand n8n passe une note à « envoyée ».
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'receipts'
  ) then
    alter publication supabase_realtime add table public.receipts;
  end if;
end $$;
