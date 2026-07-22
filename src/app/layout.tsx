import type { Metadata } from "next";
import { Geist, Geist_Mono, Padauk } from "next/font/google";
import Link from "next/link";
import { project } from "@/config/project";
import { SiteHeader } from "@/components/site-header";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
/** Burmese glyphs — falls in behind Geist so my-MM text renders cleanly. */
const padauk = Padauk({
  variable: "--font-padauk",
  weight: ["400", "700"],
  subsets: ["myanmar"],
});

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
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${padauk.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ToastProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border py-6">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-5 text-sm text-muted">
              <span>
                {project.name} — built by {project.team} · Ka Note (ကနုတ်) theme
              </span>
              <span className="ml-auto flex items-center gap-4">
                {project.secondaryNav.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="transition-colors hover:text-foreground"
                    title={link.blurb}
                  >
                    {link.label}
                  </Link>
                ))}
              </span>
            </div>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
