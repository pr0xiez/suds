import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import localFont from 'next/font/local'

/** Archivo's width axis gives page titles their wide, automotive stance. */
const archivo = localFont({
  src: '../node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2',
  variable: '--font-archivo',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
})

export const fontVariables = `${GeistSans.variable} ${GeistMono.variable} ${archivo.variable}`
