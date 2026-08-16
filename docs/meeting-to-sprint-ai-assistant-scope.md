# Meeting-to-Sprint AI Assistant — review-first scope

Status: proposed Workboard item only. No recording, transcription, AI call, integration, assignment, budget change, or other action is implemented or authorized by this document.

## Purpose and draft outputs

The assistant may prepare reviewable drafts for a Super Admin from an explicitly consented live meeting capture or an authorized uploaded recording, transcript, or meeting note. Drafts may include:

- a transcript with source timestamps where the selected provider supports them;
- proposed sprint tasks, owners, deadlines, dependencies, and next actions;
- plan and campaign observations;
- finance and budget analysis without approving or moving funds;
- HR and workflow-capacity observations without making employment decisions; and
- feasibility feedback grounded only in approved Cureocity app data.

All results must be labelled as AI-generated drafts, retain links to their source evidence, and remain editable before approval.

## Consent, privacy, and retention

- Live capture must never start until the meeting organizer confirms attendee consent and participants receive a visible recording/transcription notice. No covert or passive capture is allowed.
- An uploader must confirm they are authorized to use uploaded meeting material.
- Collect only information needed for the stated meeting purpose. Client health, clinical, safety, payment-card, credential, token, and other sensitive content is excluded by default.
- Source media, transcripts, drafts, and audit metadata need separately approved retention and deletion periods. They must not be kept indefinitely by default.
- Provider data residency, model-training use, subcontractors, deletion guarantees, and security terms must be approved before any vendor receives data.

## Data-access boundary

- Access is Super Admin-only unless a later role decision explicitly authorizes another staff role.
- The assistant may read only server-side, allowlisted fields needed for the approved analysis. It must not have unrestricted database, storage, audit-log, authentication, secret, or infrastructure access.
- Feasibility checks must identify the approved app records used and distinguish retrieved facts from AI inference.
- Production client or staff data is not an allowed test input. Development tests must use synthetic data.

## Prohibited actions

The assistant must not create or modify tasks, assign owners, send messages, schedule meetings, change deadlines, approve or alter budgets, move money, make HR decisions, change access, modify app or database data, deploy code, or call an external action on the user's behalf. It must not present draft analysis as an approved operational, financial, HR, clinical, or safety decision.

## Approval gates

1. Capture or upload is separately consented and authorized.
2. The system produces a non-actioning draft with sources, uncertainty, and missing information.
3. A Super Admin reviews and may edit every proposed task, owner, deadline, dependency, analysis, and next action.
4. Explicit Super Admin approval records the reviewed draft and audit metadata; approval alone still performs no external action.
5. Any later task creation, assignment, notification, budget workflow, or integration requires a separately designed permissioned action flow and a fresh explicit confirmation.

## Decisions required before implementation

- supported capture path: browser recording, meeting-platform integration, upload, or a limited combination;
- consent evidence and participant notification experience;
- transcription/AI provider, region, contractual privacy terms, and Development-only evaluation plan;
- retention and deletion periods for media, transcripts, drafts, and audit records;
- exact Cureocity data fields that may be read for feasibility, plan, finance, and capacity analysis;
- whether owner suggestions may use workload data and which HR fields are prohibited;
- output review, versioning, audit, correction, and rejection requirements; and
- whether any post-approval task system will exist, who can use it, and its separate confirmation controls.
