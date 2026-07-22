"use client";

import { Ambulance, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/states";

/**
 * The whole of the call-taking step: where the incident is, plus an
 * optional short note. No triage happens here, and no note is required —
 * selectAmbulance() only needs the incident location, so there's nothing to
 * extract before ranking the fleet. The real intake (full description,
 * voice, triage) happens on the crew's own screen once they're assigned.
 */
export function IntakePanel({
  note,
  onNoteChange,
  onFindAmbulances,
  finding,
}: {
  note: string;
  onNoteChange: (note: string) => void;
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
          Click the map below to set the incident location, then find a
          vehicle to send.
        </CardDescription>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        <Field label="Note" htmlFor="note" hint="Optional — not needed to find a vehicle.">
          <Textarea
            id="note"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={3}
            placeholder="e.g. MVA near Pyay Road"
          />
        </Field>

        <Button onClick={onFindAmbulances} disabled={finding} className="self-start">
          {finding ? <Spinner /> : <Search className="size-4" />}
          {finding ? "Finding…" : "Find ambulances"}
        </Button>
      </CardBody>
    </Card>
  );
}
