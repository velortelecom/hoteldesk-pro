import React from 'react'
import { APP_NAME, APP_SHORT_NAME, APP_INITIALS, APP_URL, SUPPORT_EMAIL, WEBSITE, PRIMARY_COLOR, SECONDARY_COLOR, ACCENT_COLOR } from './config'

export { APP_NAME, APP_SHORT_NAME, APP_INITIALS, APP_URL, SUPPORT_EMAIL, WEBSITE, PRIMARY_COLOR, SECONDARY_COLOR, ACCENT_COLOR }
export const APP_NAME_SHORT = APP_SHORT_NAME
export const APP_INITIAL = APP_INITIALS

// Logo officiel Velor One - source unique utilisee partout dans l'app
export const LOGO_URL = '/icon-512.png'

// Composant unique de logo. Toute l'application doit utiliser ce composant
// pour afficher le logo Velor One (jamais de logo en dur ailleurs).
export function BrandMark(props) {
        const size = props.size || 32
        const radius = props.radius !== undefined ? props.radius : Math.round(size * 0.22)
        return React.createElement('img', {
                      src: LOGO_URL,
                      alt: APP_NAME,
                      style: {
                                            width: size, height: size, borderRadius: radius,
                                            objectFit: 'cover', display: 'block', flexShrink: 0,
                      }
        })
}

export function BrandLogo(props) {
        return BrandMark(props)
}

export default { APP_NAME, APP_SHORT_NAME, APP_INITIALS, APP_URL, SUPPORT_EMAIL, WEBSITE, PRIMARY_COLOR, SECONDARY_COLOR, ACCENT_COLOR, LOGO_URL, BrandMark, BrandLogo }
