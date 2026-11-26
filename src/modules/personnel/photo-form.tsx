import { RecordEditDialog } from "@/components/record-editor";
import { Input } from "@/components/ui/input";
import type { Employee } from "./database";
import { PersonnelForm } from "./form";
import { saveEmployeePhoto } from "./photo-actions";
import { EmployeePhoto } from "./employee-photo";
import { Field } from "./ui";

export function ProfilePhoto({ employee, canEdit }: { employee: Employee; canEdit: boolean }) {
  const record = <>
    <input type="hidden" name="employee_id" value={employee.id} />
    <input type="hidden" name="version" value={employee.updated_at} />
  </>;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <EmployeePhoto employee={employee} size={80} />
      {canEdit && <div className="flex flex-wrap items-start gap-2 print:hidden">
        <RecordEditDialog trigger={employee.photo_id ? "Replace photo" : "Add photo"} description="Choose a JPEG, PNG, or WebP image up to 4 MB.">
          <PersonnelForm action={saveEmployeePhoto} submit="Save photo">
            {record}
            <input type="hidden" name="operation" value="upload" />
            <Field label="Profile photo"><Input variant="touch" type="file" name="photo" accept="image/jpeg,image/png,image/webp" required /></Field>
          </PersonnelForm>
        </RecordEditDialog>
        {employee.photo_id && <PersonnelForm action={saveEmployeePhoto} submit="Remove photo" submitVariant="ghost"
          confirmation={{ title: "Remove this photo?", description: "The employee profile will show initials.", label: "Remove photo", destructive: true }}>
          {record}
          <input type="hidden" name="operation" value="remove" />
        </PersonnelForm>}
      </div>}
    </div>
  );
}
