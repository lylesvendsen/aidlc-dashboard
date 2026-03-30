import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "AIDLC Dashboard",
  description: "AI-Driven Development Lifecycle — local management dashboard",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 font-sans antialiased">
        <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
          <a href="/" className="text-base font-semibold text-brand-600 hover:text-brand-700">
            AIDLC
          </a>
          <a href="/applications" className="text-sm text-gray-600 hover:text-gray-900">Applications</a>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
