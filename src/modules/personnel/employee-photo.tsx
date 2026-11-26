import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Employee } from "./database";
import { employeePhotoUrl } from "./photo-storage";

export function EmployeePhoto({ employee, size }: {
  employee: Pick<Employee, "id" | "full_name" | "photo_id">;
  size: 36 | 80;
}) {
  const parts = employee.full_name.trim().split(/\s+/);
  const initials = [parts[0], parts.length > 1 ? parts.at(-1) : undefined]
    .map((part) => part ? Array.from(part)[0] : "").join("").toLocaleUpperCase();
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground",
      size === 80 ? "size-20 text-xl" : "size-9 text-xs")} aria-hidden="true">
      {initials}
      {employee.photo_id && <Image src={employeePhotoUrl(employee.id, employee.photo_id)} alt="" width={size} height={size}
        unoptimized className="absolute inset-0 size-full object-cover" loading={size === 80 ? "eager" : "lazy"} />}
    </span>
  );
}
