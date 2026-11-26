import Image from "next/image";
import Link from "next/link";
import { RecordEditDialog } from "@/components/record-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { formatPersonnelDate } from "@/modules/personnel/rules";
import { numberFields, readSettingsSection, settingsSections, signatoryFields, textFields, type SettingsSection } from "@/modules/settings/fields";
import { getSchoolLogoUrl, getSchoolSettings } from "@/modules/settings/queries";
import type { SchoolSettings } from "@/types/database";
import { SettingsForm } from "./settings-form";
import { SettingsNavigation } from "./settings-navigation";

const settingNumber = new Intl.NumberFormat("en-PH");

function SettingsValues({ section, settings, logoUrl }: {
  section: SettingsSection;
  settings: SchoolSettings;
  logoUrl: string | null;
}) {
  const fields = section === "identity" ? textFields : section === "signatories" ? signatoryFields : numberFields;
  return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2" data-settings-values>
    {section === "rules" && <div>
      <dt className="text-sm text-muted-foreground">Reference date</dt>
      <dd className="font-medium">{settings.reference_date ? formatPersonnelDate(settings.reference_date) : "Today in the Philippines"}</dd>
    </div>}
    {fields.map(([name, label]) => {
      const value = settings[name];
      return <div key={name} className="min-w-0">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="wrap-anywhere font-medium tabular-nums">
          {typeof value === "number" ? (name === "reporting_year" ? value : settingNumber.format(value))
            : value || (name === "reporting_year" ? "From the reference date" : "—")}
        </dd>
      </div>;
    })}
    {section === "identity" && logoUrl && <div className="space-y-2">
      <dt className="text-sm text-muted-foreground">School logo</dt>
      <dd><Image src={logoUrl} alt="School logo" width={72} height={72} unoptimized className="size-18 object-contain" /></dd>
    </div>}
  </dl>;
}

const SettingsPage = async ({ searchParams }: PageProps<"/settings">) => {
  const [session, settings, params] = await Promise.all([requirePermission("settings.read"), getSchoolSettings(), searchParams]);
  const section = readSettingsSection(params.section);
  const logoUrl = section === "identity" ? await getSchoolLogoUrl(settings.logo_path) : null;
  const canEdit = hasPermission(session, "settings.write");
  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="desk-heading">School settings</h1>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Button variant="outline" asChild><Link href="/settings/access">Manage staff access</Link></Button>}
          <Button variant="outline" asChild><Link href="/reset-password">Change password</Link></Button>
        </div>
      </header>
      <Card className="gap-0 py-0">
        <div className="px-4 sm:px-6">
          <SettingsNavigation active={section} />
        </div>
        <CardContent className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="desk-section-heading">{settingsSections[section]}</h2>
            {canEdit && <RecordEditDialog key={section} trigger="Edit settings" title={`Edit ${settingsSections[section].toLowerCase()}`}
              description="Review the changes before saving them for the school." wide>
              <SettingsForm section={section} settings={settings} logoUrl={logoUrl} />
            </RecordEditDialog>}
          </div>
          {!canEdit && <p className="text-sm text-muted-foreground">Only administrators can edit school settings.</p>}
          {section === "rules" && <p className="text-sm text-muted-foreground">These values are draft assumptions. Verify them before relying on dates, salary estimates, or property classifications.</p>}
          <SettingsValues section={section} settings={settings} logoUrl={logoUrl} />
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
