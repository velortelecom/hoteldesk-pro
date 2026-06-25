// src/lib/secteurs.js
// Templates secteurs metiers pour Velor One V4
// Definit pour chaque secteur : label, departements, postes, modules recommandes
// IMPORTANT : secteur != departement != poste != role

export const SECTEURS_METIERS = {
  hotel: {
    key: 'hotel', label: 'Hotel & Hebergement', icone: '🏨',
    description: 'Hotellerie, bed & breakfast, residence hoteliere',
    modules_recommandes: ['organisation','conges','documents','rapports'],
    departements: [
      { code: 'accueil', nom: 'Accueil', couleur: '#3B82F6' },
      { code: 'menage', nom: 'Menage', couleur: '#8B5CF6' },
      { code: 'maintenance', nom: 'Maintenance', couleur: '#F59E0B' },
      { code: 'admin', nom: 'Administration', couleur: '#6B7280' },
      { code: 'urgence', nom: 'Urgence', couleur: '#EF4444' },
      { code: 'petit_dejeuner', nom: 'Petit Dejeuner', couleur: '#10B981' },
      { code: 'restauration', nom: 'Restauration', couleur: '#F97316' },
      { code: 'bar', nom: 'Bar', couleur: '#6366F1' },
      { code: 'cuisine', nom: 'Cuisine', couleur: '#EC4899' },
      { code: 'room_service', nom: 'Room Service', couleur: '#14B8A6' },
      { code: 'conciergerie', nom: 'Conciergerie', couleur: '#84CC16' },
      { code: 'bagagerie', nom: 'Bagagerie', couleur: '#A78BFA' },
      { code: 'voiturier', nom: 'Voiturier', couleur: '#FB923C' },
      { code: 'securite', nom: 'Securite', couleur: '#1F2937' },
      { code: 'spa_bien_etre', nom: 'Spa & Bien-etre', couleur: '#D946EF' },
      { code: 'piscine', nom: 'Piscine', couleur: '#0EA5E9' },
      { code: 'blanchisserie', nom: 'Blanchisserie', couleur: '#A3E635' },
      { code: 'etages', nom: 'Etages', couleur: '#C084FC' },
      { code: 'gouvernante', nom: 'Gouvernante', couleur: '#F472B6' },
      { code: 'direction', nom: 'Direction', couleur: '#374151' },
      { code: 'commercial', nom: 'Commercial', couleur: '#2563EB' },
      { code: 'comptabilite', nom: 'Comptabilite', couleur: '#059669' },
      { code: 'rh', nom: 'Ressources Humaines', couleur: '#7C3AED' },
      { code: 'evenementiel', nom: 'Evenementiel', couleur: '#DB2777' },
      { code: 'technique', nom: 'Technique', couleur: '#D97706' },
      { code: 'jardin_exterieur', nom: 'Jardin & Exterieur', couleur: '#16A34A' },
      { code: 'nuit', nom: 'Equipe Nuit', couleur: '#1E3A5F' },
    ],
    postes: [
      { slug: 'directeur_hotel', nom: 'Directeur Hotel', dept: 'direction', niveau: 1 },
      { slug: 'assistant_direction', nom: 'Assistant Direction', dept: 'direction', niveau: 2 },
      { slug: 'chef_reception', nom: 'Chef Reception', dept: 'accueil', niveau: 2 },
      { slug: 'receptionniste', nom: 'Receptionniste', dept: 'accueil', niveau: 3 },
      { slug: 'receptionniste_nuit', nom: 'Receptionniste Nuit', dept: 'nuit', niveau: 3 },
      { slug: 'night_auditor', nom: 'Night Auditor', dept: 'nuit', niveau: 3 },
      { slug: 'concierge', nom: 'Concierge', dept: 'conciergerie', niveau: 3 },
      { slug: 'bagagiste', nom: 'Bagagiste', dept: 'bagagerie', niveau: 4 },
      { slug: 'voiturier', nom: 'Voiturier', dept: 'voiturier', niveau: 4 },
      { slug: 'gouvernante_generale', nom: 'Gouvernante Generale', dept: 'gouvernante', niveau: 2 },
      { slug: 'gouvernante', nom: 'Gouvernante', dept: 'etages', niveau: 3 },
      { slug: 'femme_de_chambre', nom: 'Femme de Chambre', dept: 'menage', niveau: 4 },
      { slug: 'valet_de_chambre', nom: 'Valet de Chambre', dept: 'menage', niveau: 4 },
      { slug: 'lingere', nom: 'Lingere', dept: 'blanchisserie', niveau: 4 },
      { slug: 'responsable_petit_dejeuner', nom: 'Resp. Petit Dejeuner', dept: 'petit_dejeuner', niveau: 3 },
      { slug: 'employe_petit_dejeuner', nom: 'Employe Petit Dejeuner', dept: 'petit_dejeuner', niveau: 4 },
      { slug: 'serveur_petit_dejeuner', nom: 'Serveur Petit Dejeuner', dept: 'petit_dejeuner', niveau: 4 },
      { slug: 'responsable_salle', nom: 'Responsable Salle', dept: 'restauration', niveau: 3 },
      { slug: 'maitre_hotel', nom: 'Maitre Hotel', dept: 'restauration', niveau: 3 },
      { slug: 'serveur', nom: 'Serveur', dept: 'restauration', niveau: 4 },
      { slug: 'barman', nom: 'Barman', dept: 'bar', niveau: 3 },
      { slug: 'chef_cuisine', nom: 'Chef Cuisine', dept: 'cuisine', niveau: 2 },
      { slug: 'commis_cuisine', nom: 'Commis Cuisine', dept: 'cuisine', niveau: 4 },
      { slug: 'plongeur', nom: 'Plongeur', dept: 'cuisine', niveau: 5 },
      { slug: 'responsable_maintenance', nom: 'Resp. Maintenance', dept: 'maintenance', niveau: 2 },
      { slug: 'technicien_maintenance', nom: 'Technicien Maintenance', dept: 'maintenance', niveau: 3 },
      { slug: 'agent_securite', nom: 'Agent Securite', dept: 'securite', niveau: 3 },
      { slug: 'responsable_rh', nom: 'Responsable RH', dept: 'rh', niveau: 2 },
      { slug: 'comptable', nom: 'Comptable', dept: 'comptabilite', niveau: 3 },
      { slug: 'commercial', nom: 'Commercial', dept: 'commercial', niveau: 3 },
    ],
  },

  ehpad: {
    key: 'ehpad', label: 'EHPAD & Maison de Retraite', icone: '🏥',
    description: 'Etablissement hebergeant des personnes agees dependantes',
    modules_recommandes: ['organisation','conges','documents','rapports'],
    departements: [
      { code: 'direction', nom: 'Direction', couleur: '#374151' },
      { code: 'accueil', nom: 'Accueil', couleur: '#3B82F6' },
      { code: 'admin', nom: 'Administration', couleur: '#6B7280' },
      { code: 'soins', nom: 'Soins', couleur: '#EF4444' },
      { code: 'infirmier', nom: 'Infirmerie', couleur: '#EC4899' },
      { code: 'aide_soignant', nom: 'Aide-Soignant', couleur: '#F97316' },
      { code: 'restauration', nom: 'Restauration', couleur: '#F59E0B' },
      { code: 'cuisine', nom: 'Cuisine', couleur: '#84CC16' },
      { code: 'menage', nom: 'Menage', couleur: '#8B5CF6' },
      { code: 'lingerie', nom: 'Lingerie', couleur: '#A3E635' },
      { code: 'animation', nom: 'Animation', couleur: '#10B981' },
      { code: 'maintenance', nom: 'Maintenance', couleur: '#D97706' },
      { code: 'nuit', nom: 'Equipe Nuit', couleur: '#1E3A5F' },
      { code: 'urgence', nom: 'Urgence', couleur: '#DC2626' },
      { code: 'rh', nom: 'Ressources Humaines', couleur: '#7C3AED' },
      { code: 'comptabilite', nom: 'Comptabilite', couleur: '#059669' },
    ],
    postes: [
      { slug: 'directeur_ehpad', nom: 'Directeur EHPAD', dept: 'direction', niveau: 1 },
      { slug: 'cadre_sante', nom: 'Cadre de Sante', dept: 'soins', niveau: 2 },
      { slug: 'infirmier_coordinateur', nom: 'Infirmier Coordinateur', dept: 'infirmier', niveau: 2 },
      { slug: 'infirmier', nom: 'Infirmier', dept: 'infirmier', niveau: 3 },
      { slug: 'aide_soignant', nom: 'Aide-Soignant', dept: 'aide_soignant', niveau: 3 },
      { slug: 'aide_medico_psychologique', nom: 'Aide Medico-Psychologique', dept: 'soins', niveau: 3 },
      { slug: 'auxiliaire_vie', nom: 'Auxiliaire de Vie', dept: 'aide_soignant', niveau: 4 },
      { slug: 'agent_service_hospitalier', nom: 'Agent Service Hospitalier', dept: 'menage', niveau: 4 },
      { slug: 'medecin_coordonnateur', nom: 'Medecin Coordonnateur', dept: 'soins', niveau: 1 },
      { slug: 'psychologue', nom: 'Psychologue', dept: 'soins', niveau: 2 },
      { slug: 'animateur', nom: 'Animateur', dept: 'animation', niveau: 3 },
      { slug: 'responsable_animation', nom: 'Responsable Animation', dept: 'animation', niveau: 2 },
      { slug: 'chef_cuisine', nom: 'Chef Cuisine', dept: 'cuisine', niveau: 2 },
      { slug: 'cuisinier', nom: 'Cuisinier', dept: 'cuisine', niveau: 3 },
      { slug: 'agent_restauration', nom: 'Agent Restauration', dept: 'restauration', niveau: 4 },
      { slug: 'agent_menage', nom: 'Agent de Menage', dept: 'menage', niveau: 4 },
      { slug: 'lingere', nom: 'Lingere', dept: 'lingerie', niveau: 4 },
      { slug: 'responsable_maintenance', nom: 'Resp. Maintenance', dept: 'maintenance', niveau: 2 },
      { slug: 'technicien_maintenance', nom: 'Technicien Maintenance', dept: 'maintenance', niveau: 3 },
      { slug: 'agent_accueil', nom: 'Agent Accueil', dept: 'accueil', niveau: 3 },
      { slug: 'assistant_administratif', nom: 'Assistant Administratif', dept: 'admin', niveau: 3 },
      { slug: 'responsable_rh', nom: 'Responsable RH', dept: 'rh', niveau: 2 },
      { slug: 'comptable', nom: 'Comptable', dept: 'comptabilite', niveau: 3 },
      { slug: 'veilleur_nuit', nom: 'Veilleur de Nuit', dept: 'nuit', niveau: 3 },
    ],
  },

  restaurant: {
    key: 'restaurant', label: 'Restauration', icone: '🍽️',
    description: 'Restaurant, brasserie, fast-food, traiteur',
    modules_recommandes: ['organisation','conges','documents'],
    departements: [
      { code: 'direction', nom: 'Direction', couleur: '#374151' },
      { code: 'accueil', nom: 'Accueil', couleur: '#3B82F6' },
      { code: 'salle', nom: 'Salle', couleur: '#F97316' },
      { code: 'cuisine', nom: 'Cuisine', couleur: '#EC4899' },
      { code: 'bar', nom: 'Bar', couleur: '#6366F1' },
      { code: 'plonge', nom: 'Plonge', couleur: '#6B7280' },
      { code: 'livraison', nom: 'Livraison', couleur: '#10B981' },
      { code: 'stock', nom: 'Stock', couleur: '#84CC16' },
      { code: 'admin', nom: 'Administration', couleur: '#9CA3AF' },
      { code: 'maintenance', nom: 'Maintenance', couleur: '#D97706' },
    ],
    postes: [
      { slug: 'gerant_restaurant', nom: 'Gerant Restaurant', dept: 'direction', niveau: 1 },
      { slug: 'responsable_salle', nom: 'Responsable Salle', dept: 'salle', niveau: 2 },
      { slug: 'maitre_hotel', nom: 'Maitre Hotel', dept: 'salle', niveau: 2 },
      { slug: 'chef_de_rang', nom: 'Chef de Rang', dept: 'salle', niveau: 3 },
      { slug: 'serveur', nom: 'Serveur', dept: 'salle', niveau: 3 },
      { slug: 'runner', nom: 'Runner', dept: 'salle', niveau: 4 },
      { slug: 'barman', nom: 'Barman', dept: 'bar', niveau: 3 },
      { slug: 'barista', nom: 'Barista', dept: 'bar', niveau: 3 },
      { slug: 'chef_cuisine', nom: 'Chef Cuisine', dept: 'cuisine', niveau: 1 },
      { slug: 'second_cuisine', nom: 'Second Cuisine', dept: 'cuisine', niveau: 2 },
      { slug: 'chef_partie', nom: 'Chef de Partie', dept: 'cuisine', niveau: 3 },
      { slug: 'commis_cuisine', nom: 'Commis Cuisine', dept: 'cuisine', niveau: 4 },
      { slug: 'plongeur', nom: 'Plongeur', dept: 'plonge', niveau: 5 },
      { slug: 'livreur', nom: 'Livreur', dept: 'livraison', niveau: 4 },
      { slug: 'responsable_stock', nom: 'Responsable Stock', dept: 'stock', niveau: 3 },
      { slug: 'caissier', nom: 'Caissier', dept: 'accueil', niveau: 3 },
    ],
  },

  nettoyage: {
    key: 'nettoyage', label: 'Nettoyage & Proprete', icone: '🧹',
    description: 'Entreprise de nettoyage, proprete, services',
    modules_recommandes: ['organisation','conges','documents','vehicules'],
    departements: [
      { code: 'direction', nom: 'Direction', couleur: '#374151' },
      { code: 'admin', nom: 'Administration', couleur: '#6B7280' },
      { code: 'exploitation', nom: 'Exploitation', couleur: '#3B82F6' },
      { code: 'menage', nom: 'Menage', couleur: '#8B5CF6' },
      { code: 'controle_qualite', nom: 'Controle Qualite', couleur: '#10B981' },
      { code: 'stock', nom: 'Stock', couleur: '#84CC16' },
      { code: 'vehicules', nom: 'Vehicules', couleur: '#F97316' },
      { code: 'rh', nom: 'Ressources Humaines', couleur: '#7C3AED' },
    ],
    postes: [
      { slug: 'gerant', nom: 'Gerant', dept: 'direction', niveau: 1 },
      { slug: 'responsable_exploitation', nom: 'Resp. Exploitation', dept: 'exploitation', niveau: 2 },
      { slug: 'chef_equipe', nom: 'Chef Equipe', dept: 'exploitation', niveau: 3 },
      { slug: 'agent_nettoyage', nom: 'Agent de Nettoyage', dept: 'menage', niveau: 4 },
      { slug: 'agent_polyvalent', nom: 'Agent Polyvalent', dept: 'menage', niveau: 4 },
      { slug: 'inspecteur_qualite', nom: 'Inspecteur Qualite', dept: 'controle_qualite', niveau: 3 },
      { slug: 'responsable_stock', nom: 'Responsable Stock', dept: 'stock', niveau: 3 },
      { slug: 'chauffeur', nom: 'Chauffeur', dept: 'vehicules', niveau: 3 },
      { slug: 'assistant_administratif', nom: 'Assistant Administratif', dept: 'admin', niveau: 3 },
      { slug: 'responsable_rh', nom: 'Responsable RH', dept: 'rh', niveau: 2 },
    ],
  },

  maintenance: {
    key: 'maintenance', label: 'Maintenance Industrielle', icone: '🔧',
    description: 'Maintenance, reparation, interventions techniques',
    modules_recommandes: ['organisation','conges','vehicules','documents'],
    departements: [
      { code: 'direction', nom: 'Direction', couleur: '#374151' },
      { code: 'admin', nom: 'Administration', couleur: '#6B7280' },
      { code: 'planning', nom: 'Planning', couleur: '#3B82F6' },
      { code: 'technique', nom: 'Technique', couleur: '#D97706' },
      { code: 'maintenance', nom: 'Maintenance', couleur: '#F59E0B' },
      { code: 'interventions', nom: 'Interventions', couleur: '#EF4444' },
      { code: 'stock', nom: 'Stock', couleur: '#84CC16' },
      { code: 'vehicules', nom: 'Vehicules', couleur: '#F97316' },
      { code: 'urgence', nom: 'Urgence', couleur: '#DC2626' },
    ],
    postes: [
      { slug: 'gerant', nom: 'Gerant', dept: 'direction', niveau: 1 },
      { slug: 'responsable_technique', nom: 'Resp. Technique', dept: 'technique', niveau: 2 },
      { slug: 'chef_equipe', nom: 'Chef Equipe', dept: 'interventions', niveau: 2 },
      { slug: 'technicien_maintenance', nom: 'Technicien Maintenance', dept: 'maintenance', niveau: 3 },
      { slug: 'electricien', nom: 'Electricien', dept: 'technique', niveau: 3 },
      { slug: 'plombier', nom: 'Plombier', dept: 'technique', niveau: 3 },
      { slug: 'technicien_climatisation', nom: 'Tech. Climatisation', dept: 'technique', niveau: 3 },
      { slug: 'technicien_reseau', nom: 'Technicien Reseau', dept: 'technique', niveau: 3 },
      { slug: 'agent_polyvalent', nom: 'Agent Polyvalent', dept: 'maintenance', niveau: 4 },
      { slug: 'responsable_planning', nom: 'Resp. Planning', dept: 'planning', niveau: 2 },
      { slug: 'magasinier', nom: 'Magasinier', dept: 'stock', niveau: 3 },
      { slug: 'chauffeur', nom: 'Chauffeur', dept: 'vehicules', niveau: 3 },
    ],
  },

  btp: {
    key: 'btp', label: 'BTP & Construction', icone: '🏗️',
    description: 'Batiment, travaux publics, construction',
    modules_recommandes: ['organisation','conges','documents','securite'],
    departements: [
      { code: 'direction', nom: 'Direction', couleur: '#374151' },
      { code: 'admin', nom: 'Administration', couleur: '#6B7280' },
      { code: 'chantier', nom: 'Chantier', couleur: '#D97706' },
      { code: 'planning', nom: 'Planning', couleur: '#3B82F6' },
      { code: 'technique', nom: 'Bureau Technique', couleur: '#F59E0B' },
      { code: 'stock', nom: 'Stock', couleur: '#84CC16' },
      { code: 'vehicules', nom: 'Vehicules', couleur: '#F97316' },
      { code: 'securite', nom: 'Securite', couleur: '#1F2937' },
      { code: 'rh', nom: 'Ressources Humaines', couleur: '#7C3AED' },
    ],
    postes: [
      { slug: 'gerant_btp', nom: 'Gerant BTP', dept: 'direction', niveau: 1 },
      { slug: 'conducteur_travaux', nom: 'Conducteur Travaux', dept: 'technique', niveau: 2 },
      { slug: 'chef_chantier', nom: 'Chef Chantier', dept: 'chantier', niveau: 2 },
      { slug: 'chef_equipe', nom: 'Chef Equipe', dept: 'chantier', niveau: 3 },
      { slug: 'ouvrier', nom: 'Ouvrier', dept: 'chantier', niveau: 4 },
      { slug: 'manoeuvre', nom: 'Manoeuvre', dept: 'chantier', niveau: 5 },
      { slug: 'electricien', nom: 'Electricien', dept: 'technique', niveau: 3 },
      { slug: 'plombier', nom: 'Plombier', dept: 'technique', niveau: 3 },
      { slug: 'macon', nom: 'Macon', dept: 'chantier', niveau: 3 },
      { slug: 'peintre', nom: 'Peintre', dept: 'chantier', niveau: 3 },
      { slug: 'plaquiste', nom: 'Plaquiste', dept: 'chantier', niveau: 3 },
      { slug: 'carreleur', nom: 'Carreleur', dept: 'chantier', niveau: 3 },
      { slug: 'magasinier', nom: 'Magasinier', dept: 'stock', niveau: 3 },
      { slug: 'responsable_securite', nom: 'Resp. Securite', dept: 'securite', niveau: 2 },
      { slug: 'assistant_administratif', nom: 'Assistant Administratif', dept: 'admin', niveau: 3 },
    ],
  },

  securite: {
    key: 'securite', label: 'Securite Privee', icone: '🔒',
    description: 'Securite privee, gardiennage, surveillance',
    modules_recommandes: ['organisation','conges','documents'],
    departements: [
      { code: 'direction', nom: 'Direction', couleur: '#374151' },
      { code: 'admin', nom: 'Administration', couleur: '#6B7280' },
      { code: 'exploitation', nom: 'Exploitation', couleur: '#3B82F6' },
      { code: 'securite', nom: 'Securite', couleur: '#1F2937' },
      { code: 'planning', nom: 'Planning', couleur: '#8B5CF6' },
      { code: 'urgence', nom: 'Urgence', couleur: '#DC2626' },
      { code: 'rh', nom: 'Ressources Humaines', couleur: '#7C3AED' },
    ],
    postes: [
      { slug: 'gerant_securite', nom: 'Gerant Securite', dept: 'direction', niveau: 1 },
      { slug: 'responsable_exploitation', nom: 'Resp. Exploitation', dept: 'exploitation', niveau: 2 },
      { slug: 'chef_equipe_securite', nom: 'Chef Equipe Securite', dept: 'securite', niveau: 2 },
      { slug: 'agent_securite', nom: 'Agent Securite', dept: 'securite', niveau: 3 },
      { slug: 'agent_securite_nuit', nom: 'Agent Securite Nuit', dept: 'securite', niveau: 3 },
      { slug: 'agent_ssiap', nom: 'Agent SSIAP', dept: 'securite', niveau: 3 },
      { slug: 'rondier', nom: 'Rondier', dept: 'securite', niveau: 4 },
      { slug: 'agent_accueil_securite', nom: 'Agent Accueil/Securite', dept: 'securite', niveau: 3 },
      { slug: 'responsable_planning', nom: 'Resp. Planning', dept: 'planning', niveau: 2 },
      { slug: 'assistant_administratif', nom: 'Assistant Administratif', dept: 'admin', niveau: 3 },
    ],
  },

  commerce: {
    key: 'commerce', label: 'Commerce & Retail', icone: '🛒',
    description: 'Magasin, boutique, commerce de detail',
    modules_recommandes: ['organisation','conges','documents','stocks'],
    departements: [
      { code: 'direction', nom: 'Direction', couleur: '#374151' },
      { code: 'vente', nom: 'Vente', couleur: '#3B82F6' },
      { code: 'caisse', nom: 'Caisse', couleur: '#10B981' },
      { code: 'stock', nom: 'Stock', couleur: '#84CC16' },
      { code: 'accueil', nom: 'Accueil', couleur: '#F97316' },
      { code: 'admin', nom: 'Administration', couleur: '#6B7280' },
      { code: 'maintenance', nom: 'Maintenance', couleur: '#D97706' },
    ],
    postes: [
      { slug: 'gerant_magasin', nom: 'Gerant Magasin', dept: 'direction', niveau: 1 },
      { slug: 'responsable_magasin', nom: 'Responsable Magasin', dept: 'direction', niveau: 2 },
      { slug: 'vendeur', nom: 'Vendeur', dept: 'vente', niveau: 3 },
      { slug: 'conseiller_vente', nom: 'Conseiller Vente', dept: 'vente', niveau: 3 },
      { slug: 'caissier', nom: 'Caissier', dept: 'caisse', niveau: 3 },
      { slug: 'responsable_stock', nom: 'Responsable Stock', dept: 'stock', niveau: 2 },
      { slug: 'magasinier', nom: 'Magasinier', dept: 'stock', niveau: 3 },
      { slug: 'employe_libre_service', nom: 'Employe Libre Service', dept: 'vente', niveau: 4 },
      { slug: 'assistant_administratif', nom: 'Assistant Administratif', dept: 'admin', niveau: 3 },
    ],
  },

  pme: {
    key: 'pme', label: 'PME Generique', icone: '🏢',
    description: 'Petite et moyenne entreprise, secteur generique',
    modules_recommandes: ['organisation','conges','documents','rapports'],
    departements: [
      { code: 'direction', nom: 'Direction', couleur: '#374151' },
      { code: 'admin', nom: 'Administration', couleur: '#6B7280' },
      { code: 'commercial', nom: 'Commercial', couleur: '#3B82F6' },
      { code: 'technique', nom: 'Technique', couleur: '#D97706' },
      { code: 'production', nom: 'Production', couleur: '#F97316' },
      { code: 'support', nom: 'Support Client', couleur: '#10B981' },
      { code: 'comptabilite', nom: 'Comptabilite', couleur: '#059669' },
      { code: 'rh', nom: 'Ressources Humaines', couleur: '#7C3AED' },
    ],
    postes: [
      { slug: 'dirigeant', nom: 'Dirigeant', dept: 'direction', niveau: 1 },
      { slug: 'assistant_direction', nom: 'Assistant Direction', dept: 'direction', niveau: 2 },
      { slug: 'commercial', nom: 'Commercial', dept: 'commercial', niveau: 3 },
      { slug: 'responsable_commercial', nom: 'Resp. Commercial', dept: 'commercial', niveau: 2 },
      { slug: 'technicien', nom: 'Technicien', dept: 'technique', niveau: 3 },
      { slug: 'responsable_technique', nom: 'Resp. Technique', dept: 'technique', niveau: 2 },
      { slug: 'charge_clientele', nom: 'Charge Clientele', dept: 'support', niveau: 3 },
      { slug: 'assistant_administratif', nom: 'Assistant Administratif', dept: 'admin', niveau: 3 },
      { slug: 'comptable', nom: 'Comptable', dept: 'comptabilite', niveau: 3 },
      { slug: 'responsable_rh', nom: 'Responsable RH', dept: 'rh', niveau: 2 },
    ],
  },
}

// Helpers
export function getSecteur(key) {
  return SECTEURS_METIERS[key] || null
}

export function getSecteursList() {
  return Object.values(SECTEURS_METIERS).map(s => ({
    key: s.key, label: s.label, icone: s.icone, description: s.description
  }))
}

export function getDepartementsBySecteur(secteurKey) {
  return SECTEURS_METIERS[secteurKey]?.departements || []
}

export function getPostesBySecteur(secteurKey) {
  return SECTEURS_METIERS[secteurKey]?.postes || []
}

export function getModulesRecommandes(secteurKey) {
  return SECTEURS_METIERS[secteurKey]?.modules_recommandes || ['organisation','conges']
}

// Mapping poste -> departement par defaut
export function getDeptDefautForPoste(secteurKey, posteSlug) {
  const postes = getPostesBySecteur(secteurKey)
  const poste = postes.find(p => p.slug === posteSlug)
  return poste?.dept || null
}

// Tous les secteurs sous forme de liste pour le select
export const SECTEURS_OPTIONS = Object.values(SECTEURS_METIERS).map(s => ({
  value: s.key, label: s.icone + ' ' + s.label
}))
