-- ############################################################################
-- PHOTOS ET COMMENTAIRES SUR LES TACHES -- ETAPE 1 : la base
--
-- Trois ajouts, aucun changement sur l'existant :
--   1. un espace de stockage PRIVE, cloisonne par entreprise
--   2. une colonne sur taches pour retenir le chemin de la photo
--   3. une table de commentaires, visible exactement comme sa tache
--
-- POURQUOI UN NOUVEL ESPACE PLUTOT QUE LE BUCKET "photos" EXISTANT
--   Celui-la est PUBLIC : n'importe qui connaissant l'adresse d'un fichier
--   peut l'ouvrir, sans etre connecte. Aucune photo de client n'a sa place
--   dedans. Le nouvel espace est prive, et le chemin de chaque fichier
--   commence par l'identifiant de l'entreprise -- c'est ce que la regle
--   d'acces verifie. Un hotel ne peut pas atteindre les fichiers d'un autre,
--   meme en devinant l'adresse.
--
-- POURQUOI UN CHEMIN ET NON UNE URL
--   Dans un espace prive, il n'existe pas d'adresse permanente : on demande
--   un lien signe, valable quelques minutes. On retient donc le CHEMIN du
--   fichier, et l'application fabrique le lien au moment de l'afficher.
-- ############################################################################

begin;

-- ---------------------------------------------------------------------------
-- 1. L'espace de stockage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'taches-photos',
  'taches-photos',
  false,                                   -- prive
  2097152,                                 -- 2 Mo par fichier : large, apres
                                           -- compression une photo pese ~200 Ko
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- Les quatre regles d'acces. Le premier dossier du chemin est
-- l'identifiant de l'entreprise : "<entreprise>/<tache>/photo.jpg".
drop policy if exists taches_photos_lecture on storage.objects;
create policy taches_photos_lecture on storage.objects
for select to authenticated using (
  bucket_id = 'taches-photos'
  and (
    public.is_super_admin()
    or (storage.foldername(name))[1] = public.get_my_entreprise_id()::text
  )
);

drop policy if exists taches_photos_ajout on storage.objects;
create policy taches_photos_ajout on storage.objects
for insert to authenticated with check (
  bucket_id = 'taches-photos'
  and (
    public.is_super_admin()
    or (storage.foldername(name))[1] = public.get_my_entreprise_id()::text
  )
);

drop policy if exists taches_photos_remplacement on storage.objects;
create policy taches_photos_remplacement on storage.objects
for update to authenticated using (
  bucket_id = 'taches-photos'
  and (
    public.is_super_admin()
    or (storage.foldername(name))[1] = public.get_my_entreprise_id()::text
  )
);

-- Supprimer un fichier : l'administrateur, comme pour les taches elles-memes.
drop policy if exists taches_photos_suppression on storage.objects;
create policy taches_photos_suppression on storage.objects
for delete to authenticated using (
  bucket_id = 'taches-photos'
  and (
    public.is_super_admin()
    or (
      (storage.foldername(name))[1] = public.get_my_entreprise_id()::text
      and public.get_my_role() = 'admin'
    )
  )
);


-- ---------------------------------------------------------------------------
-- 2. La colonne sur taches
-- ---------------------------------------------------------------------------
alter table public.taches
  add column if not exists photo_chemin text;

comment on column public.taches.photo_chemin is
  'Chemin du fichier dans le bucket prive taches-photos, sous la forme '
  '<entreprise_id>/<tache_id>/<nom>. Ce n''est PAS une URL : l''espace etant '
  'prive, l''application demande un lien signe au moment de l''affichage.';


-- ---------------------------------------------------------------------------
-- 3. Les commentaires
--
-- La visibilite n'est pas redefinie ici : un commentaire se voit si et
-- seulement si sa tache se voit. Ecrire la regle une deuxieme fois, c'est
-- prendre rendez-vous avec le jour ou les deux divergeront.
-- ---------------------------------------------------------------------------
create table if not exists public.taches_commentaires (
  id            uuid primary key default gen_random_uuid(),
  tache_id      uuid not null references public.taches(id) on delete cascade,
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  auteur_id     uuid references public.profiles(id) on delete set null,
  message       text not null check (length(trim(message)) > 0),
  created_at    timestamptz not null default now()
);

create index if not exists idx_taches_commentaires_tache on public.taches_commentaires(tache_id);
create index if not exists idx_taches_commentaires_auteur on public.taches_commentaires(auteur_id);

alter table public.taches_commentaires enable row level security;

drop policy if exists taches_commentaires_select on public.taches_commentaires;
create policy taches_commentaires_select on public.taches_commentaires
for select using (
  exists (select 1 from public.taches t where t.id = taches_commentaires.tache_id)
);

drop policy if exists taches_commentaires_insert on public.taches_commentaires;
create policy taches_commentaires_insert on public.taches_commentaires
for insert with check (
  entreprise_id = public.get_my_entreprise_id()
  and auteur_id = auth.uid()
  and exists (select 1 from public.taches t where t.id = taches_commentaires.tache_id)
);

-- On ne modifie pas un commentaire ecrit : un fil de discussion qu'on peut
-- reecrire apres coup ne vaut plus comme trace. Seul l'administrateur efface.
drop policy if exists taches_commentaires_delete on public.taches_commentaires;
create policy taches_commentaires_delete on public.taches_commentaires
for delete using (
  public.is_super_admin()
  or (
    entreprise_id = public.get_my_entreprise_id()
    and public.get_my_role() = 'admin'
  )
);

commit;


-- ############################################################################
-- CONTROLE (lecture seule)
--
-- Attendu :
--   - taches-photos : prive
--   - photo_chemin  : presente
--   - 4 regles sur les fichiers, 3 sur les commentaires
--   - et l'etat de l'ancien bucket "photos", pour decider quoi en faire
-- ############################################################################

select 'espace taches-photos' as controle,
       case when public then 'PUBLIC -- anormal' else 'prive' end as etat,
       coalesce(file_size_limit::text, '--') as detail
from storage.buckets where id = 'taches-photos'

union all

select 'colonne photo_chemin',
       'presente',
       data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'taches' and column_name = 'photo_chemin'

union all

select 'regles sur les fichiers',
       count(*)::text,
       'attendu 4'
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'taches_photos%'

union all

select 'regles sur les commentaires',
       count(*)::text,
       'attendu 3'
from pg_policies
where schemaname = 'public' and tablename = 'taches_commentaires'

union all

select 'ancien bucket photos (public)',
       (select count(*)::text from storage.objects where bucket_id = 'photos'),
       'fichiers -- 0 = on peut le fermer sans risque'

order by 1;
