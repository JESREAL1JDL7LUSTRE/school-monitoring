import { z } from "zod";

const cursorId = z.string().regex(/^[1-9]\d{0,18}$/).refine((id) => id.length < 19 || id <= "9223372036854775807");

export function readRecordCursor(value: unknown, date: z.ZodType<string>) {
  if (typeof value !== "string") return;
  return z.tuple([date, cursorId]).safeParse(value.split(",")).data;
}

export function recordCursorPage<Row>(data: Row[], direction?: "newer" | "older") {
  const hasMore = data.length > 25;
  const rows = data.slice(0, 25);
  if (direction === "newer") rows.reverse();
  return {
    rows,
    previous: direction === "newer" ? (hasMore ? rows[0] : undefined) : direction === "older" ? rows[0] : undefined,
    next: direction === "newer" || hasMore ? rows.at(-1) : undefined,
  };
}
