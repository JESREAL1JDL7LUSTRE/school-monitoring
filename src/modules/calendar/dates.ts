import { z } from "zod";

const manilaDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
});

export const firstCalendarYear = 1900;
export const lastCalendarYear = 9999;

export const calendarDateSchema = z.iso.date().refine((value) =>
  value >= `${firstCalendarYear}-01-01` && value <= `${lastCalendarYear}-12-31`,
);

export const todayInManila = () => manilaDate.format(new Date());

export const monthKey = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);

export function resolveCalendarDate(value: unknown, month?: string) {
  const date = calendarDateSchema.safeParse(value);
  if (!date.success || (month && !date.data.startsWith(`${month}-`))) return null;
  return date.data;
}

export function resolveCalendarMonth(value: unknown, today: string) {
  const monthStart = typeof value === "string" ? resolveCalendarDate(`${value}-01`) : null;
  return monthStart?.slice(0, 7) ?? today.slice(0, 7);
}
