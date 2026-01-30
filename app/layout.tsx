import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'YouTube Downloader Pro',
  description: 'Download YouTube videos and audio in all formats and qualities',
  keywords: ['YouTube', 'downloader', 'video', 'audio', 'MP4', 'MP3', 'HD', '4K'],
  authors: [{ name: 'YouTube Downloader Pro' }],
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  openGraph: {
    title: 'YouTube Downloader Pro',
    description: 'Download YouTube videos and audio in all formats and qualities',
    url: 'https://youtube-downloader-pro.vercel.app',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}