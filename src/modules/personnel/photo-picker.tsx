"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "./ui";

export function PhotoPicker({ required = false }: { required?: boolean }) {
  const [preview, setPreview] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return <div className="flex flex-wrap items-center gap-4">
    <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-muted-foreground">
      {preview ? <Image src={preview} alt="Selected employee photo" unoptimized width={80} height={80} className="size-full object-cover" />
        : <UserRound aria-hidden className="size-8" />}
    </div>
    <div className="min-w-0 flex-1 space-y-1">
      <Field label={required ? "Profile photo" : "Employee photo (optional)"}>
        <Input variant="touch" name="photo" type="file" required={required} accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            const tooLarge = Boolean(file && file.size > 4 * 1024 * 1024);
            event.currentTarget.setCustomValidity(tooLarge ? "Choose a photo of 4 MB or less." : "");
            if (tooLarge) event.currentTarget.reportValidity();
            setPreview(file && !tooLarge ? URL.createObjectURL(file) : "");
          }} />
      </Field>
      <p className="text-xs text-muted-foreground">JPEG, PNG or WebP up to 4 MB.</p>
    </div>
  </div>;
}
