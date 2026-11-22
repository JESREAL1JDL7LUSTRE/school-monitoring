"use client";

import { useActionState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitDraft, type DraftResult } from "./actions";
import type { Template } from "./catalog";
import { DocumentPaper } from "./paper";
import { PrintButton } from "./print-button";

type EmployeeOption = { id: string; label: string };
type DraftValues = { employee: string; issuedOn: string; fields: Record<string, string> };

export function DraftForm({ template, employees, selectedEmployee, defaultDate, canSave }: {
  template: Template; employees: EmployeeOption[]; selectedEmployee: string; defaultDate: string; canSave: boolean;
}) {
  const [result, action, pending] = useActionState(submitDraft.bind(null, template.slug), {} as DraftResult);
  const { control, setValue } = useForm<DraftValues>({ defaultValues: {
    employee: selectedEmployee,
    issuedOn: defaultDate,
    fields: template.slug === "certificate-of-employment" ? { purpose: "employment verification" } : {},
  } });
  const { employee, issuedOn, fields } = useWatch({ control });
  const draft = result.draft;
  const hasPreview = draft && draft.issuedOn === issuedOn && (result.employeeId ?? "") === employee && template.fields.every(({ name }) =>
    (draft.parameters[name] ?? "") === (fields?.[name] ?? "").trim());

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.3fr)] print:block">
      <Card className="print:hidden">
        <CardHeader><CardTitle>Draft details</CardTitle></CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            {result.error && <Alert variant="destructive" role="alert"><AlertDescription>{result.error}</AlertDescription></Alert>}
            {template.employee && <div className="grid gap-2">
              <Label htmlFor="draft-employee">Employee</Label>
              <Combobox items={employees} value={employees.find(({ id }) => id === employee) ?? null}
                itemToStringLabel={(entry) => entry.label} itemToStringValue={(entry) => entry.id}
                onValueChange={(entry) => setValue("employee", entry?.id ?? "")} name="employee" required>
                <ComboboxInput id="draft-employee" className="h-11 w-full" placeholder="Search by name or employee ID" />
                <ComboboxContent>
                  <ComboboxEmpty>No employees found.</ComboboxEmpty>
                  <ComboboxList>{(entry: EmployeeOption) => <ComboboxItem key={entry.id} value={entry} className="min-h-11">{entry.label}</ComboboxItem>}</ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>}
            <div className="grid gap-2">
              <Label htmlFor="draft-date">Date issued</Label>
              <Input id="draft-date" type="date" name="issuedOn" className="h-11" value={issuedOn} onChange={(event) => setValue("issuedOn", event.target.value)} required />
            </div>
            {template.fields.map((field) => {
              const props = {
                id: `draft-${field.name}`, name: field.name, required: !field.optional, maxLength: 2000,
                value: fields?.[field.name] ?? "", onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(`fields.${field.name}`, event.target.value),
              };
              return <div key={field.name} className="grid gap-2">
                <Label htmlFor={props.id}>{field.label}</Label>
                {field.type === "textarea" ? <Textarea {...props} /> : <Input {...props} className="h-11" type={field.type ?? "text"} min={field.type === "number" ? 0 : undefined} step={field.type === "number" ? "0.01" : undefined} />}
              </div>;
            })}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" name="intent" value="preview" variant={canSave ? "outline" : "default"} disabled={pending}>Preview draft</Button>
              {canSave && <Button type="submit" name="intent" value="save" disabled={pending}>Save draft</Button>}
            </div>
            {pending && <p role="status" className="text-sm text-muted-foreground">Preparing document…</p>}
          </form>
        </CardContent>
      </Card>
      {hasPreview ? <div className="min-w-0 space-y-3">
        <div className="print:hidden"><PrintButton>Print preview</PrintButton></div>
        <DocumentPaper title={template.title} version={template.version} snapshot={draft} logoUrl={result.logoUrl} preview />
      </div> : <Card className="min-h-32 print:hidden"><CardContent className="text-muted-foreground">Complete the fields and select Preview draft to review the document.</CardContent></Card>}
    </div>
  );
}
