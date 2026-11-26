import { RecordEditDialog } from "@/components/record-editor";
import { PhotoPicker } from "./photo-picker";
import type { Employee } from "./database";
import { PersonnelForm } from "./form";
import { saveEmployeePhoto } from "./photo-actions";
import { EmployeePhoto } from "./employee-photo";

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
            <PhotoPicker required />
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
