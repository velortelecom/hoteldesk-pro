// src/modules/pointage/permissions.js
// =====================================================================
// canExport : qui peut sortir le classeur des heures.
//
// Un salarie voit SES heures dans l'onglet « Mes heures », il n'exporte
// rien -- ni celles de l'entreprise, ni les siennes. C'est le meme
// decoupage que partout ailleurs : consulter ce qui vous concerne, ce
// n'est pas lire le dossier des autres.
//
// LA QUESTION A ETE POSEE, ET TRANCHEE
//   « Et s'il veut son releve ? » Il le demande a son responsable, qui
//   l'exporte et le lui envoie. Une piece qui sert de preuve d'heures
//   sort par une personne identifiee, pas par un telechargement
//   silencieux -- et le responsable sait alors qu'une contestation
//   arrive.
//
//   C'est une decision, pas un oubli : n'ajoutez pas de bouton
//   « exporter mes heures » pour rendre service. Un test le refuse.
// =====================================================================
import { peutExporter } from '../../lib/droitsExport.js'

// canExport n'est pas recopie ici : il est DERIVE de droitsExport.js.
// Recopier la valeur, c'est ecrire la meme regle a deux endroits -- et
// le jour ou l'un des deux change, c'est toujours celui qu'on a oublie
// qui fait loi a l'ecran.
export const ROLE_POINTAGE_PERMISSIONS = {
  employe: {
    canView: true,
    canCreate: true,
    canEdit: false,
    canDelete: false,
    canManageSettings: false,
    canExport: peutExporter({ role: 'employe' }),
  },
  responsable: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canManageSettings: true,
    canExport: peutExporter({ role: 'responsable' }),
  },
  admin: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageSettings: true,
    canExport: peutExporter({ role: 'admin' }),
  },
  super_admin: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageSettings: true,
    canExport: peutExporter({ is_super_admin: true }),
  },
}

export function getPermissionsForRole(role = 'employe') {
  return ROLE_POINTAGE_PERMISSIONS[role] || ROLE_POINTAGE_PERMISSIONS.employe
}

export function canAccessPointage(role, permission = 'canView') {
  const permissions = getPermissionsForRole(role)
  return permissions?.[permission] === true
}
