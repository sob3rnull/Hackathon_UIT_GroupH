"use client";

import { Ambulance, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/states";
import { VoiceInput } from "@/components/mediroute/voice-input";

/**
 * Step one of the run: what the caller said. Dictation and typing write to the
 * same field, so triage cannot tell them apart — only the stored input_mode
 * records which was used.
 */
export function IntakePanel({
  note,
  onNoteChange,
  onModeChange,
  onRunTriage,
  triaging,
  aiAvailable,
}: {
  note: string;
  onNoteChange: (note: string) => void;
  onModeChange: (mode: "text" | "voice") => void;
  onRunTriage: () => void;
  triaging: boolean;
  aiAvailable: boolean | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ambulance className="size-4 text-danger" />
          119 call intake
        </CardTitle>
        <CardDescription>
          Dictate or type what the caller reports. Click the map below to set
          the incident location.
        </CardDescription>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        <VoiceInput
          disabled={triaging}
          onListeningChange={(listening) => {
            if (listening) {
              onNoteChange("");
              onModeChange("voice");
            }
          }}
          onTranscript={onNoteChange}
        />

        <Field label="Patient description" htmlFor="note">
          <Textarea
            id="note"
            value={note}
            onChange={(event) => {
              onNoteChange(event.target.value);
              onModeChange("text");
            }}
            rows={4}
            placeholder="e.g. 30F, motorcycle collision, open tibia fracture, alert"
          />
        </Field>

        <Button onClick={onRunTriage} disabled={triaging || note.trim().length < 3}>
          {triaging ? <Spinner /> : <Sparkles className="size-4" />}
          {triaging ? "Triaging…" : "Run triage"}
        </Button>

        {aiAvailable === false ? (
          <p className="text-xs text-warning">
            No <code>ANTHROPIC_API_KEY</code> set — using the keyword fallback.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
