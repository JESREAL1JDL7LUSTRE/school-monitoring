"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Employee } from "./database";
import { EmployeePhoto } from "./employee-photo";
import { Field } from "./ui";

export function PhotoPicker({ employee }: { employee?: Pick<Employee, "id" | "full_name" | "photo_id"> }) {
  const [preview, setPreview] = useState("");
  const [remove, setRemove] = useState(false);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const avatar = employee
    ? <EmployeePhoto employee={remove ? { ...employee, photo_id: null } : employee} size={80} />
    : <UserRound aria-hidden className="size-8" />;
  return <div className="flex flex-wrap items-center gap-4">
    <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-muted-foreground">
      {preview && !remove ? <Image src={preview} alt="Selected employee photo" unoptimized width={80} height={80} className="size-full object-cover" />
        : avatar}
    </div>
    <div className="min-w-0 flex-1 space-y-2">
      <Field label={employee ? "Profile photo" : "Employee photo (optional)"}>
        <Input variant="touch" name="photo" type="file" disabled={remove} accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            const tooLarge = Boolean(file && file.size > 4 * 1024 * 1024);
            event.currentTarget.setCustomValidity(tooLarge ? "Choose a photo of 4 MB or less." : "");
            if (tooLarge) event.currentTarget.reportValidity();
            setPreview(file && !tooLarge ? URL.createObjectURL(file) : "");
          }} />
      </Field>
      <p className="text-xs text-muted-foreground">JPEG, PNG or WebP up to 4 MB.</p>
      {employee?.photo_id && <label className="flex min-h-9 w-fit items-center gap-2 text-sm">
        <input type="checkbox" name="remove_photo" className="size-4 accent-primary"
          checked={remove} onChange={(event) => setRemove(event.target.checked)} />
        Remove current photo
      </label>}
    </div>
  </div>;
}
