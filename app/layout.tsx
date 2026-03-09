import type { Metadata } from 'next'
import { Geist, Geist_Mono, Playfair_Display, Inter, Fira_Code } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const playfair = Playfair_Display({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const firaCode = Fira_Code({
  variable: '--font-mono-data',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'BrandLegacy Members',
  description: 'Área exclusiva da mentoria BrandLegacy. Acesse seus módulos, aulas e materiais.',
  icons: {
    icon: '/icon.jpg',
    apple: '/icon.jpg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${inter.variable} ${firaCode.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
