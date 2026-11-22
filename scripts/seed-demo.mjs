import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { seedDemoAttachment } from "./seed-demo-attachment.mjs";

const seedFiles = ["00600_personnel_demo.sql", "00700_inventory_demo.sql", "00800_forms_calendar_demo.sql"];
const demoContainer = "supabase_db_school-admin-desk";
const localDockerHosts = new Set([
  "npipe:////./pipe/docker_engine",
  "npipe:////./pipe/dockerDesktopLinuxEngine",
  "unix:///var/run/docker.sock",
]);

function refreshDemoDatabase() {
  const { Endpoints } = JSON.parse(execFileSync("docker", ["context", "inspect"], { encoding: "utf8" }))[0];
  const host = Endpoints?.docker?.Host;
  if (!localDockerHosts.has(host)) throw new Error("Switch Docker to its local engine before refreshing demo data.");

  const statements = seedFiles.map((name) => readFileSync(new URL(`../supabase/seeds/${name}`, import.meta.url), "utf8"));
  const verifyDemo = `do $$ begin
    if not exists (select 1 from auth.users where id = '10000000-0000-4000-8000-000000000001' and email = 'admin@school.example')
      or not exists (select 1 from public.employees where id = '11111111-1111-4111-8111-111111111111' and employee_no = 'EMP-001')
    then raise exception 'This database does not contain the School Admin Desk demo fixtures'; end if;
  end $$;`;
  execFileSync("docker", ["--host", host, "exec", "-i", demoContainer,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-1", "-f", "-"], {
    input: [verifyDemo, ...statements].join("\n\n"),
    stdio: ["pipe", "inherit", "inherit"],
  });
}

try {
  refreshDemoDatabase();
  console.log("Local demo records installed.");

  const envFile = new URL("../.env.local", import.meta.url);
  if (existsSync(envFile) && lstatSync(envFile).isFile()) {
    await seedDemoAttachment(parseEnv(readFileSync(envFile, "utf8")));
  } else {
    console.log("Add .env.local and rerun the seed to install the private demo attachment.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "The local demo seed failed.");
  process.exitCode = 1;
}
