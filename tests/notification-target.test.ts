import { describe, expect, it } from "vitest";
import { resolveNotificationTarget } from "@/lib/notification-target";

describe("Health Coach notification targets", () => {
  it("opens clinical referrals and safety escalations at care coordination", () => {
    const clientId = "11111111-1111-1111-1111-111111111111";
    expect(resolveNotificationTarget("clinical-referral", clientId))
      .toBe(`/clients/${clientId}#care-coordination`);
    expect(resolveNotificationTarget("safety-event", clientId))
      .toBe(`/clients/${clientId}#care-coordination`);
  });
});
