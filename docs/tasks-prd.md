# Cureocity Tasks — Product Requirements Document

## 1. Purpose

Tasks is Cureocity's operational work-management feature. It turns work created by people and existing workflows into visible, owned, time-bound follow-through. It is distinct from the Super Admin Workboard: the Workboard tracks product, infrastructure and release work; Tasks tracks day-to-day business operations.

## 2. Current product

The current implementation provides a central task board with title, assignee, optional client or lead link, type, priority, due date and status. It supports To Do, In Progress, Blocked and Done, upcoming/overdue/completed filters, timeline view, reminders and real-time refresh. Tasks can also be created by existing operational workflows such as booking chases and SLA breaches.

## 3. Roles and access

| Role | Board access | Create/manage | Intended responsibility |
| --- | --- | --- | --- |
| Super Admin | Full | Full | Business-wide oversight and exception escalation |
| Admin | Full | Full | System administration and operational governance |
| Manager | Full | Full | Daily allocation, follow-through and capacity balancing |
| Other staff | No central board in this phase | No central-board access | Receive workflow-specific attention items only |

`Administrator` remains the stored permission value and is displayed as `Admin`. Clinical authority, billing approval and staff-access rights do not change merely because a user can see a task.

## 4. Product principles

1. Every open task should have an understandable owner, purpose and next step.
2. Blocked work must be visible before it becomes overdue.
3. A task may link to a client or lead, but it must not expose clinical details beyond the viewer's existing permissions.
4. The task system coordinates work; it does not autonomously send messages, change appointments, bill clients or make clinical decisions.
5. Important changes must be attributable and auditable.

## 5. Current workflow

```text
Create or workflow trigger → assign owner, priority and due date → work the task → resolve a block or complete it.
```

## 6. vNext: operational triage (implemented in this increment)

- Personal “My tasks” focus for the signed-in staff member.
- Summary of open, overdue, blocked and unassigned work.
- A distinct Blocked queue, rather than hiding blocked work in the general list.
- Preserved table, filters, timeline, reminders and linked client/lead routes.
- No database migration and no change to task data or permissions.

## 7. Next data-model increment

Before building this phase, introduce a reviewed migration for:

- description and clear requested outcome;
- blocking reason and resolution note;
- task event history for creation, assignment, status and due-date changes;
- completion metadata and controlled reopening;
- source classification: manual, workflow, integration or Assistant draft;
- server-side role/assignment enforcement rather than a broad staff policy.

## 8. Advanced roadmap

### Phase 2 — accountable task records

Task detail drawer/page, descriptions, status history, assignee notifications, block reason and audit trail. Admin and Manager can assign/reassign; an assignee can update only their permitted work.

### Phase 3 — coordination

Comments, mentions, attachments with existing Storage safeguards, checklists, recurring operational templates and workload/capacity signals. Client-linked tasks retain least-privilege access.

### Phase 4 — intelligence and automation

Cureocity Assistant may propose tasks from approved workflow signals or an approved meeting draft. It must show source evidence, assignee, due-date assumption and confidence. A human must explicitly create the task. No AI output may silently assign, notify, close or alter a task.

### Phase 5 — controlled workflow automations

Trigger → human-reviewed task draft → explicit approval → notification.

Possible examples: overdue follow-up reminder, incomplete onboarding checklist or unassigned package journey. Automations must be idempotent, observable, audited, configurable by authorised roles and reversible.

## 9. Success measures

- Every non-completed task has an owner or is visibly unassigned.
- Managers identify overdue or blocked work within one board visit.
- No unauthorised role can use Tasks to discover restricted client information.
- Status/assignment changes have reliable audit evidence once Phase 2 is live.
- Workflow-generated task duplicates are prevented by source identifiers.

## 10. Non-goals

- Replacing clinical documentation, care plans, appointments, billing or the Super Admin Workboard.
- Unreviewed AI task creation or automatic external communication.
- Making a task status itself a clinical or financial approval.

## 11. Acceptance criteria for the next data-model increment

1. Existing tasks retain their status, assignee and dates.
2. Blocked status requires a reason in the UI and server path.
3. Creation, assignment, status, due date and completion changes are append-only events with actor and timestamp.
4. Admin/Manager/Super Admin permissions are enforced server-side and in RLS.
5. Automated and Assistant-created drafts cannot create duplicates or bypass human approval.
