import type { Metadata } from 'next';
import './globals.css';
import './workspace.css';
export const metadata: Metadata = {title:'Macchio | Gestão de Obras',description:'Acompanhamento de obras, medições, engenheiros, equipes e documentos.',icons:{icon:'/brand/macchio-mark.png',shortcut:'/brand/macchio-mark.png'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pt-BR"><body>{children}</body></html>}
