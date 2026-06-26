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


-- ============================================================
-- MODULE CONGES & ABSENCES (ajout module v1.0)
-- ============================================================

-- Table principale des demandes de conges
CREATE TABLE IF NOT EXISTS conges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  employe_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  validateur_id UUID REFERENCES profiles(id),
  type_conge TEXT NOT NULL DEFAULT 'conges_payes'
    CHECK (type_conge IN ('conges_payes', 'rtt', 'maladie', 'sans_solde', 'formation', 'autre')),
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  nb_jours NUMERIC(5,1) NOT NULL DEFAULT 1,
  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'approuve', 'refuse', 'annule')),
  motif TEXT,
  commentaire_validateur TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ
);

ALTER TABLE conges ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_conges_entreprise ON conges(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_conges_employe ON conges(employe_id);

CREATE POLICY conges_select ON conges FOR SELECT USING (
  is_super_admin() OR employe_id = auth.uid()
  OR (get_my_role() IN ('admin', 'responsable') AND entreprise_id = get_my_entreprise_id())
);
CREATE POLICY conges_insert ON conges FOR INSERT WITH CHECK (
  employe_id = auth.uid() AND entreprise_id = get_my_entreprise_id()
);
CREATE POLICY conges_update ON conges FOR UPDATE USING (
  is_super_admin() OR employe_id = auth.uid()
  OR (get_my_role() IN ('admin', 'responsable') AND entreprise_id = get_my_entreprise_id())
);
CREATE POLICY conges_delete ON conges FOR DELETE USING (
  is_super_admin() OR (get_my_role() = 'admin' AND entreprise_id = get_my_entreprise_id())
);

-- Table des soldes de conges
CREATE TABLE IF NOT EXISTS soldes_conges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  employe_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  annee INT NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  cp_acquis NUMERIC(5,1) NOT NULL DEFAULT 25,
  cp_pris NUMERIC(5,1) NOT NULL DEFAULT 0,
  cp_restant NUMERIC(5,1) GENERATED ALWAYS AS (cp_acquis - cp_pris) STORED,
  rtt_acquis NUMERIC(5,1) NOT NULL DEFAULT 0,
  rtt_pris NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employe_id, annee)
);

ALTER TABLE soldes_conges ENABLE ROW LEVEL SECURITY;
CREATE POLICY soldes_conges_select ON soldes_conges FOR SELECT USING (
  is_super_admin() OR employe_id = auth.uid()
  OR (get_my_role() IN ('admin', 'responsable') AND entreprise_id = get_my_entreprise_id())
);
CREATE POLICY soldes_conges_manage ON soldes_conges FOR ALL USING (
  is_super_admin() OR (get_my_role() = 'admin' AND entreprise_id = get_my_entreprise_id())
);


-- ============================================
-- POLICIES RLS - ISOLATION PAR ENTREPRISE v2.0
-- Mise à jour : isolation admin par entreprise
-- ============================================

-- PROFILES : L'admin a la main totale sur son entreprise
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "Inserer profil" ON profiles;
DROP POLICY IF EXISTS "Modifier son profil" ON profiles;

CREATE POLICY "profiles_select" ON profiles
FOR SELECT USING (
  auth.uid() = id
  OR is_super_admin()
  OR (get_my_role() = ANY(ARRAY['admin','responsable']) AND entreprise_id = get_my_entreprise_id())
);

CREATE POLICY "profiles_insert" ON profiles
FOR INSERT WITH CHECK (
  auth.uid() = id
  OR is_super_admin()
  OR (get_my_role() = 'admin' AND entreprise_id = get_my_entreprise_id())
);

CREATE POLICY "profiles_update" ON profiles
FOR UPDATE USING (
  auth.uid() = id
  OR is_super_admin()
  OR (get_my_role() = 'admin' AND entreprise_id = get_my_entreprise_id())
) WITH CHECK (
  auth.uid() = id
  OR is_super_admin()
  OR (get_my_role() = 'admin' AND entreprise_id = get_my_entreprise_id())
);

CREATE POLICY "profiles_delete" ON profiles
FOR DELETE USING (
  is_super_admin()
  OR (get_my_role() = 'admin' AND entreprise_id = get_my_entreprise_id() AND auth.uid() != id)
);

-- RAPPELS : isolation par entreprise
DROP POLICY IF EXISTS "CRUD rappels" ON rappels;
DROP POLICY IF EXISTS "rappels_select" ON rappels;
DROP POLICY IF EXISTS "rappels_insert" ON rappels;
DROP POLICY IF EXISTS "rappels_update" ON rappels;
DROP POLICY IF EXISTS "rappels_delete" ON rappels;

CREATE POLICY "rappels_select" ON rappels
FOR SELECT USING (
  is_super_admin()
  OR auth.uid() = cree_par
  OR (get_my_role() = ANY(ARRAY['admin','responsable']) AND entreprise_id = get_my_entreprise_id())
);

CREATE POLICY "rappels_insert" ON rappels
FOR INSERT WITH CHECK (
  is_super_admin()
  OR (auth.uid() = cree_par AND entreprise_id = get_my_entreprise_id())
);

CREATE POLICY "rappels_update" ON rappels
FOR UPDATE USING (
  is_super_admin() OR auth.uid() = cree_par
  OR (get_my_role() = 'admin' AND entreprise_id = get_my_entreprise_id())
);

CREATE POLICY "rappels_delete" ON rappels
FOR DELETE USING (
  is_super_admin() OR auth.uid() = cree_par
  OR (get_my_role() = 'admin' AND entreprise_id = get_my_entreprise_id())
);

-- TACHES : with_check sur entreprise_id
DROP POLICY IF EXISTS "taches_insert" ON taches;
CREATE POLICY "taches_insert" ON taches
FOR INSERT WITH CHECK (
  is_super_admin() OR entreprise_id = get_my_entreprise_id()
);

-- MESSAGES : isolation par entreprise
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "Envoyer message" ON messages;
DROP POLICY IF EXISTS "Lire ses messages" ON messages;
DROP POLICY IF EXISTS "Voir ses messages" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;

CREATE POLICY "messages_select" ON messages
FOR SELECT USING (
  is_super_admin()
  OR expediteur_id = auth.uid()
  OR destinataire_id = auth.uid()
  OR (get_my_role() = ANY(ARRAY['admin','responsable']) AND entreprise_id = get_my_entreprise_id())
);

CREATE POLICY "messages_insert" ON messages
FOR INSERT WITH CHECK (
  is_super_admin()
  OR (expediteur_id = auth.uid() AND entreprise_id = get_my_entreprise_id())
);

CREATE POLICY "messages_delete" ON messages
FOR DELETE USING (
  is_super_admin()
  OR expediteur_id = auth.uid()
  OR (get_my_role() = 'admin' AND entreprise_id = get_my_entreprise_id())
);
