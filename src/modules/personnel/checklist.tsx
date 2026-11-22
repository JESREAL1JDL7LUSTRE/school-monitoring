import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveChecklist, saveChecklistReview, uploadEmployeeAttachment } from "./document-actions";
import { checklistStatuses } from "./database";
import { PersonnelForm } from "./form";
import type { getEmployeeProfile } from "./queries";
import { formatPersonnelDate } from "./rules";
import { Choices, Field, Status } from "./ui";

export function Checklist({ profile, canEdit, canUpload }: { profile: Awaited<ReturnType<typeof getEmployeeProfile>>; canEdit: boolean; canUpload: boolean }) {
  const { employee, checklist, context } = profile;
  return (
    <Card id="checklist">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle>201 file checklist</CardTitle><CardDescription>{employee.checklist_done} of {employee.checklist_total} complete. N/A counts as reviewed.</CardDescription></div>
          <Button variant="outline" asChild><Link href={`/forms?template=employee-201&employee=${employee.id}`}>Print this 201</Link></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {canEdit ? (
          <PersonnelForm action={saveChecklistReview} submit="Save review">
            <input type="hidden" name="employee_id" value={employee.id} />
            <input type="hidden" name="version" value={employee.updated_at} />
            <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <Field label="Last review date"><Input type="date" name="checklist_review_date" defaultValue={employee.checklist_review_date ?? ""} /></Field>
              <Field label="Missing documents or remarks"><Textarea name="checklist_remarks" defaultValue={employee.checklist_remarks} maxLength={2000} /></Field>
            </div>
          </PersonnelForm>
        ) : <p className="text-sm text-muted-foreground">Last review {formatPersonnelDate(employee.checklist_review_date)} · {employee.checklist_remarks || "No review remarks."}</p>}
        <p className="text-sm text-muted-foreground">Reference date {formatPersonnelDate(context.asOf)}</p>
        <ul className="divide-y rounded-md border px-4">
          {checklist.map((document) => (
            <li key={document.id} className="grid items-start gap-3 py-3 xl:grid-cols-[minmax(0,1fr)_minmax(160px,1fr)_minmax(190px,1fr)]" aria-label={document.name}>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="break-words text-sm font-medium">{document.name}</h3>
                {!canEdit && <Status>{document.entry?.status ?? "Pending"}</Status>}
              </div>
              {canEdit && (
                <PersonnelForm action={saveChecklist} submit="Save status" compact>
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <input type="hidden" name="document_type_id" value={document.id} />
                  <input type="hidden" name="version" value={document.entry?.updated_at ?? ""} />
                  <Choices label={`${document.name} status`} name="status" values={checklistStatuses} value={document.entry?.status ?? "Pending"} />
                </PersonnelForm>
              )}
              <div className="min-w-0">
                {document.attachments.map((attachment) => (
                  <a key={attachment.id} className="block truncate py-2 text-sm font-medium underline underline-offset-4" href={`/api/employee-documents/${attachment.id}`}>{attachment.file_name}</a>
                ))}
                {canUpload && (
                  <details>
                    <summary className="cursor-pointer py-2 text-sm font-medium">Attach file</summary>
                    <PersonnelForm action={uploadEmployeeAttachment} submit="Upload attachment" compact>
                      <input type="hidden" name="employee_id" value={employee.id} />
                      <input type="hidden" name="document_type_id" value={document.id} />
                      <Input type="file" name="file" aria-label={`${document.name} attachment`} accept=".pdf,.png,.jpg,.jpeg" required />
                      <p className="text-xs text-muted-foreground">PDF, PNG, or JPEG up to 10 MB.</p>
                    </PersonnelForm>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
