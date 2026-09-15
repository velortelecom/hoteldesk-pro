// src/lib/plan1.test.js
// Verrous de non-regression sur le contenu commercial du Plan 1.
// Si quelqu'un ajoute un module au Plan 1 sans l'avoir developpe, ces
// tests tombent.
import {
  PLAN_1_ID, PLAN_1_MODULES, PLAN_1_MODULES_DETAIL, PLAN_1_SOCLE,
  PACKS_SUPERIEURS, estModulePlan1,
} from './plan1'
import { MODULES_REGISTRY, getModuleById } from '../modules/registry'
import { SOCLE_MENUS } from './modules'

// Modules effectivement developpes (dossier dedie sous src/modules/).
const MODULES_DEVELOPPES = ['organisation', 'conges']

test('le Plan 1 est le plan starter', () => {
  expect(PLAN_1_ID).toBe('starter')
})

test('le Plan 1 ne contient que des modules reellement developpes', () => {
  expect([...PLAN_1_MODULES].sort()).toEqual([...MODULES_DEVELOPPES].sort())
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

test('aucun pack superieur ne reprend un module du Plan 1', () => {
  PACKS_SUPERIEURS.forEach(pack => {
    pack.modules.forEach(id => {
      expect(estModulePlan1(id)).toBe(false)
    })
  })
})

test('les modules des packs superieurs existent dans le registre', () => {
  const ids = MODULES_REGISTRY.map(m => m.id)
  PACKS_SUPERIEURS.forEach(pack => {
    pack.modules.forEach(id => expect(ids).toContain(id))
  })
})

test('estModulePlan1 refuse tout module non developpe', () => {
  const nonDeveloppes = MODULES_REGISTRY.map(m => m.id).filter(id => !MODULES_DEVELOPPES.includes(id))
  expect(nonDeveloppes.length).toBeGreaterThan(0)
  nonDeveloppes.forEach(id => expect(estModulePlan1(id)).toBe(false))
})
