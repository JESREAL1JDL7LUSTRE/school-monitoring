import { z } from "zod";

const leaveDate = (message: string) => z.iso.date(message).refine(
  (value) => value >= "1900-01-01", message,
);

const leaveInput = z.object({
  leave_type: z.string().trim().min(1, "Enter a leave type.").max(80, "Use up to 80 characters for the leave type."),
  start_date: leaveDate("Enter a valid start date."),
  end_date: leaveDate("Enter a valid end date."),
}).refine(({ start_date, end_date }) => end_date >= start_date, {
  path: ["end_date"], message: "End date must be on or after the start date.",
});

export const leaveEmployeeId = z.uuid("Choose an employee.");
export const leaveRecordId = z.uuid();

export function parseLeaveDetails(form: FormData) {
  return leaveInput.safeParse({
    leave_type: form.get("leave_type"),
    start_date: form.get("start_date"),
    end_date: form.get("end_date"),
  });
}
