# Client work — what has to happen, and whose job it is

Every piece of work a client generates, the trigger and deadline, and the role
accountable for it. Compiled from the code, not from intent: where the code and
the intent disagree, that is recorded as a gap rather than smoothed over.

Source of truth for each row is given as `file:line`.

---

## 1. The people

Five **care-team disciplines** (`supabase/0071_care_team_assignment.sql:12`),
one owner per discipline per client:

| Discipline | Staff role | How assigned |
|---|---|---|
| `doctor` | Doctor | first booked appointment with a Doctor provider |
| `dietitian` | Dietitian | first booked appointment |
| `trainer` | Fitness Trainer | rotation, constrained by free slots |
| `coach` | Health Coach | rotation, least-loaded |
| `psychologist` | Psychologist | booking only — **never auto-assigned** |

Which disciplines a package gets (`lib/assignment.ts:38-48`):

- Comprehensive, BluePrint → doctor, dietitian, trainer, coach
- Training (PT) → trainer, coach
- Membership → **none**

**Owner resolution** (`lib/obligations.ts:32-49`): the `client_assignments` row
wins; failing that, whoever actually ran the completed consult; failing that,
no owner — and the flag degrades from "chase Afya" to "chase Dietitian".

---

## 2. Booking work — Front Desk

Front desk owns getting people into the diary. The Health Coach is the one
exception, and only for the Day-2 explanation.

| Work | Trigger | Due | Owner |
|---|---|---|---|
| Book initial doctor consultation | package start | day 0 (`services.day_offset`) | Front Desk |
| Book initial diet consultation | package start | day 0 | Front Desk |
| Book initial fitness assessment | package start | day 0 | Front Desk |
| Book 12 strength sessions | package start | +2 days (`BOOKING_DUE_DAYS`) | Front Desk *(disputed — see §7)* |
| Day 10 diet follow-up | package start | day 10 | Front Desk books, Dietitian delivers |
| Day 21 diet review | package start | day 21 | Front Desk books, Dietitian delivers |
| Fitness reassessment | package start | day 21–28 | Front Desk books, Trainer delivers |
| Day 28 doctor review | package start | day 28 | Front Desk books, Doctor delivers |
| Day 2 diet chart explanation | diet chart drafted | day 2 | **Health Coach** |
| BluePrint: book 3 consultations | BluePrint purchase | +2 days | **nobody** — unassigned task |

Who *can* book (`canEditAppointments`, `lib/roles.ts:273`): Super Admin,
Administrator, Manager, Front Desk, Health Coach. Every clinician — including
the Medical Director — has a read-only calendar.

---

## 3. Clinical deliverables — the assigned clinician

| Work | Trigger | Due | Owner |
|---|---|---|---|
| Doctor summary sign-off | consult completed | 24h (`SIGNOFF_MS`) | assigned Doctor |
| Dietitian summary sign-off | consult completed | 24h | assigned Dietitian |
| Trainer summary sign-off | assessment completed | 24h | assigned Trainer |
| Diet chart drafted | diet consult completed | 24h (`DIET_DRAFT_MS`) | assigned Dietitian |
| One-week workout plan | fitness assessment completed | 24h (`WORKOUT_PLAN_MS`) | assigned Trainer |
| Prescription to portal | consult, if flagged needed | 24h (`PRESCRIPTION_MS`) | assigned Doctor |
| 12 strength sessions delivered | package start | +28 days per cycle | assigned Trainer |
| Comprehensive blood report chase | panel requested | 7-day nudge, no hard SLA | assigned **Health Coach** |
| BluePrint sign-off ×3 | consult completed | 24h | Doctor / Dietitian / Trainer |
| BluePrint consolidated | last of the 3 consults | 48h (`CONSOLIDATED_MS`) | Doctor, by convention |
| BluePrint generated | blood in + sign-offs | **no deadline at all** | "clinicians" (all three) |

---

## 4. Approval — Medical Director

| Work | Owner |
|---|---|
| Approve diet chart | **Medical Director only** (`canReviewDietChart`) |
| Approve diet plan | Medical Director only |
| Approve dietary assessment summary | Medical Director only |
| Approve own consultation summary | the clinician who wrote it — no second pair of eyes |
| Approve Comprehensive consolidated | anyone with `canConsult` — *not* doctor-restricted despite the comment |

---

## 5. Money — Front Desk / Finance

| Work | Trigger | Due | Owner |
|---|---|---|---|
| Raise invoice for a sold package | package active, no invoice | 3-day nudge | **nobody** |
| Chase unpaid invoice | issued | +7 days | Finance, Manager |
| Renewal due | subscription renews | −7 days | **nobody** |
| Complete new tablet intake | kiosk submission | 1-day nudge | **nobody** |

---

## 6. Coaching — Health Coach

Seven markers live in `lib/coach-markers.ts`: stress (PSS-10), sleep (PSQI),
activity (official PAR-Q+ + IPAQ-SF), nutrition (3-day diary + GDR), substance
(AUDIT-C + DAST-10 + Fagerström), anxiety (GAD-7), and mood (PHQ-9).

The structured baseline is universal; validated instruments are conditional.
A marker becomes applicable when the baseline triggers its pathway or a
clinician explicitly starts it by recording a result. Once started, its stored
`next_review_date` drives both the coach board and the clinic attention queue.
Intervals are instrument-specific: weekly during the first month then
biweekly for stress/sleep/activity/anxiety, six-weekly GDR, biweekly substance
screening, and PHQ-9 only on the recorded clinical plan. A referral-band result
raises an immediate attention flag independently of cadence.

---

## 7. Work with no owner

Ordered by how much it costs when it is missed.

1. **"No invoice raised"** (`lib/frontdesk-attention.ts:48`) — a package is sold
   and active with nothing billed. No chase, no owner. The most money-relevant
   item in the system.
2. **Renewal due** (`lib/followups.ts:99`) — `category: "Renewal"` matches no
   appointment rule, so no booking can ever close it, and no discipline owns it.
3. **New tablet intake** (`lib/frontdesk-attention.ts:80`) — a walk-in filled in
   the kiosk and nobody is asked to pick it up.
4. **BluePrint booking tasks** (`lib/blueprint-sla.ts:232-234`) and **milestone
   booking tasks** (`lib/cron/*-sla.ts`) — created as `tasks` rows with
   `created_by: "auto"` and no assignee.
5. **"Diet chart not drafted" / "workout plan not created" on the client card**
   (`lib/package-status.ts:182-183`) — these set a named owner but have **no
   role fallback**, unlike their twins in `care-attention.ts`. With no care-team
   assignment and no completed consult, they render with nobody attached.
6. **Everything in Today's agenda** (`lib/today-agenda.ts`) — `AgendaItem` has no
   owner field at all.
7. **Open concern with an unmapped role** (`lib/whiteboard-stage.ts:77`) — an
   orange alert nobody is asked to answer.
8. **Package ending** (`lib/package-status.ts:240`) — no renewal owner.

### Conflicts — two engines, two different answers

- **12 strength sessions**: `owner: "trainer"` in the SLA engines, `Front Desk`
  in both attention queues.
- **Day 10 / 21 / 28 milestones**: `MILESTONES` says dietitian/trainer/doctor;
  the attention queues overwrite that with Front Desk.
- **Comprehensive blood chase**: `care-attention.ts` names the actual coach;
  `package-status.ts` only ever says "Health Coach".

### Coverage gaps

- **PT clients get no follow-ups.** `onProtocol()` (`lib/followups.ts:36`) is
  Comprehensive-only. A training client's fitness reassessment never enters the
  follow-up queue or either attention panel.
- **Day-2 explanation routes to the wrong person.** It is coach-owned, but
  carries `category: "Diet Consultation"`, so the booking screen pre-fills the
  **Dietitian** (`lib/actions.ts:4584`).
- **Day-2 explanation is suppressed until the chart exists.** If the dietitian
  never drafts, the follow-up silently goes overdue with nothing on the card.
- **The follow-up queue is unscoped.** Everyone sees the whole clinic's queue and
  can action any row; capped at 300, so overflow is invisible.
- **Psychologist** has a discipline, a workspace and matching rules, but no
  package assigns one and no work item names one.

---

## 8. Permission problems

Verified against RLS — the database closes some of these, and that is noted.

| Issue | Severity |
|---|---|
| **Medical Director can approve their own work.** `canWriteNutrition` includes MD (via `isAdmin`) and `canReviewDietChart` is MD-only, so one person can compose, submit and approve the same document — contradicting the rule the role exists to enforce. | High |
| **`publishDietChartDirect`** (`lib/actions.ts:6184`) publishes a chart to the client from any status, skipping MD review, under the *authoring* guard. The approval gate is optional in practice. | High |
| **Document delivery is looser than authoring.** `sendDocumentWhatsApp` gates on `canConsult`, so a Fitness Trainer or Psychologist can WhatsApp a client's **prescription** or **lab requisition** — documents they cannot author or even view. | High |
| **`uploadClientFile`** (`:2610`) only excludes role `Client`. HR, Finance and plain Staff can attach a `blood_report` to any client, which auto-satisfies the blood panel. | Medium |
| **Tasks**: `setTaskStatus`, `remindTask`, `deleteTask` check only that someone is signed in. RLS limits this to staff, but *any* staff member can close or delete *any* task. | Medium |
| **MD omitted from four lists** that `isAdmin` covers everywhere else: BluePrint sign-off (`BP_ROLE_TO_DISC` :2694 + `adminish` :2702), `saveCoachAssessment` :3648, and the inline lists in `startConsultFromAppointment` :1297 and `markConsultDone` :1346. | Medium |
| **`client_workouts` has two guards**: `assignWorkout` needs only `canConsult` (a Psychologist passes), while `addWorkoutPlan` on the same table needs `canWriteFitness`. | Low |
| **`canWriteMedical` and `canWriteRoleScoped`** (`lib/discipline.ts:38,53`) are dead code — referenced only by tests. EMR uses `canEmr` instead. | Low |
| `submitFormResponse` and the whiteboard actions look unguarded in TypeScript, but **RLS holds**: `fr_client_write` scopes clients to their own row, and `0104` limits whiteboard writes to admins + the five clinicians. | Not a hole |

---

## 9. Decisions needed

1. Who owns **raising an invoice**? (Front Desk, or Finance?)
2. Who owns **renewals**? Nobody does today.
3. Who owns a **new tablet intake**?
4. For milestones and strength sessions — is Front Desk accountable for
   *booking* and the clinician for *delivering*? If so both queues should say so
   rather than one overwriting the other.
5. Should the Medical Director be blocked from approving a document they
   authored?
6. Should `publishDietChartDirect` survive now that approval is a named clinical
   decision?
7. Should PT clients get a follow-up ladder?
