export const CLINICAL_REFERRAL_CONSENT_STATUSES = [
  "Not recorded", "Obtained", "Declined", "Not required",
] as const;

export type ClinicalReferralConsentStatus = typeof CLINICAL_REFERRAL_CONSENT_STATUSES[number];
export type ClinicalReferralInitialStatus = "Sent" | "Cancelled";

const CONSENT_STATUSES = new Set<string>(CLINICAL_REFERRAL_CONSENT_STATUSES);
const DECLINED_CONSENT_STATUSES = new Set(["Draft", "Declined", "Cancelled"]);

export type ClinicalReferralCreationDecision = {
  consentStatus: ClinicalReferralConsentStatus;
  status: ClinicalReferralInitialStatus;
  notifyRecipients: boolean;
};

/**
 * Decide whether a new referral is sent or only documented. Explicitly
 * declined consent is a terminal, non-routed outcome rather than a referral.
 */
export function clinicalReferralCreationDecision(
  consentStatus: string,
): ClinicalReferralCreationDecision | null {
  if (!CONSENT_STATUSES.has(consentStatus)) return null;

  const declined = consentStatus === "Declined";
  return {
    consentStatus: consentStatus as ClinicalReferralConsentStatus,
    status: declined ? "Cancelled" : "Sent",
    notifyRecipients: !declined,
  };
}

/** Mirrors the database constraint so direct action calls fail before SQL. */
export function clinicalReferralStatusAllowedForConsent(
  consentStatus: string,
  status: string,
): boolean {
  return consentStatus !== "Declined" || DECLINED_CONSENT_STATUSES.has(status);
}
