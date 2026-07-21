import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { project } from "@/config/project";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: project.name, template: `%s · ${project.name}` },
  description: project.tagline,
};

/**
 * Applies the saved theme before first paint so there's no white flash
 * when a dark-mode user loads the page in front of judges.
 */
const noFlashTheme = `
(function () {
  try {
    var saved = localStorage.getItem('theme');
    var dark = saved ? saved === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border py-6">
          <div className="mx-auto max-w-5xl px-5 text-sm text-muted">
            {project.name} — built by {project.team}
          </div>
        </footer>
      </body>
    </html>
  );
}
