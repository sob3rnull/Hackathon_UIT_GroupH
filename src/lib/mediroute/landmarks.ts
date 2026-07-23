/**
 * Yangon landmark gazetteer.
 *
 * The location-extraction flow (POST /api/locate) asks Claude to name a
 * landmark from a dispatcher's note — it never lets the model emit
 * coordinates. The coordinates come from HERE, from a hand-checked list, so a
 * hallucinated lat/lng can never reach the map. A landmark the model names but
 * that isn't in this list resolves to nothing, and the dispatcher is asked to
 * click the map instead.
 *
 * Coordinates are approximate centre points, good enough to drop an incident
 * pin the dispatcher then drags to the exact spot.
 */

export interface Landmark {
  /** Canonical English name, shown to the dispatcher once resolved. */
  name: string;
  /** Other spellings and the Burmese name, all matched case-insensitively. */
  aliases: string[];
  lat: number;
  lng: number;
}

export const LANDMARKS: Landmark[] = [
  {
    name: "Myanmar Plaza",
    aliases: ["myanmar plaza", "mm plaza", "မြန်မာပလာဇာ"],
    lat: 16.8409,
    lng: 96.1513,
  },
  {
    name: "Sule Pagoda",
    aliases: ["sule", "sule paya", "ဆူးလေဘုရား", "ဆူးလေ"],
    lat: 16.776,
    lng: 96.1588,
  },
  {
    name: "Junction City",
    aliases: ["junction city", "ဂျန်ရှင်းစီးတီး"],
    lat: 16.7797,
    lng: 96.156,
  },
  {
    name: "Shwedagon Pagoda",
    aliases: ["shwedagon", "shwe dagon", "shwedagon paya", "ရွှေတိဂုံဘုရား", "ရွှေတိဂုံ"],
    lat: 16.7983,
    lng: 96.1497,
  },
  {
    name: "Yangon Central Railway Station",
    aliases: [
      "central railway station",
      "yangon railway station",
      "central station",
      "railway station",
      "ဘူတာကြီး",
      "ရန်ကုန်ဘူတာ",
    ],
    lat: 16.792,
    lng: 96.152,
  },
  {
    name: "Hledan Junction",
    aliases: ["hledan", "hledan centre", "hledan center", "လှည်းတန်း"],
    lat: 16.8258,
    lng: 96.132,
  },
  {
    name: "Inya Lake",
    aliases: ["inya", "inya lake", "အင်းယားကန်", "အင်းယား"],
    lat: 16.83,
    lng: 96.16,
  },
  {
    name: "People's Park",
    aliases: ["peoples park", "people's park", "ပြည်သူ့ဥယျာဉ်"],
    lat: 16.793,
    lng: 96.143,
  },
  {
    name: "Yangon International Airport",
    aliases: [
      "airport",
      "yangon airport",
      "mingaladon airport",
      "rgn",
      "လေဆိပ်",
      "ရန်ကုန်လေဆိပ်",
    ],
    lat: 16.9073,
    lng: 96.1332,
  },
  {
    name: "Thingangyun",
    aliases: ["thingangyun", "thingan gyun", "သင်္ဃန်းကျွန်း"],
    lat: 16.82,
    lng: 96.19,
  },
  {
    name: "Insein",
    aliases: ["insein", "အင်းစိန်"],
    lat: 16.88,
    lng: 96.105,
  },
  {
    name: "Bahan",
    aliases: ["bahan", "ဗဟန်း"],
    lat: 16.81,
    lng: 96.15,
  },
  {
    name: "Kamayut",
    aliases: ["kamayut", "kamaryut", "ကမာရွတ်"],
    lat: 16.825,
    lng: 96.135,
  },
  {
    name: "University of Information Technology",
    aliases: [
      "uit",
      "university of information technology",
      "ယူအိုင်တီ",
      "သတင်းအချက်အလက်နည်းပညာတက္ကသိုလ်",
    ],
    lat: 16.8561,
    lng: 96.1353,
  },
  {
    name: "Sanchaung",
    aliases: ["sanchaung", "san chaung", "စမ်းချောင်း"],
    lat: 16.815,
    lng: 96.13,
  },
  {
    name: "Kandawgyi Lake",
    aliases: ["kandawgyi", "kandawgyi lake", "ကန်တော်ကြီး"],
    lat: 16.79,
    lng: 96.16,
  },
  {
    name: "Bogyoke Aung San Market",
    aliases: [
      "bogyoke market",
      "bogyoke aung san market",
      "scott market",
      "ဗိုလ်ချုပ်ဈေး",
      "ဗိုလ်ချုပ်အောင်ဆန်းဈေး",
    ],
    lat: 16.7797,
    lng: 96.1553,
  },
  {
    name: "Yangon General Hospital",
    aliases: ["yangon general hospital", "ygh", "general hospital", "ဆေးရုံကြီး"],
    lat: 16.7817,
    lng: 96.149,
  },
  {
    name: "Chinatown",
    aliases: ["chinatown", "lanmadaw", "လမ်းမတော်", "တရုတ်တန်း"],
    lat: 16.774,
    lng: 96.145,
  },
  {
    name: "Downtown Yangon",
    aliases: ["downtown", "kyauktada", "ကျောက်တံတား", "မြို့ထဲ"],
    lat: 16.7785,
    lng: 96.1583,
  },
  {
    name: "Tamwe",
    aliases: ["tamwe", "tamwae", "တာမွေ"],
    lat: 16.805,
    lng: 96.165,
  },
  {
    name: "Yankin",
    aliases: ["yankin", "ရန်ကင်း"],
    lat: 16.835,
    lng: 96.165,
  },
  {
    name: "North Okkalapa",
    aliases: ["north okkalapa", "မြောက်ဥက္ကလာ", "မြောက်ဥက္ကလာပ"],
    lat: 16.89,
    lng: 96.165,
  },
  {
    name: "South Okkalapa",
    aliases: ["south okkalapa", "တောင်ဥက္ကလာ", "တောင်ဥက္ကလာပ"],
    lat: 16.85,
    lng: 96.17,
  },
  {
    name: "Mayangone",
    aliases: ["mayangone", "mayangon", "မရမ်းကုန်း"],
    lat: 16.86,
    lng: 96.14,
  },
  {
    name: "Mingaladon",
    aliases: ["mingaladon", "မင်္ဂလာဒုံ"],
    lat: 16.91,
    lng: 96.13,
  },
  {
    name: "Pyay Road",
    aliases: ["pyay road", "pyay rd", "prome road", "ပြည်လမ်း"],
    lat: 16.82,
    lng: 96.135,
  },
];

/** Lowercase, collapse whitespace, drop punctuation that varies between spellings. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,'’`"()\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve a landmark name (as Claude returned it) to a gazetteer entry.
 * Case-insensitive and forgiving: an exact-ish match on the canonical name or
 * any alias, then a looser substring match either direction so "near Sule
 * Pagoda" still finds "Sule". Returns null when nothing matches — the caller
 * treats that as "couldn't infer, click the map".
 */
export function resolveLandmark(input: string | null | undefined): Landmark | null {
  if (!input) return null;
  const query = normalize(input);
  if (!query) return null;

  const candidates: { landmark: Landmark; term: string }[] = [];
  for (const landmark of LANDMARKS) {
    candidates.push({ landmark, term: normalize(landmark.name) });
    for (const alias of landmark.aliases) {
      candidates.push({ landmark, term: normalize(alias) });
    }
  }

  // Exact match wins.
  for (const { landmark, term } of candidates) {
    if (term && term === query) return landmark;
  }

  // Then the longest term that appears inside the query (or vice versa), so a
  // more specific landmark beats a shorter substring of it.
  let best: Landmark | null = null;
  let bestLen = 0;
  for (const { landmark, term } of candidates) {
    if (!term || term.length < 3) continue;
    if (query.includes(term) || term.includes(query)) {
      if (term.length > bestLen) {
        best = landmark;
        bestLen = term.length;
      }
    }
  }
  return best;
}
