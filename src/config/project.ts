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

  /**
   * One screen per role. There is no sign-in yet, so the route *is* the role —
   * when auth lands, each of these becomes a permission instead of a link.
   */
  nav: [
    {
      href: "/dispatcher",
      label: "Dispatcher",
      role: "119 call taker",
      blurb: "Take the call, run triage, choose the ambulance and the hospital.",
    },
    {
      href: "/hospital",
      label: "Hospital",
      role: "Hospital staff",
      blurb: "Keep beds, ICU and ER queue current so routing stays honest.",
    },
    {
      href: "/ambulance",
      label: "Ambulance",
      role: "Crew on board",
      blurb: "See the mission, the patient and the destination. Advance status.",
    },
    {
      href: "/history",
      label: "History",
      role: "Everyone",
      blurb: "Every past incident, searchable, with what was recommended.",
    },
  ],

  /** Operational tooling — reachable, but kept out of the role menu. */
  secondaryNav: [
    { href: "/fleet", label: "Fleet ops", blurb: "On-board device simulator" },
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
