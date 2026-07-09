import React from 'react'

// Bibliotheque unique d'icones Velor One. Ne jamais importer un autre pack d'icones.
// Toujours ajouter une nouvelle icone ici si besoin, jamais ailleurs.

function createIcon(paths) {
  return function Icon(props) {
    var size = props.size || 18
    var color = props.color || 'currentColor'
    var strokeWidth = props.strokeWidth || 2
    return React.createElement('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      strokeWidth: strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      style: props.style,
      'aria-hidden': props['aria-label'] ? undefined : true,
      role: props['aria-label'] ? 'img' : undefined,
      'aria-label': props['aria-label'],
    }, paths.map(function (d, i) {
      return React.createElement('path', { d: d, key: i })
    }))
  }
}

export var CheckIcon = createIcon(['M20 6L9 17l-5-5'])
export var XIcon = createIcon(['M18 6L6 18', 'M6 6l12 12'])
export var ChevronDownIcon = createIcon(['M6 9l6 6 6-6'])
export var ChevronLeftIcon = createIcon(['M15 18l-6-6 6-6'])
export var ChevronRightIcon = createIcon(['M9 18l6-6-6-6'])
export var SearchIcon = createIcon(['M11 19a8 8 0 100-16 8 8 0 000 16z', 'M21 21l-4.35-4.35'])
export var UserIcon = createIcon(['M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2', 'M12 11a4 4 0 100-8 4 4 0 000 8z'])
export var UsersIcon = createIcon(['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', 'M9 11a4 4 0 100-8 4 4 0 000 8z', 'M23 21v-2a4 4 0 00-3-3.87', 'M16 3.13a4 4 0 010 7.75'])
export var SettingsIcon = createIcon(['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.65 1.65 0 00.33 1.82'])
export var AlertCircleIcon = createIcon(['M12 22a10 10 0 100-20 10 10 0 000 20z', 'M12 8v4', 'M12 16h.01'])
export var AlertTriangleIcon = createIcon(['M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', 'M12 9v4', 'M12 17h.01'])
export var InfoIcon = createIcon(['M12 22a10 10 0 100-20 10 10 0 000 20z', 'M12 16v-4', 'M12 8h.01'])
export var PlusIcon = createIcon(['M12 5v14', 'M5 12h14'])
export var EditIcon = createIcon(['M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', 'M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z'])
export var TrashIcon = createIcon(['M3 6h18', 'M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2', 'M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6', 'M10 11v6', 'M14 11v6'])
export var EyeIcon = createIcon(['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 15a3 3 0 100-6 3 3 0 000 6z'])
export var EyeOffIcon = createIcon(['M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a19.6 19.6 0 015.06-6.06', 'M14.12 14.12a3 3 0 11-4.24-4.24', 'M1 1l22 22'])
export var CalendarIcon = createIcon(['M3 4h18v18H3z', 'M16 2v4', 'M8 2v4', 'M3 10h18'])
export var ClockIcon = createIcon(['M12 22a10 10 0 100-20 10 10 0 000 20z', 'M12 6v6l4 2'])
export var MenuIcon = createIcon(['M3 12h18', 'M3 6h18', 'M3 18h18'])
export var LogOutIcon = createIcon(['M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4', 'M16 17l5-5-5-5', 'M21 12H9'])
export var HomeIcon = createIcon(['M3 9l9-7 9 7', 'M9 22V12h6v10'])
export var LoaderIcon = createIcon(['M12 2v4', 'M12 18v4', 'M4.93 4.93l2.83 2.83', 'M16.24 16.24l2.83 2.83', 'M2 12h4', 'M18 12h4', 'M4.93 19.07l2.83-2.83', 'M16.24 7.76l2.83-2.83'])

var ICONS = { CheckIcon: CheckIcon, XIcon: XIcon, ChevronDownIcon: ChevronDownIcon, ChevronLeftIcon: ChevronLeftIcon, ChevronRightIcon: ChevronRightIcon, SearchIcon: SearchIcon, UserIcon: UserIcon, UsersIcon: UsersIcon, SettingsIcon: SettingsIcon, AlertCircleIcon: AlertCircleIcon, AlertTriangleIcon: AlertTriangleIcon, InfoIcon: InfoIcon, PlusIcon: PlusIcon, EditIcon: EditIcon, TrashIcon: TrashIcon, EyeIcon: EyeIcon, EyeOffIcon: EyeOffIcon, CalendarIcon: CalendarIcon, ClockIcon: ClockIcon, MenuIcon: MenuIcon, LogOutIcon: LogOutIcon, HomeIcon: HomeIcon, LoaderIcon: LoaderIcon }

export default ICONS
