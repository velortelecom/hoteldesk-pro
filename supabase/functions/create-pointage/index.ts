// DRAFT -- NON EXECUTE -- NON VALIDE EN PRODUCTION
// Ce fichier depend de la verification du schema reel Supabase.
//
// supabase/functions/create-pointage/index.ts
// Point d'ecriture unique pour la table pointages. Le frontend ne decide
// jamais du statut ni du motif_refus : tout est calcule ici, cote serveur.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const ACTIONS_VALIDES = ["arrivee", "depart", "debut_pause", "fin_pause"] as const;
type Action = typeof ACTIONS_VALIDES[number];

const MOTIFS_REFUS = [
    "hors_zone",
    "double_arrivee",
    "depart_sans_arrivee",
    "pause_incoherente",
    "site_non_configure",
    "gps_manquant",
  ] as const;
type MotifRefus = typeof MOTIFS_REFUS[number];

type Statut = "accepte" | "refuse" | "en_attente_correction" | "corrige";

const DEFAUT_PARAMETRES = {
    precision_gps_max_metres: 50,
    gps_obligatoire: true,
    autoriser_hors_zone_avec_validation: false,
    duree_max_entre_pointages_minutes: null as number | null,
      tolerance_retard_minutes: 15,
    methodes_actives: { gps: true } as Record<string, boolean>,
};

type ContexteValidation = {
    supabase: ReturnType<typeof createClient>;
    entrepriseId: string;
    profileId: string;
    site: { id: string; latitude: number | null; longitude: number | null; rayon_pointage_metres: number; pointage_gps_obligatoire: boolean } | null;
    parametres: typeof DEFAUT_PARAMETRES;
    latitude: number | null;
    longitude: number | null;
      action: Action;
      plannedShift: {
            id: string;
            heure_debut: string;
            heure_fin: string;
            tolerance_retard_minutes: number;
      } | null;
      onApprovedLeave: boolean;
};

type ResultatValidation = {
    statut: Statut;
    motif_refus: MotifRefus | null;
    distance_metres: number | null;
    vitesse_estimee_kmh: number | null;
    position_suspecte: boolean;
    metadonnees: Record<string, unknown> | null;
      hard_error?: string | null;
};

interface ValidateurMethode {
    valider(ctx: ContexteValidation): Promise<ResultatValidation>;
}

// Seule methode active en V1. nfc / rfid / bluetooth_beacon / wifi_entreprise
// sont des emplacements reserves pour plus tard (voir REGISTRE_METHODES).
async function validerGps(ctx: ContexteValidation): Promise<ResultatValidation> {
      const { supabase, profileId, site, parametres, latitude, longitude, action, plannedShift, onApprovedLeave } = ctx;

  const gpsObligatoireEffectif = site?.pointage_gps_obligatoire ?? parametres.gps_obligatoire;

  // Anti-triche : vitesse estimee par rapport au pointage precedent (tous statuts)
  let vitesseEstimeeKmh: number | null = null;
    let positionSuspecte = false;
    if (latitude != null && longitude != null) {
          const { data: precedent } = await supabase
            .from("pointages")
            .select("latitude, longitude, horodatage_evenement")
            .eq("profile_id", profileId)
            .not("latitude", "is", null)
            .not("longitude", "is", null)
            .order("horodatage_evenement", { ascending: false })
            .limit(1)
            .maybeSingle();

      if (precedent?.latitude != null && precedent?.longitude != null) {
              const distancePrecedenteM = haversineMetres(latitude, longitude, precedent.latitude, precedent.longitude);
              const deltaSecondes = (Date.now() - new Date(precedent.horodatage_evenement).getTime()) / 1000;
              if (deltaSecondes > 0) {
                        vitesseEstimeeKmh = Math.round((distancePrecedenteM / 1000) / (deltaSecondes / 3600) * 100) / 100;
                        // V1 : detection non bloquante, simple signalement pour revue admin future
                if (vitesseEstimeeKmh > 300) {
                            positionSuspecte = true;
                }
              }
      }
    }

  if (!site || site.latitude === null || site.longitude === null) {
        if (gpsObligatoireEffectif) {
            return { statut: "refuse", motif_refus: "site_non_configure", distance_metres: null, vitesse_estimee_kmh: vitesseEstimeeKmh, position_suspecte: positionSuspecte, metadonnees: null };
        }
      return { statut: "accepte", motif_refus: null, distance_metres: null, vitesse_estimee_kmh: vitesseEstimeeKmh, position_suspecte: positionSuspecte, metadonnees: null };
  }

  if (latitude == null || longitude == null) {
        if (gpsObligatoireEffectif) {
              return { statut: "refuse", motif_refus: "gps_manquant", distance_metres: null, vitesse_estimee_kmh: vitesseEstimeeKmh, position_suspecte: positionSuspecte, metadonnees: null };
        }
              return { statut: "accepte", motif_refus: null, distance_metres: null, vitesse_estimee_kmh: vitesseEstimeeKmh, position_suspecte: positionSuspecte, metadonnees: null };
  }

  const distanceMetres = Math.round(haversineMetres(latitude, longitude, site.latitude, site.longitude) * 100) / 100;
    const horsZone = distanceMetres > site.rayon_pointage_metres;

  if (horsZone && gpsObligatoireEffectif) {
        if (parametres.autoriser_hors_zone_avec_validation) {
                return { statut: "en_attente_correction", motif_refus: "hors_zone", distance_metres: distanceMetres, vitesse_estimee_kmh: vitesseEstimeeKmh, position_suspecte: positionSuspecte, metadonnees: null };
        }
        return { statut: "refuse", motif_refus: "hors_zone", distance_metres: distanceMetres, vitesse_estimee_kmh: vitesseEstimeeKmh, position_suspecte: positionSuspecte, metadonnees: null };
  }

  let statut: Statut = "accepte";
  const metadonnees: Record<string, unknown> = {};

  if (onApprovedLeave) {
        return {
              statut: "refuse",
              motif_refus: "pause_incoherente",
              distance_metres: distanceMetres,
              vitesse_estimee_kmh: vitesseEstimeeKmh,
              position_suspecte: positionSuspecte,
              metadonnees: { leave_conflict: true },
              hard_error: "employee_on_approved_leave",
        };
  }

  if (plannedShift) {
        metadonnees.shift_id = plannedShift.id;
        metadonnees.shift_start = plannedShift.heure_debut;
        metadonnees.shift_end = plannedShift.heure_fin;
        if (action === "arrivee") {
              const now = new Date();
              const [plannedHour, plannedMinute] = plannedShift.heure_debut.split(":").map(Number);
              const startDate = new Date(now);
              startDate.setHours(plannedHour, plannedMinute, 0, 0);
              const deltaMinutes = Math.round((now.getTime() - startDate.getTime()) / 60000);
              metadonnees.delta_minutes = deltaMinutes;
              if (deltaMinutes > plannedShift.tolerance_retard_minutes) {
                    statut = "en_attente_correction";
                    metadonnees.shift_anomaly = "retard";
              }
        }
  }

  return { statut, motif_refus: null, distance_metres: distanceMetres, vitesse_estimee_kmh: vitesseEstimeeKmh, position_suspecte: positionSuspecte, metadonnees };
}

const REGISTRE_METHODES: Record<string, ValidateurMethode> = {
    gps: { valider: validerGps },
    // nfc: { valider: validerNfc },              // stocker un HASH de l'UID, jamais l'identifiant brut
    // rfid: { valider: validerRfid },             // idem : hash ou id interne, pas l'identifiant brut
    // bluetooth_beacon: { valider: validerBeacon }, // hash de l'UUID du beacon
    // wifi_entreprise: { valider: validerWifi },    // hash du BSSID, jamais SSID/mot de passe
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
          return new Response(null, { headers: corsHeaders });
    }
    if (req.method !== "POST") {
          return jsonResponse({ success: false, error: "method_not_allowed" }, 405);
    }

             const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
          return jsonResponse({ success: false, error: "server_misconfigured" }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

             const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
          return jsonResponse({ success: false, error: "missing_token" }, 401);
    }
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData?.user) {
          return jsonResponse({ success: false, error: "invalid_token" }, 401);
    }
    const authUserId = userData.user.id;

             const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, entreprise_id, site_id")
      .eq("id", authUserId)
      .single();
    if (profileError || !profile) {
          return jsonResponse({ success: false, error: "profile_not_found" }, 404);
    }
    const entrepriseId = profile.entreprise_id as string;
    const siteId = profile.site_id as string | null;

                  // Module commercial réellement activé : pointage
             const { data: moduleRow } = await supabase
      .from("entreprise_modules")
      .select("actif")
      .eq("entreprise_id", entrepriseId)
            .eq("module_id", "pointage")
      .maybeSingle();
    if (!moduleRow || moduleRow.actif !== true) {
          return jsonResponse({ success: false, error: "module_inactive" }, 403);
    }

             const { data: parametresRow, error: parametresError } = await supabase
      .from("entreprise_parametres_pointage")
      .select("precision_gps_max_metres, gps_obligatoire, autoriser_hors_zone_avec_validation, duree_max_entre_pointages_minutes, methodes_actives")
      .eq("entreprise_id", entrepriseId)
      .maybeSingle();
    if (parametresError) {
        console.error("create-pointage: echec lecture entreprise_parametres_pointage", { entrepriseId, error: parametresError });
        return jsonResponse({ success: false, error: "parametres_pointage_unavailable" }, 500);
    }

             const parametres = {
                   ...DEFAUT_PARAMETRES,
                   ...(parametresRow ?? {}),
                   methodes_actives: (parametresRow?.methodes_actives as Record<string, boolean>) ?? { gps: true },
             };

                                     const today = new Date().toISOString().slice(0, 10);
                                     const [{ data: leaveRow }, { data: plannedShift }] = await Promise.all([
                  supabase
                        .from("conges")
                        .select("id")
                        .eq("entreprise_id", entrepriseId)
                        .eq("employe_id", authUserId)
                        .eq("statut", "approuve")
                        .lte("date_debut", today)
                        .gte("date_fin", today)
                        .limit(1)
                        .maybeSingle(),
                  supabase
                        .from("shifts")
                        .select("id, heure_debut, heure_fin")
                        .eq("entreprise_id", entrepriseId)
                        .eq("employe_id", authUserId)
                        .eq("date_shift", today)
                        .neq("statut", "annule")
                        .order("heure_debut", { ascending: true })
                        .limit(1)
                        .maybeSingle(),
            ]);

             let body: Record<string, unknown>;
    try {
          body = await req.json();
    } catch {
          return jsonResponse({ success: false, error: "invalid_json" }, 400);
    }

             // Champs lus depuis le body -- jamais horodatage_evenement, cree_hors_ligne,
             // synced_at, statut ou motif_refus : ces champs sont toujours calcules/poses
             // cote serveur, jamais acceptes depuis la requete client.
             const action = body.action as string;
    const latitude = (body.latitude as number | null | undefined) ?? null;
    const longitude = (body.longitude as number | null | undefined) ?? null;
    const precisionMetres = (body.precision_metres as number | null | undefined) ?? null;
    const appareil = (body.appareil as string | null | undefined) ?? null;
    const userAgent = (body.user_agent as string | null | undefined) ?? req.headers.get("user-agent");
    const timezone = (body.timezone as string | null | undefined) ?? null;
    const commentaire = (body.commentaire as string | null | undefined) ?? null;
    const methode = ((body.methode as string) ?? "gps").trim();

             if (!ACTIONS_VALIDES.includes(action as Action)) {
                   return jsonResponse({ success: false, error: "invalid_action" }, 400);
             }

             if (parametres.methodes_actives[methode] !== true) {
                   return jsonResponse({ success: false, error: "methode_disabled" }, 403);
             }
    const validateur = REGISTRE_METHODES[methode];
    if (!validateur) {
          return jsonResponse({ success: false, error: "methode_unknown" }, 400);
    }

             const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;

             let site: ContexteValidation["site"] = null;
    if (siteId) {
          const { data: siteRow } = await supabase
            .from("sites")
            .select("id, latitude, longitude, rayon_pointage_metres, pointage_gps_obligatoire")
            .eq("id", siteId)
            .maybeSingle();
          site = siteRow ?? null;
    }

             const resultat = await validateur.valider({
                   supabase,
                   entrepriseId,
                   profileId: authUserId,
                   site,
                   parametres,
                   latitude,
                   longitude,
                   action: action as Action,
                   plannedShift: plannedShift
                     ? {
                         id: plannedShift.id,
                         heure_debut: plannedShift.heure_debut,
                         heure_fin: plannedShift.heure_fin,
                         tolerance_retard_minutes: Number(parametres.tolerance_retard_minutes ?? 15),
                       }
                     : null,
                   onApprovedLeave: Boolean(leaveRow?.id),
             });

             if (resultat.hard_error) {
                   return jsonResponse({ success: false, error: resultat.hard_error }, 409);
             }

             let statutFinal = resultat.statut;
    let motifFinal = resultat.motif_refus;

             // Coherence de sequence : basee sur le dernier pointage accepte OU en
             // attente de correction (un pointage refuse n'affecte pas la sequence).
             if (statutFinal === "accepte" || statutFinal === "en_attente_correction") {
                   const { data: dernierPertinent } = await supabase
                     .from("pointages")
                     .select("action")
                     .eq("profile_id", authUserId)
                     .in("statut", ["accepte", "en_attente_correction"])
                     .order("horodatage_evenement", { ascending: false })
                     .limit(1)
                     .maybeSingle();

      const dernierAction = dernierPertinent?.action as Action | undefined;
                   const enService = dernierAction === "arrivee" || dernierAction === "fin_pause";
                   const enPause = dernierAction === "debut_pause";
                   const horsService = !dernierAction || dernierAction === "depart";

      let motifIncoherence: MotifRefus | null = null;
                   if (action === "arrivee" && !horsService) {
                           motifIncoherence = "double_arrivee";
                   } else if (action === "depart" && !enService) {
                           motifIncoherence = "depart_sans_arrivee";
                   } else if (action === "debut_pause" && !enService) {
                           motifIncoherence = "pause_incoherente";
                   } else if (action === "fin_pause" && !enPause) {
                           motifIncoherence = "pause_incoherente";
                   }

      if (motifIncoherence) {
              statutFinal = "refuse";
              motifFinal = motifIncoherence;
      }
             }

             // Precision GPS insuffisante : on accepte mais on marque pour revue admin,
             // on ne refuse jamais uniquement pour ce motif.
             if (statutFinal === "accepte" && precisionMetres != null && precisionMetres > parametres.precision_gps_max_metres) {
                   statutFinal = "en_attente_correction";
             }

             // Insertion : horodatage_evenement, cree_hors_ligne, synced_at ne sont
             // jamais renseignes ici -- ils reposent uniquement sur les DEFAULT de la
             // table (now(), false, NULL), jamais sur une valeur venant du client.
             const { data: inserted, error: insertError } = await supabase
      .from("pointages")
      .insert({
              entreprise_id: entrepriseId,
              site_id: siteId,
              profile_id: authUserId,
              action,
              statut: statutFinal,
              motif_refus: motifFinal,
              latitude,
              longitude,
              distance_metres: resultat.distance_metres,
              precision_metres: precisionMetres,
              methode,
              appareil,
              user_agent: userAgent,
              ip_address: ipAddress,
              timezone,
              commentaire,
              duree_minutes: null,
              vitesse_estimee_kmh: resultat.vitesse_estimee_kmh,
              position_suspecte: resultat.position_suspecte,
              metadonnees: resultat.metadonnees,
      })
      .select()
      .single();

             if (insertError || !inserted) {
                   return jsonResponse({ success: false, error: "insert_failed" }, 500);
             }

             const historiqueJour = await calculerHistoriqueEtBouton(supabase, authUserId);

             return jsonResponse(
               {
                       success: true,
                       statut: statutFinal,
                       motif_refus: motifFinal,
                       distance_metres: resultat.distance_metres,
                       vitesse_estimee_kmh: resultat.vitesse_estimee_kmh,
                       position_suspecte: resultat.position_suspecte,
                       pointage: inserted,
                       historique_jour: historiqueJour,
               },
                   200,
                 );
});

// Historique du jour + prochain bouton autorise, pour simplifier le frontend.
// Bornes du jour en UTC en V1 (simplification ; un calcul par fuseau horaire
// de l'employe pourra etre ajoute plus tard si necessaire).
async function calculerHistoriqueEtBouton(
    supabase: ReturnType<typeof createClient>,
    profileId: string,
  ) {
    const debutJour = new Date();
    debutJour.setUTCHours(0, 0, 0, 0);

  const { data: pointagesJourRaw } = await supabase
      .from("pointages")
      .select("action, statut, horodatage_evenement")
      .eq("profile_id", profileId)
      .in("statut", ["accepte", "en_attente_correction"])
      .gte("horodatage_evenement", debutJour.toISOString())
      .order("horodatage_evenement", { ascending: true });

  const pointagesJour = pointagesJourRaw ?? [];
    const premier = pointagesJour[0] ?? null;
    const dernier = pointagesJour[pointagesJour.length - 1] ?? null;

  let minutesTravaillees = 0;
    let debutSession: Date | null = null;
    for (const p of pointagesJour) {
          if (p.action === "arrivee" || p.action === "fin_pause") {
                  debutSession = new Date(p.horodatage_evenement);
          } else if ((p.action === "depart" || p.action === "debut_pause") && debutSession) {
                  minutesTravaillees += (new Date(p.horodatage_evenement).getTime() - debutSession.getTime()) / 60000;
                  debutSession = null;
          }
    }
    if (debutSession) {
          minutesTravaillees += (Date.now() - debutSession.getTime()) / 60000;
    }

  const dernierAction = dernier?.action as Action | undefined;
    const enService = dernierAction === "arrivee" || dernierAction === "fin_pause";
    const enPause = dernierAction === "debut_pause";

  let prochainBoutonAutorise: Action = "arrivee";
    if (enService) prochainBoutonAutorise = "depart";
    else if (enPause) prochainBoutonAutorise = "fin_pause";

  return {
        premier_pointage: premier,
        dernier_pointage: dernier,
        temps_travaille_minutes: Math.round(minutesTravaillees),
        prochain_bouton_autorise: prochainBoutonAutorise,
  };
}
