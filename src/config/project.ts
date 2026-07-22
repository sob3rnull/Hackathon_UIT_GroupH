/**
 * Product-level copy in one place. Change it here and the header, tab title,
 * hero and landing cards all follow.
 */
export const project = {
  name: "MediRoute",

  tagline:
    "Routes ambulances to the hospital that can actually treat the patient — not just the closest one.",

  pitch:
    "Emergency routing today optimizes for distance alone, so ambulances arrive to find no beds, no specialist on duty, or an overloaded ER. MediRoute reads the paramedic's own words, extracts structured triage, and ranks hospitals on live capacity plus travel time — showing its reasoning every step, with a dispatcher override always one click away.",

  team: "Group H · UIT",

  entity: {
    singular: "Dispatch",
    plural: "Dispatches",
    singularLower: "dispatch",
    pluralLower: "dispatches",
  },

  nav: [
    { href: "/", label: "Dispatcher" },
    { href: "/fleet", label: "Fleet" },
    { href: "/hospital", label: "Hospital panel" },
  ],

  highlights: [
    {
      title: "Hears the call",
      body: "The 119 dispatcher dictates or types what the caller reports. Claude extracts condition, severity and required specialty, and shows the findings that drove the call.",
    },
    {
      title: "Sends the right vehicle",
      body: "Certified ambulances report GPS from an on-board IoT unit. The nearest available one is assigned — an uncertified vehicle is never dispatchable, however close it is.",
    },
    {
      title: "Picks a hospital that can treat",
      body: "Hard-filters hospitals that cannot take this patient, then ranks the rest on live capacity and travel time. Every recommendation shows its reasoning and can be overridden.",
    },
  ],
} as const;

export type Project = typeof project;
