import {
  specialtyFor,
  type Condition,
  type Severity,
  type Triage,
} from "./types";

interface ConditionHint {
  condition: Condition;
  label: string;
  pattern: RegExp;
}

const CONDITION_HINTS: ConditionHint[] = [
  {
    condition: "cardiac",
    label: "cardiac",
    pattern:
      /\b(chest pain|cardiac|heart|mi\b|myocardial|angina|palpitation|arrest)\b|ရင်ဘတ်.*?အောင့်|ရင်ဘတ်နာ|ရင်တုန်|နှလုံး|နှလုံးဖောက်|နှလုံးရပ်/i,
  },
  {
    condition: "stroke",
    label: "stroke",
    pattern:
      /\b(stroke|facial droop|slurred|hemipleg|aphasi|fast test|cva\b|weakness on one side)\b|လေဖြတ်|ပါးရွဲ့|စကားမပြောနိုင်|စကားမပီ|တစ်ဖက်အားနည်း|လက်ခြေမလှုပ်/i,
  },
  {
    condition: "burn",
    label: "burn",
    pattern:
      /\b(burn|scald|fire|flame|thermal)\b|မီးလောင်|ရေနွေးပူ|အပူလောင်|ဆီပူ/i,
  },
  {
    condition: "obstetric",
    label: "obstetric",
    pattern:
      /\b(pregnan|labou?r|contraction|obstetric|delivery|miscarriage|eclamps)\b|ကိုယ်ဝန်|မီးဖွား|ဗိုက်နာ|သားဖွား|ကလေးမွေး|မွေးဖွား|သွေးဆင်း/i,
  },
  {
    condition: "paediatric",
    label: "paediatric",
    pattern:
      /\b(child|infant|baby|toddler|paediatric|pediatric|\b[1-9] ?(year|yr|month)s? old)\b|ကလေး|မွေးကင်းစ|နို့စို့|ကလေးငယ်/i,
  },
  {
    condition: "trauma",
    label: "trauma",
    pattern:
      /\b(trauma|fracture|rta\b|road traffic|accident|fall|stab|gunshot|laceration|collision|crush)\b|ယာဉ်တိုက်|ကားတိုက်|ဆိုင်ကယ်တိုက်|မတော်တဆ|ပြုတ်ကျ|ကျိုး|ဒဏ်ရာ|သွေးထွက်|ဓားထိုး|တိုက်မိ/i,
  },
];

const CRITICAL_HINTS =
  /\b(unconscious|unresponsive|arrest|not breathing|apnoe|gasping|severe|massive|profuse|shock|bp ?[0-8]?[0-9]\/|sats? ?[0-8][0-9]|gcs ?[3-9]\b)\b|သွေးပေါင် ?[0-8]?[0-9]\/|အောက်ဆီဂျင် ?[0-8][0-9]|သတိလစ်|အသက်မရှူ|အသက်ရှူမရ|အသက်ရှူခက်|အသက်ရှူကြပ်|နှလုံးရပ်|သွေးအများကြီး|သွေးထွက်များ|ရှော့ခ်|မတုံ့ပြန်|မေ့မြော|အောက်ဆီဂျင်နည်း|ဖိညှစ်/i;

const STABLE_HINTS =
  /\b(mild|minor|stable|alert|walking|superficial|no distress)\b|အနည်းငယ်|မပြင်းထန်|တည်ငြိမ်|သတိရှိ|လမ်းလျှောက်နိုင်/i;

const ICU_HINTS =
  /\b(unconscious|unresponsive|arrest|intubat|ventilat|shock|severe|gcs|sats? ?[0-8][0-9]|major)\b|သွေးပေါင် ?[0-8]?[0-9]\/|အောက်ဆီဂျင် ?[0-8][0-9]|သတိလစ်|အသက်မရှူ|အသက်ရှူမရ|အသက်ရှူကြပ်|နှလုံးရပ်|သွေးအများကြီး|သွေးထွက်များ|ရှော့ခ်|မတုံ့ပြန်|မေ့မြော|အောက်ဆီဂျင်နည်း|ပြင်းထန်|ဖိညှစ်/i;

function specialtyOf(condition: Condition) {
  return specialtyFor[condition] ?? "general";
}

export function keywordTriage(note: string): Triage {
  const conditionHit = CONDITION_HINTS.find((hint) => hint.pattern.test(note));
  const condition = conditionHit?.condition ?? "general";

  let severity: Severity = "urgent";
  if (CRITICAL_HINTS.test(note)) severity = "critical";
  else if (STABLE_HINTS.test(note)) severity = "stable";

  const redFlags: string[] = [];
  const critical = note.match(CRITICAL_HINTS);
  if (critical) redFlags.push(`Matched critical indicator: "${critical[0]}"`);
  if (conditionHit) redFlags.push(`Matched ${conditionHit.label} keywords`);
  if (redFlags.length === 0) redFlags.push("No specific indicators matched");

  return {
    condition,
    severity,
    requiredSpecialty: specialtyOf(condition),
    needsICU: ICU_HINTS.test(note),
    redFlags,
    confidence: conditionHit ? 0.45 : 0.2, // deliberately low - this is not AI
  };
}
