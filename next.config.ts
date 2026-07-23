import type { NextConfig } from "next";

// Allows next/image to fetch hero/gallery photos from the public Supabase
// Storage bucket (see src/lib/media.ts). Blank when Supabase isn't
// configured, which just means those images fall back to public/ instead.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
