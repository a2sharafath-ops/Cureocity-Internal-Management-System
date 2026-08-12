import { describe, expect, it } from "vitest";
import {
  clinicalReferralCreationDecision,
  clinicalReferralStatusAllowedForConsent,
} from "@/lib/clinical-referral";

describe("clinical referral consent invariant", () => {
  it("documents declined consent without sending or notifying", () => {
    expect(clinicalReferralCreationDecision("Declined")).toEqual({
      consentStatus: "Declined",
      status: "Cancelled",
      notifyRecipients: false,
    });
    expect(clinicalReferralStatusAllowedForConsent("Declined", "Sent")).toBe(false);
    expect(clinicalReferralStatusAllowedForConsent("Declined", "Acknowledged")).toBe(false);
    expect(clinicalReferralStatusAllowedForConsent("Declined", "Cancelled")).toBe(true);
  });

  it("sends an ordinary consented referral and permits its workflow", () => {
    expect(clinicalReferralCreationDecision("Obtained")).toEqual({
      consentStatus: "Obtained",
      status: "Sent",
      notifyRecipients: true,
    });
    expect(clinicalReferralStatusAllowedForConsent("Obtained", "Sent")).toBe(true);
    expect(clinicalReferralStatusAllowedForConsent("Obtained", "Completed")).toBe(true);
  });

  it("rejects an unknown consent value", () => {
    expect(clinicalReferralCreationDecision("unknown")).toBeNull();
  });
});
