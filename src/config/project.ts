/**
 * ─────────────────────────────────────────────────────────────
 *  START HERE ON HACKATHON DAY.
 *  Change this file first — the whole UI reads from it.
 *  Renaming the product, the tagline and the entity noun here
 *  re-labels the header, landing page, forms, empty states and
 *  page titles without touching a single component.
 * ─────────────────────────────────────────────────────────────
 */
export const project = {
  /** Product name. Shows in the header, the tab title and the hero. */
  name: "Hackathon Shell",

  /** One line. Shows under the hero heading and in the meta description. */
  tagline: "A pre-wired Next.js + Supabase shell, ready for tomorrow's topic.",

  /** Two or three sentences for the landing section / judges. */
  pitch:
    "Swap the entity, point the store at a Supabase table, drop your topic logic into the API route. Everything else — layout, theming, forms, loading and empty states — is already done.",

  /** Team or author name shown in the footer. */
  team: "Your team",

  /**
   * The core noun of your project. Rename this and every label follows:
   * "Add Item" → "Add Recipe", "No items yet" → "No recipes yet", etc.
   */
  entity: {
    singular: "Item",
    plural: "Items",
    /** Lowercase forms used mid-sentence. */
    singularLower: "item",
    pluralLower: "items",
  },

  /** Top-nav links. Add routes here as you build pages. */
  nav: [
    { href: "/", label: "Home" },
    { href: "/#workspace", label: "Workspace" },
  ],

  /**
   * Three cards on the landing page. Replace with your actual
   * value props once you know the topic.
   */
  highlights: [
    {
      title: "Capture",
      body: "A working create form wired end to end — client → API route → store.",
    },
    {
      title: "Store",
      body: "Runs in memory with zero setup, or against Supabase the moment you add keys.",
    },
    {
      title: "Show",
      body: "Styled list, loading skeletons, empty and error states already handled.",
    },
  ],
} as const;

export type Project = typeof project;
