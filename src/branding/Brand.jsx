import React from 'react'
import { COLORS } from './theme'

export const APP_NAME = 'Velor One'
export const APP_NAME_SHORT = 'Velor One'
export const APP_INITIAL = 'V'

export function BrandMark(props) {
    const size = props.size || 32
    const radius = props.radius || 8
    const fontSize = props.fontSize || 16
    return React.createElement('div', {
          style: {
                  width: size, height: size, background: COLORS.primaire, borderRadius: radius,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: fontSize,
          }
    }, APP_INITIAL)
}

export default { APP_NAME, APP_NAME_SHORT, APP_INITIAL, BrandMark }
