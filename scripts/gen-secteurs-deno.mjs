// scripts/gen-secteurs-deno.mjs
// Genere supabase/functions/_shared/secteurs_templates.ts a partir de src/lib/secteurs.js
// L'Edge Function public-signup tourne sous Deno et ne peut pas importer src/.
// Ce script evite toute recopie manuelle : relancer apres chaque modif de secteurs.js.
//   node scripts/gen-secteurs-deno.mjs
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = resolve(root, 'src/lib/.secteurs.gen.mjs')
copyFileSync(resolve(root, 'src/lib/secteurs.js'), tmp)
const { SECTEURS_METIERS } = await import(tmp + '?t=' + Date.now())
unlinkSync(tmp)

const compact = {}
for (const [key, s] of Object.entries(SECTEURS_METIERS)) {
  compact[key] = {
    label: s.label,
    icone: s.icone,
    description: s.description,
    departements: s.departements,
    postes: s.postes,
  }
}

const out = `// GENERE AUTOMATIQUEMENT - NE PAS EDITER A LA MAIN
// Source : src/lib/secteurs.js
// Regenerer : node scripts/gen-secteurs-deno.mjs
// Utilise par l'Edge Function public-signup pour creer les departements et
// postes par defaut d'une entreprise inscrite publiquement.

export type DepartementTemplate = { code: string; nom: string; couleur: string }
export type PosteTemplate = { slug: string; nom: string; dept: string; niveau: number }
export type SecteurTemplate = {
  label: string
  icone: string
  description: string
  departements: DepartementTemplate[]
  postes: PosteTemplate[]
}

export const SECTEURS_TEMPLATES: Record<string, SecteurTemplate> = ${JSON.stringify(compact, null, 2)}

export const SECTEURS_VALIDES = Object.keys(SECTEURS_TEMPLATES)

export function getTemplate(secteur: string): SecteurTemplate | null {
  return SECTEURS_TEMPLATES[secteur] ?? null
}
`
const dest = resolve(root, 'supabase/functions/_shared/secteurs_templates.ts')
writeFileSync(dest, out, 'utf8')
console.log('Ecrit : ' + dest + ' (' + Object.keys(compact).length + ' secteurs)')
