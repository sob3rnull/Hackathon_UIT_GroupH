/**
 * Shared Google Maps JS loader.
 *
 * Maps JavaScript API bills PER MAP LOAD — every `new google.maps.Map()` is
 * one billable event (10k free/month on the Essentials tier). The `<script>`
 * tag itself is free to load any number of times a page wants a NEW Map
 * instance, but only needs inserting once per browser session — so the
 * promise below is module-level and shared by every component that wants a
 * map (the dispatcher's overview map, the ambulance page's route map), not
 * reloaded per component.
 *
 * The key in NEXT_PUBLIC_GOOGLE_MAPS_KEY ships in the bundle by design; its
 * protection is the referrer + API restrictions set in Cloud Console.
 */

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
export const googleMapsAvailable = Boolean(KEY);

declare global {
  interface Window {
    __medirouteMapsReady?: () => void;
  }
}

let loaderPromise: Promise<typeof google> | null = null;

export function loadMapsScript(): Promise<typeof google> {
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Maps can only load in the browser"));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google);
      return;
    }

    window.__medirouteMapsReady = () => resolve(window.google);

    const script = document.createElement("script");
    script.async = true;
    script.src =
      "https://maps.googleapis.com/maps/api/js" +
      `?key=${encodeURIComponent(KEY)}&loading=async&callback=__medirouteMapsReady`;
    script.onerror = () => {
      loaderPromise = null; // allow a retry on the next mount
      reject(new Error("Google Maps failed to load"));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

/** Reads a CSS custom property with a fallback, for theme-matched map overlays. */
export function mapThemeColor(name: string, fallback: string): string {
  return typeof window === "undefined"
    ? fallback
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
