"use client";

import Image from "next/image";
import { EditorCancel, ReviewableForm, useRecordAction } from "@/components/record-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSchoolSettings, type SettingsActionState } from "@/modules/settings/actions";
import { numberFields, settingsSections, signatoryFields, textFields, type SettingsSection } from "@/modules/settings/fields";
import type { SchoolSettings } from "@/types/database";

export const SettingsForm = ({ section, settings, logoUrl }: {
  section: SettingsSection;
  settings: SchoolSettings;
  logoUrl: string | null;
}) => {
  const [state, action, pending] = useRecordAction(saveSchoolSettings.bind(null, section), {} as SettingsActionState, (result) => result.message);
  const value = (key: keyof SchoolSettings) => state.values?.[key] ?? settings[key] ?? "";
  const text = (fields: readonly (readonly [keyof SchoolSettings, string])[]) => fields.map(([name, label]) => (
    <div key={name} className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input variant="touch" name={name} id={name} defaultValue={value(name)} required={name === "school_name"} maxLength={180} />
    </div>
  ));

  return (
    <ReviewableForm action={action} pending={pending} className="space-y-5" confirmation={{
      title: "Save school settings?",
      description: `Apply the updated ${settingsSections[section].toLowerCase()} for the school.`,
      label: "Confirm save",
    }}>
      <input type="hidden" name="updated_at" value={settings.updated_at} />
      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      {state.message && <Alert role="status"><AlertDescription>{state.message}</AlertDescription></Alert>}
      <fieldset disabled={pending} aria-label={settingsSections[section]} className="grid min-w-0 gap-5 sm:grid-cols-2">
        {section === "identity" && <>
          {text(textFields)}
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="logo">School logo</Label>
            {logoUrl && <Image src={logoUrl} alt="School logo" width={72} height={72} unoptimized className="size-18 object-contain" />}
            <Input variant="touch" name="logo" id="logo" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="logo-format" />
            <p id="logo-format" className="text-sm text-muted-foreground">PNG, JPEG or WebP, up to 2 MB.</p>
            {logoUrl && <label className="flex min-h-11 items-center gap-2 text-sm"><input name="remove_logo" type="checkbox" />Remove current logo</label>}
          </div>
        </>}
        {section === "signatories" && text(signatoryFields)}
        {section === "rules" && <>
          <p className="desk-body text-muted-foreground sm:col-span-2">These values are draft assumptions. Verify them before relying on dates, salary estimates, or property classifications.</p>
          <div className="grid gap-2">
            <Label htmlFor="reference_date">Reference date</Label>
            <Input variant="touch" name="reference_date" id="reference_date" type="date" defaultValue={value("reference_date")} aria-describedby="reference-date-description" />
            <p id="reference-date-description" className="text-sm text-muted-foreground">Blank uses today in the Philippines.</p>
          </div>
          {numberFields.map(([name, label, min, max, step]) => (
            <div key={name} className="grid gap-2">
              <Label htmlFor={name}>{label}</Label>
              <Input variant="touch" name={name} id={name} type="number" defaultValue={value(name)} min={min} max={max} step={step} required={name !== "reporting_year"} />
            </div>
          ))}
        </>}
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <EditorCancel disabled={pending} />
        <Button type="submit" disabled={pending} className="min-h-11">{pending ? "Saving…" : "Save settings"}</Button>
      </div>
    </ReviewableForm>
  );
};
