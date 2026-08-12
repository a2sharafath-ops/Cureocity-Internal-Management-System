-- Cureocity — prevent explicitly declined referrals from being routed.
-- Run after 0172. NOT VALID avoids rewriting historical clinical records; the
-- constraint still applies immediately to every new insert and updated row.

begin;

alter table clinical_referrals
  drop constraint if exists clinical_referrals_declined_consent_status_check;

alter table clinical_referrals
  add constraint clinical_referrals_declined_consent_status_check
  check (
    consent_status <> 'Declined'
    or status in ('Draft', 'Declined', 'Cancelled')
  ) not valid;

comment on constraint clinical_referrals_declined_consent_status_check
  on clinical_referrals is
  'Explicitly declined consent may be documented but can never enter a sent or active referral state.';

commit;
