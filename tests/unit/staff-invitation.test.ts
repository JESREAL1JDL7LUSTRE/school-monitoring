import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { inviteStaff } from "../../src/modules/auth/invite-actions";

const { createUser, getConfig, requirePermission, rpc } = vi.hoisted(() => ({
  createUser: vi.fn(),
  getConfig: vi.fn(),
  requirePermission: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { admin: { createUser } } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: getConfig }));
vi.mock("../../src/modules/auth/session", () => ({ requirePermission }));

const account = "recipient@school.example";
const accountId = "11111111-1111-4111-8111-111111111111";

function form() {
  const data = new FormData();
  data.set("email", account.toUpperCase());
  data.set("role", "auditor");
  return data;
}

describe("staff invitations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service-key");
    getConfig.mockReturnValue({ url: "http://127.0.0.1:54321" });
    requirePermission.mockResolvedValue({ supabase: { rpc } });
    createUser.mockResolvedValue({ data: { user: { id: accountId } }, error: null });
    rpc.mockResolvedValue({ data: "saved", error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("creates a manual invitation before assigning the requested role", async () => {
    const result = await inviteStaff({}, form());
    expect(result.credentials?.email).toBe(account);
    expect(result.credentials?.password.length).toBeGreaterThan(20);
    expect(requirePermission).toHaveBeenCalledWith("settings.write");
    expect(createUser).toHaveBeenCalledWith({ email: account, password: result.credentials?.password, email_confirm: true, app_metadata: { temporary_password: true } });
    expect(rpc).toHaveBeenCalledWith("update_staff_role", { target_email: account, target_role: "auditor", enabled: true });
  });

  test("does not assign access when the account creation fails", async () => {
    createUser.mockResolvedValue({ data: {}, error: { code: "email_address_not_authorized" } });
    expect((await inviteStaff({}, form())).error).toContain("Could not create");
    expect(rpc).not.toHaveBeenCalled();
  });
});
