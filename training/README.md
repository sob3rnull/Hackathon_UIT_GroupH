# Burmese Patient Situation Training Data

This folder is the seed for training or evaluating Burmese patient-situation
understanding from speech-to-text input.

Each `.jsonl` row is one de-identified call-note transcript. Keep real patient
names, phone numbers, addresses, and IDs out of this file.

## Row Shape

```json
{
  "id": "mm-cardiac-critical-001",
  "language": "my",
  "input_modality": "speech_transcript",
  "text": "အသက် ၅၅ နှစ် အမျိုးသား ရင်ဘတ်အောင့် ချွေးထွက် သွေးပေါင် 80/50",
  "clauses": [
    { "text": "ရင်ဘတ်အောင့်", "kind": "symptom" },
    { "text": "သွေးပေါင် 80/50", "kind": "vital_sign" }
  ],
  "triage": {
    "condition": "cardiac",
    "severity": "critical",
    "requiredSpecialty": "cardiology",
    "needsICU": true,
    "redFlags": ["ရင်ဘတ်အောင့်", "သွေးပေါင် 80/50"],
    "confidence": 0.9
  }
}
```

## Label Guidance

- `condition` must be one of the app categories: `cardiac`, `trauma`,
  `stroke`, `burn`, `obstetric`, `paediatric`, or `general`.
- `severity` is `critical`, `urgent`, or `stable`.
- `clauses` should mark the Burmese phrase that drove the label, not a cleaned
  translation. This keeps model behavior traceable to what the caller said.
- `redFlags` should be short clinical evidence that a dispatcher can audit.
- Use this only for decision support. A trained dispatcher remains responsible
  for reviewing and correcting every result.

When the dataset grows beyond the seed file, split it into reviewed
`train.jsonl`, `validation.jsonl`, and `test.jsonl` files with no duplicate
incidents across splits.
