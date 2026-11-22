import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const demoPersonnel = "10000000-0000-4000-8000-000000000003";
const digest = createHash("md5").update("demo-personnel:4").digest("hex");
const employee = [digest.slice(0, 8), digest.slice(8, 12), digest.slice(12, 16), digest.slice(16, 20), digest.slice(20)].join("-");
const documentType = 4;
const path = `${demoPersonnel}/${employee}/${documentType}/cc735fcc-05dd-441a-ac26-cb864f72edf2`;
const fileName = "Synthetic personnel record.pdf";

function demoPdf() {
  const body = "BT /F1 18 Tf 72 720 Td (Synthetic personnel record) Tj 0 -28 Td /F1 11 Tf (Local School Admin Desk training sample.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${offsets.length} 0 obj\n${object}\nendobj\n`;
  }
  const start = pdf.length;
  const entries = offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n${entries}trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

export async function seedDemoAttachment(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):54321\/?$/.test(url) || !key) {
    console.log("Set .env.local to the local Supabase URL and publishable key to install the private demo attachment.");
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await supabase.auth.signInWithPassword({ email: "personnel@school.example", password: "LocalSchoolDesk!2026" });
  if (signedIn.error || signedIn.data.user?.id !== demoPersonnel) throw new Error("Could not authenticate the local demo personnel account.");

  const fixture = await supabase.from("employees").select("employee_no").eq("id", employee).single();
  if (fixture.error || fixture.data?.employee_no !== "DEMO-P-004") throw new Error("Could not verify the local demo attachment employee.");

  const current = await supabase.from("employee_attachments").select("id").eq("storage_path", path).maybeSingle();
  if (current.error) throw new Error("Could not check the private demo attachment.");
  if (current.data) return;

  const bucket = supabase.storage.from("employee-documents");
  const upload = await bucket.upload(path, demoPdf(), { contentType: "application/pdf", upsert: false });
  if (upload.error && (await bucket.download(path)).error) throw new Error("Could not upload the private demo attachment.");

  const record = await supabase.from("employee_attachments").insert({
    employee_id: employee, document_type_id: documentType, storage_path: path,
    file_name: fileName, content_type: "application/pdf",
  });
  if (record.error && record.error.code !== "23505") {
    if (!upload.error) await bucket.remove([path]);
    throw new Error("Could not register the private demo attachment.");
  }
  console.log("Private demo attachment installed.");
}
