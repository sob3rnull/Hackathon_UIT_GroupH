import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { keywordTriage } from "./keyword-triage";
import { triageSchema } from "./types";

const clauseSchema = z.object({
  text: z.string().min(1),
  kind: z.enum([
    "context",
    "injury",
    "mechanism",
    "red_flag",
    "stability",
    "symptom",
    "vital_sign",
  ]),
});

const trainingRowSchema = z.object({
  id: z.string().min(1),
  language: z.literal("my"),
  input_modality: z.literal("speech_transcript"),
  text: z.string().min(1),
  clauses: z.array(clauseSchema).min(1),
  triage: triageSchema,
});

const TRAINING_PATH = join(
  process.cwd(),
  "training",
  "burmese-patient-situations.jsonl",
);

function trainingRows() {
  return readFileSync(TRAINING_PATH, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => trainingRowSchema.parse(JSON.parse(line)));
}

describe("Burmese patient-situation seed data", () => {
  it("keeps every JSONL row in the training schema", () => {
    const rows = trainingRows();

    expect(rows).toHaveLength(7);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });

  it("is understood by the local keyword fallback", () => {
    for (const row of trainingRows()) {
      const triage = keywordTriage(row.text);

      expect(triage.condition, row.id).toBe(row.triage.condition);
      expect(triage.severity, row.id).toBe(row.triage.severity);
      expect(triage.requiredSpecialty, row.id).toBe(row.triage.requiredSpecialty);
      expect(triage.needsICU, row.id).toBe(row.triage.needsICU);
    }
  });
});
