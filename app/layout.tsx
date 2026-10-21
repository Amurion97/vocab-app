import type { Metadata } from "next"
import { Be_Vietnam_Pro, Geist, Geist_Mono } from "next/font/google"

import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: "400",
  variable: "--font-vietnamese",
})

export const metadata: Metadata = {
  title: "Vocab",
  description: "English to Vietnamese vocabulary with usage quizzes.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable,
        beVietnamPro.variable
      )}
    >
      <body>
        <ThemeProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-3xl px-4 py-6">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
