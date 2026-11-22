import Link from "next/link";
import { Button } from "@/components/ui/button";
import { hasPermission, requirePermission } from "@/modules/auth/session";
import { readSettingsSection } from "@/modules/settings/fields";
import { getSchoolLogoUrl, getSchoolSettings } from "@/modules/settings/queries";
import { SettingsForm } from "./settings-form";
import { SettingsNavigation } from "./settings-navigation";

const SettingsPage = async ({ searchParams }: PageProps<"/settings">) => {
  const [session, settings, params] = await Promise.all([requirePermission("settings.read"), getSchoolSettings(), searchParams]);
  const section = readSettingsSection(params.section);
  const logoUrl = section === "identity" ? await getSchoolLogoUrl(settings.logo_path) : null;
  const canEdit = hasPermission(session, "settings.write");
  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="desk-heading">School settings</h1>
        {canEdit && <Button variant="outline" asChild><Link href="/settings/access">Manage staff access</Link></Button>}
      </header>
      <SettingsNavigation active={section} />
      <SettingsForm key={section} section={section} settings={settings} logoUrl={logoUrl} canEdit={canEdit} />
    </div>
  );
};

export default SettingsPage;
