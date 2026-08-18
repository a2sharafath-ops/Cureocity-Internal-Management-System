-- Consolidate Sprint 10 workstreams into meaningful, outcome-level projects.
-- Existing task rows, assignees, status, deadlines, reminders and history stay
-- intact; only the project grouping changes. The old project records are kept
-- as completed history rather than deleted.

begin;

insert into public.task_projects (name, description, status, created_by)
values
  ('Marketing & Media', 'Brand, performance marketing, creative and media work.', 'active', 'migration:0201'),
  ('Sales & Business Development', 'Lead generation, conversion, partnerships and commercial growth.', 'active', 'migration:0201'),
  ('ORB App Launch Event', 'All work required for the ORB app launch event.', 'active', 'migration:0201'),
  ('CREC & Clinical Partnerships', 'CREC programmes, clinical partnerships and referrer development.', 'active', 'migration:0201'),
  ('People & HR', 'Hiring, people operations and human-resource work.', 'active', 'migration:0201'),
  ('App Development & IT', 'Product, ERP, technical and operational-PRD delivery.', 'active', 'migration:0201'),
  ('Operations & Service Delivery', 'Facilities, training, service quality and operational execution.', 'active', 'migration:0201'),
  ('Community Events & Partnerships', 'Monthly events, summit and non-ORB community partnerships.', 'active', 'migration:0201')
on conflict (name) do nothing;

with project_map (source_name, target_name) as (
  values
    ('Sprint 10 · App Development · Build ERP for smoother operations', 'App Development & IT'),
    ('Sprint 10 · App Development · Human Resource', 'People & HR'),
    ('Sprint 10 · App Development · IT', 'App Development & IT'),
    ('Sprint 10 · App Development · Operational PRDs', 'App Development & IT'),
    ('Sprint 10 · Media Production · ORB App launch Event · Instagram Content Production', 'ORB App Launch Event'),
    ('Sprint 10 · Media Production · ORB App launch Event · Invitational Collateral', 'ORB App Launch Event'),
    ('Sprint 10 · Media Production · ORB App launch Event · Production Update', 'ORB App Launch Event'),
    ('Sprint 10 · Media Production · ORB App launch Event · Social Media pre marketing Collaterals', 'ORB App Launch Event'),
    ('Sprint 10 · Media Production · ORB App launch Event · Testimonial Shoot', 'ORB App Launch Event'),
    ('Sprint 10 · Operations · Calicut new fitness hub', 'Operations & Service Delivery'),
    ('Sprint 10 · Operations · Collaborate with DDRC to execute our 75+ biomarkers testing assessment', 'CREC & Clinical Partnerships'),
    ('Sprint 10 · Operations · Health Coach Training Module Completion', 'Operations & Service Delivery'),
    ('Sprint 10 · Operations · HR', 'People & HR'),
    ('Sprint 10 · Operations · Instagram Content Draft for Review', 'Marketing & Media'),
    ('Sprint 10 · Operations · Kochi facility & service quality enhancement', 'Operations & Service Delivery'),
    ('Sprint 10 · Operations · Monthly Events', 'Community Events & Partnerships'),
    ('Sprint 10 · Operations · ORB App launch Event', 'ORB App Launch Event'),
    ('Sprint 10 · Operations · Summit', 'Community Events & Partnerships'),
    ('Sprint 10 · Operations · Workstream 10.0', 'Operations & Service Delivery'),
    ('Sprint 10 · Sales & Marketing · Collaboration events', 'Community Events & Partnerships'),
    ('Sprint 10 · Sales & Marketing · Collaboration Partnership leads', 'Sales & Business Development'),
    ('Sprint 10 · Sales & Marketing · CREC Workshops', 'CREC & Clinical Partnerships'),
    ('Sprint 10 · Sales & Marketing · Execute Street Marketing Activities in Panampilly', 'Marketing & Media'),
    ('Sprint 10 · Sales & Marketing · Lead Gen', 'Sales & Business Development'),
    ('Sprint 10 · Sales & Marketing · Performance Marketing', 'Marketing & Media'),
    ('Sprint 10 · Sales & Marketing · Run lead-gen ads targeting appartments', 'Marketing & Media'),
    ('Sprint 10 · Sales & Marketing · Sales', 'Sales & Business Development'),
    ('Sprint 10 · Sales & Marketing · Sign 5+ doctor referrers', 'CREC & Clinical Partnerships')
), remapped as (
  update public.tasks task
     set project_id = target.id
    from public.task_projects source
    join project_map mapping on mapping.source_name = source.name
    join public.task_projects target on target.name = mapping.target_name
   where task.project_id = source.id
  returning source.id
)
update public.task_projects source
   set status = 'completed'
  from project_map mapping
 where source.name = mapping.source_name;

commit;
