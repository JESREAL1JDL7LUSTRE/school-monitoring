import type { ReactNode } from "react";
import Image from "next/image";
import { InventoryBackButton } from "./back-button";
import { InventoryPrintButton } from "./print-controls";
import { getSchoolLogoUrl } from "@/modules/settings/queries";
import type { InventorySnapshot } from "./snapshot";

export const InventoryPrintSheet = async ({ title, school, details, children, signature = "inventory", controls, inventoryBack = "/inventory" }: {
  title: string;
  school: InventorySnapshot["school"];
  details?: string;
  children: ReactNode;
  signature?: "inventory" | "custody" | "none";
  controls?: ReactNode;
  inventoryBack?: string;
}) => {
  const logo = await getSchoolLogoUrl(school.logo_path);
  const signatures = signature === "custody" ? [
    [school.administrative_officer, "Property custodian"], [school.school_head, "School head"],
  ] : [
    [school.administrative_officer, "Property custodian"], [school.inventory_chair, "Inventory committee chair"],
    [school.school_head, "School head"], [school.coa_auditor, "COA auditor"],
  ];
  return (
    <div className="space-y-4 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <InventoryBackButton href={inventoryBack} />
        <InventoryPrintButton />
      </div>
      {controls && <div className="print:hidden">{controls}</div>}
      <article className="mx-auto max-w-5xl space-y-6 rounded-2xl border bg-card px-4 py-7 sm:px-8 print:max-w-none print:rounded-none print:border-0 print:p-0 print:text-black print:[&_[data-slot=table-container]]:overflow-visible print:[&_td]:whitespace-normal print:[&_th]:whitespace-normal print:[&_table]:text-xs print:[&_tr]:break-inside-avoid">
        <header className="space-y-2 text-center">
          {logo && <Image src={logo} alt="School logo" className="mx-auto size-16 object-contain" width={64} height={64} unoptimized />}
          <div className="text-sm">
            <p>Republic of the Philippines</p>
            <p className="font-semibold">Department of Education</p>
            <p>{[school.region, school.division].filter(Boolean).join(" · ")}</p>
            <p className="font-semibold">{school.school_name}</p>
            {school.school_code && <p>School ID {school.school_code}</p>}
          </div>
          <p className="text-xs font-semibold tracking-wide uppercase">Draft · Verify before official use</p>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight">{title}</h1>
          {details && <p className="text-sm">{details}</p>}
        </header>
        {children}
        {signature !== "none" && <div className="grid break-inside-avoid grid-cols-2 gap-5 pt-7 text-center text-sm sm:grid-cols-4 print:grid-cols-4">
          {signatures.map(([name, role]) => <div key={role}><p className="border-b pb-1 font-semibold">{name || "\u00a0"}</p><p>{role}</p></div>)}
        </div>}
      </article>
    </div>
  );
};
