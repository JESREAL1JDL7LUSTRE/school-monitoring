import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { settingsSections, type SettingsSection } from "@/modules/settings/fields";

export function SettingsNavigation({ active }: { active?: SettingsSection }) {
  return <WorkspaceNavigation label="Settings sections" items={Object.entries(settingsSections).map(([key, label]) => ({
    label,
    href: key === "identity" ? "/settings" : `/settings?section=${key}`,
    active: active === key,
  }))} />;
}
