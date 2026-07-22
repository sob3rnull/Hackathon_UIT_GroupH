"use client";

import { Ambulance, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/states";
import { VoiceInput } from "@/components/mediroute/voice-input";

/**
 * The whole of the call-taking step: what the caller said, and where. No
 * triage happens here — selectAmbulance() only needs the incident location,
 * so there's nothing for the dispatcher to extract before ranking the fleet.
 * Triage runs on the crew's own screen once they're assigned.
 */
export function IntakePanel({
  note,
  onNoteChange,
  onModeChange,
  onFindAmbulances,
  finding,
}: {
  note: string;
  onNoteChange: (note: string) => void;
  onModeChange: (mode: "text" | "voice") => void;
  onFindAmbulances: () => void;
  finding: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ambulance className="size-4 text-danger" />
          119 call intake
        </CardTitle>
        <CardDescription>
          Log what the caller reports. Click the map below to set the
          incident location, then find a vehicle to send.
        </CardDescription>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        <VoiceInput
          disabled={finding}
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

        <Button onClick={onFindAmbulances} disabled={finding || note.trim().length < 3}>
          {finding ? <Spinner /> : <Search className="size-4" />}
          {finding ? "Finding…" : "Find ambulances"}
        </Button>
      </CardBody>
    </Card>
  );
}
