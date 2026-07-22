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
    { href: "/hospital", label: "Hospital panel" },
  ],

  highlights: [
    {
      title: "Understands the note",
      body: "Paramedics type in plain language. Claude extracts condition, severity and required specialty, and shows the findings that drove the call.",
    },
    {
      title: "Ranks on live capacity",
      body: "Hard-filters hospitals that cannot treat this patient, then scores the rest on travel time, beds, specialists on duty and ER load.",
    },
    {
      title: "Explains and defers",
      body: "Every recommendation carries its reasoning and score breakdown. The dispatcher can override any of it, and nothing auto-dispatches.",
    },
  ],
} as const;

export type Project = typeof project;
