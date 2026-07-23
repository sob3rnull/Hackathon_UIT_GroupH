/**
 * Product-level copy in one place. Change it here and the header, tab title,
 * hero and landing cards all follow.
 */
export const project = {
  name: "WheeYaw",

  category: "Health Emergency",

  flowCategory: {
    label: "Speech-to-text analysis",
    body: "Voice from the 119 call is transcribed into the patient note, then analyzed into structured triage fields.",
  },

  tagline:
    "Routes ambulances to the hospital that can actually treat the patient — not just the closest one.",

  pitch:
    "Emergency routing today optimizes for distance alone, so ambulances arrive to find no beds, no specialist on duty, or an overloaded ER. WheeYaw sends the nearest ambulance the moment a call comes in, then turns the crew's own words — spoken or typed — into structured triage and ranks hospitals on live capacity plus travel time, showing its reasoning every step, with a human override always one click away.",

  team: "Group H · UIT",

  entity: {
    singular: "Dispatch",
    plural: "Dispatches",
    singularLower: "dispatch",
    pluralLower: "dispatches",
  },

  /**
   * One screen per role. Auth has landed: middleware + RLS gate each of these
   * by the signed-in user's role. In memory mode (no Supabase) the gate is off
   * and the route is reachable directly, which is what keeps the offline demo
   * working.
   */
  nav: [
    {
      href: "/dispatcher",
      label: "Dispatcher",
      role: "119 call taker",
      blurb: "Take the call and send the nearest dispatchable ambulance.",
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
      blurb: "Run triage, pick the hospital, advance status as the run progresses.",
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
      title: "Sends the right vehicle, fast",
      body: "The 119 dispatcher logs the call and the incident location — that's all selecting a vehicle needs. Certified ambulances report GPS from an on-board IoT unit; the nearest available one is assigned, an uncertified vehicle never is, however close it is.",
    },
    {
      title: "Triages where it matters",
      body: "The crew dictates or types what they're seeing, right on their own tablet. Claude extracts condition, severity and required specialty, and shows the findings that drove the call.",
    },
    {
      title: "Picks a hospital that can treat",
      body: "Hard-filters hospitals that cannot take this patient, then ranks the rest on live capacity and travel time. Every recommendation shows its reasoning and can be overridden.",
    },
  ],
} as const;

export type Project = typeof project;
