"use client";

import { Ambulance, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/states";
import { useT } from "@/lib/i18n/context";

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
  const t = useT();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ambulance className="size-4 text-danger" />
          {t("dispatcher.intakeTitle")}
        </CardTitle>
        <CardDescription>{t("dispatcher.intakeDescription")}</CardDescription>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        <Field
          label={t("dispatcher.noteLabel")}
          htmlFor="note"
          hint={t("dispatcher.intakeNoteHint")}
        >
          <Textarea
            id="note"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={3}
            placeholder={t("dispatcher.notePlaceholder")}
          />
        </Field>

        <Button onClick={onFindAmbulances} disabled={finding} className="self-start">
          {finding ? <Spinner /> : <Search className="size-4" />}
          {finding ? t("dispatcher.finding") : t("dispatcher.findAmbulances")}
        </Button>
      </CardBody>
    </Card>
  );
}
