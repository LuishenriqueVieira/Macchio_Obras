import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Macchio | Gestão de Obras',description:'Acompanhamento de obras, medições, engenheiros, equipes e documentos.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pt-BR"><body>{children}</body></html>}
