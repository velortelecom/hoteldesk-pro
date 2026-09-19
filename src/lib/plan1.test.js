// src/lib/plan1.test.js
// Verrous de non-regression sur le contenu commercial du Plan 1.
// Si quelqu'un ajoute un module au Plan 1 sans l'avoir developpe, ces
// tests tombent.
import {
  PLAN_1_ID, PLAN_1_MODULES, PLAN_1_MODULES_DETAIL, PLAN_1_SOCLE,
  estModulePlan1,
} from './plan1'
import { MODULES_REGISTRY, getModuleById } from '../modules/registry'
import { SOCLE_MENUS } from './modules'
// La liste des modules developpes etait RECOPIEE ici, et elle avait deja
// diverge de src/lib/modulesDeveloppes.js (qui compte le pointage, pas
// celle-ci). Meme famille de bug que les quatre definitions de packs :
// on importe la source, on ne la duplique plus.
import { MODULES_DEVELOPPES } from './modulesDeveloppes'

test('le Plan 1 est le plan starter', () => {
  expect(PLAN_1_ID).toBe('starter')
})

test('le Plan 1 ne contient que des modules reellement developpes', () => {
  // INCLUSION, plus egalite.
  //
  // La regle qui compte est « on ne vend pas ce qui n'existe pas ».
  // L'egalite disait en plus « tout ce qui existe est dans le pack de
  // base » -- ce qui etait vrai par hasard, tant qu'aucun module
  // n'avait vocation a se vendre a part.
  //
  // La geolocalisation change ca : elle existe, elle fonctionne, et
  // elle n'est PAS incluse dans Velor One. La garder dans l'egalite
  // l'aurait offerte a 39 EUR sans que personne le decide.
  PLAN_1_MODULES.forEach(id => {
    expect(MODULES_DEVELOPPES).toContain(id)
  })
})

test('un module developpe hors pack de base est un choix, pas un oubli', () => {
  // Si un module developpe n'est dans aucune offre, c'est qu'il se vend
  // a part. Ce test ne l'interdit pas -- il oblige a le declarer ici,
  // pour qu'on sache que la question a ete posee.
  const horsPackDeBase = MODULES_DEVELOPPES.filter(id => !PLAN_1_MODULES.includes(id))
  expect(horsPackDeBase).toEqual(['gps'])
})

test('chaque module du Plan 1 existe dans le registre et est actif', () => {
  PLAN_1_MODULES.forEach(id => {
    const mod = getModuleById(id)
    expect(mod).not.toBeNull()
    expect(mod.actif).toBe(true)
  })
})

test('le registre declare bien les modules du Plan 1 comme disponibles en starter', () => {
  PLAN_1_MODULES.forEach(id => {
    expect(getModuleById(id).plans).toContain('starter')
  })
})

test('le detail affiche correspond exactement aux modules du Plan 1', () => {
  expect(PLAN_1_MODULES_DETAIL.map(m => m.id).sort()).toEqual([...PLAN_1_MODULES].sort())
})

test('le socle affiche correspond au socle reel de l application', () => {
  expect(PLAN_1_SOCLE.map(m => m.id).sort()).toEqual(SOCLE_MENUS.map(m => m.id).sort())
})

test('estModulePlan1 refuse tout module non developpe', () => {
  const nonDeveloppes = MODULES_REGISTRY.map(m => m.id).filter(id => !MODULES_DEVELOPPES.includes(id))
  expect(nonDeveloppes.length).toBeGreaterThan(0)
  nonDeveloppes.forEach(id => expect(estModulePlan1(id)).toBe(false))
})
