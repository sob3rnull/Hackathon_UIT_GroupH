import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { keywordTriage } from "./keyword-triage";
import { conditions, specialtyFor, triageSchema, type Condition } from "./types";

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

// The training set labels more conditions than the app's runtime enum — those
// rows exist for a future model and are carried as free-form strings here.
const trainingRowSchema = z.object({
  id: z.string().min(1),
  language: z.literal("my"),
  input_modality: z.literal("speech_transcript"),
  text: z.string().min(1),
  clauses: z.array(clauseSchema).min(1),
  triage: triageSchema.extend({ condition: z.string().min(1) }),
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

const runtimeConditions = new Set<string>(conditions);

describe("Burmese patient-situation seed data", () => {
  it("keeps every JSONL row in the training schema", () => {
    const rows = trainingRows();

    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });

  it("is understood by the local keyword fallback", () => {
    // Only rows the fallback can express are checked against it: the
    // condition must be in the runtime enum and the labelled specialty must
    // match the fixed condition→specialty mapping (the fallback derives one
    // from the other). The rest wait for the trained model.
    const rows = trainingRows().filter(
      (row) =>
        runtimeConditions.has(row.triage.condition) &&
        row.triage.requiredSpecialty ===
          specialtyFor[row.triage.condition as Condition],
    );
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      const triage = keywordTriage(row.text);

      // The refined taxonomy may name a more specific sub-condition than the
      // seed's generic label (e.g. "arrhythmia" for a note labelled "cardiac").
      // That's fine — what matters for routing is that it maps to the same
      // specialty as the labelled condition.
      expect(specialtyFor[triage.condition], row.id).toBe(
        specialtyFor[row.triage.condition as Condition],
      );
      expect(triage.severity, row.id).toBe(row.triage.severity);
      expect(triage.requiredSpecialty, row.id).toBe(row.triage.requiredSpecialty);
      expect(triage.needsICU, row.id).toBe(row.triage.needsICU);
    }
  });
});
