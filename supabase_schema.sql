-- ============================================
-- HOTELDESK PRO - Schéma Supabase complet
-- Coller dans : Supabase > SQL Editor > New query
-- ============================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLE : profiles (utilisateurs)
-- ============================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  nom text not null,
  prenom text not null,
  role text not null default 'employe' check (role in ('admin','responsable','employe')),
  departement text check (departement in ('reception','menage','maintenance','restauration','direction')),
  avatar_initiales text,
  actif boolean default true,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Lecture profils" on profiles for select using (true);
create policy "Modifier son profil" on profiles for update using (auth.uid() = id);

-- ============================================
-- TABLE : taches
-- ============================================
create table taches (
  id uuid primary key default uuid_generate_v4(),
  titre text not null,
  description text,
  categorie text not null check (categorie in ('menage','maintenance','accueil','admin','urgence')),
  priorite text not null default 'moyenne' check (priorite in ('haute','moyenne','basse')),
  statut text not null default 'planifiee' check (statut in ('planifiee','en_cours','terminee','annulee')),
  assigne_a uuid references profiles(id) on delete set null,
  cree_par uuid references profiles(id) on delete set null,
  date_echeance timestamptz,
  date_terminee timestamptz,
  chambre text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table taches enable row level security;
create policy "Lecture taches" on taches for select using (true);
create policy "Créer taches" on taches for insert with check (auth.uid() is not null);
create policy "Modifier taches" on taches for update using (auth.uid() is not null);
create policy "Supprimer taches" on taches for delete using (
  auth.uid() = cree_par or
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','responsable'))
);

-- ============================================
-- TABLE : messages
-- ============================================
create table messages (
  id uuid primary key default uuid_generate_v4(),
  expediteur_id uuid references profiles(id) on delete cascade not null,
  destinataire_id uuid references profiles(id) on delete cascade,
  groupe text,
  contenu text not null,
  lu boolean default false,
  created_at timestamptz default now()
);

alter table messages enable row level security;
create policy "Voir ses messages" on messages for select using (
  auth.uid() = expediteur_id or auth.uid() = destinataire_id or groupe is not null
);
create policy "Envoyer message" on messages for insert with check (auth.uid() = expediteur_id);
create policy "Marquer lu" on messages for update using (auth.uid() = destinataire_id);

-- ============================================
-- TABLE : rappels
-- ============================================
create table rappels (
  id uuid primary key default uuid_generate_v4(),
  titre text not null,
  description text,
  priorite text not null default 'normale' check (priorite in ('urgente','normale','basse')),
  date_rappel timestamptz not null,
  cree_par uuid references profiles(id) on delete cascade not null,
  assigne_a uuid references profiles(id) on delete set null,
  tache_id uuid references taches(id) on delete set null,
  notifie boolean default false,
  created_at timestamptz default now()
);

alter table rappels enable row level security;
create policy "Voir rappels" on rappels for select using (
  auth.uid() = cree_par or auth.uid() = assigne_a
);
create policy "Créer rappel" on rappels for insert with check (auth.uid() = cree_par);
create policy "Modifier rappel" on rappels for update using (auth.uid() = cree_par);
create policy "Supprimer rappel" on rappels for delete using (auth.uid() = cree_par);

-- ============================================
-- FONCTION : mise à jour automatique updated_at
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger taches_updated_at
  before update on taches
  for each row execute function update_updated_at();

-- ============================================
-- REALTIME : activer pour les 3 tables
-- ============================================
alter publication supabase_realtime add table taches;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table rappels;

-- ============================================
-- DONNÉES DE TEST (optionnel)
-- ============================================
-- À exécuter APRÈS avoir créé votre premier compte via l'app
-- insert into profiles (id, nom, prenom, role, departement, avatar_initiales)
-- values (auth.uid(), 'Dupont', 'Jean', 'admin', 'direction', 'JD');

-- ============================================
-- MISE À JOUR : colonne couleur sur profiles
-- (à exécuter si vous avez déjà créé la table)
-- ============================================
alter table profiles add column if not exists couleur text default '#1E88E5';
