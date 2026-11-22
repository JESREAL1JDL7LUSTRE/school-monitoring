import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Table, TableBody, TableCell, TableRow } from "../../src/components/ui/table";

vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/lib/utils", () => ({ cn: (...classes: string[]) => classes.filter(Boolean).join(" ") }));

function renderRecords(printAll: boolean) {
  const rows = Array.from({ length: 26 }, (_, index) =>
    createElement(TableRow, { key: index }, createElement(TableCell, null, `Record ${index + 1}`)),
  );
  return renderToStaticMarkup(createElement(Table, null, createElement(TableBody, { printAll }, rows)));
}

describe("table pagination", () => {
  it("renders only the first 25 ordinary records", () => {
    const html = renderRecords(false);
    expect(html.match(/<tr\b/g)).toHaveLength(25);
    expect(html).not.toContain("Record 26");
  });

  it("includes off-page records only in a print row group when requested", () => {
    const html = renderRecords(true);
    expect(html.match(/<tr\b/g)).toHaveLength(26);
    expect(html).toMatch(/<tbody class="hidden print:table-row-group">.*Record 26.*<\/tbody>/);
  });
});
