"use client";

import { useId, useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importSpreadsheet, inspectSpreadsheet } from "@/modules/spreadsheet-import/actions";
import { importFields, type ImportKind } from "@/modules/spreadsheet-import/fields";

type Preview = Extract<Awaited<ReturnType<typeof inspectSpreadsheet>>, { headers: string[] }>;

const columnLetter = (index: number): string => {
  const letter = String.fromCharCode(65 + index % 26);
  return index < 26 ? letter : columnLetter(Math.floor(index / 26) - 1) + letter;
};

export function SpreadsheetImportForm({ kind }: { kind: ImportKind }) {
  const id = useId();
  const [preview, setPreview] = useState<Preview>();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [saved, setSaved] = useState<number>();
  const fields = importFields[kind];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError("");
    setIssues([]);
    setSaved(undefined);
    try {
      if (!preview) {
        const result = await inspectSpreadsheet(kind, data);
        if (result.headers) {
          setPreview(result);
          setMapping(result.mapping);
        } else setError(result.error);
      } else {
        const result = await importSpreadsheet(kind, data);
        if (typeof result.saved === "number") {
          setSaved(result.saved);
          setPreview(undefined);
          form.reset();
        } else {
          setError(result.error ?? "Could not import this spreadsheet.");
          setIssues(result.issues ?? []);
        }
      }
    } catch {
      setError("Could not complete the request. Check the destination list before retrying.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="space-y-5">
    <div className="grid max-w-md gap-2">
      <Label htmlFor={id + "-file"}>CSV or Excel file</Label>
      <Input id={id + "-file"} name="file" type="file" accept=".csv,.xlsx" required disabled={pending}
        aria-describedby={id + "-help"} onChange={() => {
          setPreview(undefined);
          setError("");
          setIssues([]);
          setSaved(undefined);
        }} />
      <p id={id + "-help"} className="text-sm text-muted-foreground">
        Use the first sheet in Excel and put headers in row 1. Up to 200 data rows, 100 columns and 2 MB.
      </p>
    </div>
    {preview && <fieldset disabled={pending} className="min-w-0 space-y-3">
      <legend className="text-lg font-semibold">Match columns</legend>
      <p className="text-sm text-muted-foreground">
        {preview.count} data {preview.count === 1 ? "row" : "rows"} found. Review the suggested matches.
      </p>
      <Table>
        <TableHeader><TableRow>
          <TableHead scope="col">Website field</TableHead>
          <TableHead scope="col">Spreadsheet column</TableHead>
          <TableHead scope="col">Sample values</TableHead>
        </TableRow></TableHeader>
        <TableBody>{fields.map(({ key, label, required }) => {
          const value = mapping[key] ?? "";
          const selectId = id + "-" + key;
          return <TableRow key={key}>
            <TableCell><Label htmlFor={selectId}>{label}{required && <span className="text-muted-foreground">(required)</span>}</Label></TableCell>
            <TableCell>
              <NativeSelect id={selectId} name={key} required={required} value={value}
                className="w-full min-w-40 max-w-72" size="touch"
                onChange={(event) => setMapping({ ...mapping, [key]: event.target.value })}>
                <NativeSelectOption value="">{required ? "Choose column" : "Skip field"}</NativeSelectOption>
                {preview.headers.map((header, index) => <NativeSelectOption key={index} value={index}>
                  {columnLetter(index)} · {header || "Untitled column"}
                </NativeSelectOption>)}
              </NativeSelect>
            </TableCell>
            <TableCell className="min-w-32 max-w-72 whitespace-normal wrap-break-word text-muted-foreground">
              {value === "" ? "—" : preview.rows.map(({ number, values }) =>
                <div key={number}><span className="tabular-nums">{number}.</span> {values[Number(value)] || "—"}</div>)}
            </TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
    </fieldset>}
    {error && <Alert variant="destructive">
      <AlertDescription>
        <p>{error}</p>
        {!!issues.length && <ul className="max-h-56 list-disc space-y-1 overflow-auto ps-5">{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
      </AlertDescription>
    </Alert>}
    {saved !== undefined && <p role="status" className="text-sm font-medium">
      {saved} {kind === "employees" ? "employee record" : "inventory item"}{saved === 1 ? "" : "s"} imported.
    </p>}
    <Button type="submit" className="min-h-11" disabled={pending}>
      {pending ? (preview ? "Importing…" : "Reading file…") : preview ? `Import ${preview.count} ${preview.count === 1 ? "record" : "records"}` : "Read spreadsheet"}
    </Button>
  </form>;
}
