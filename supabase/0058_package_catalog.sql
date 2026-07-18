-- ============================================================================
-- Cureocity — rich package catalog: attributes, branch pricing, and the
-- bundled-services mapping. Run after 0057.
-- ============================================================================

-- ---- package attributes ----------------------------------------------------
alter table packages add column if not exists one_time      boolean not null default false;
alter table packages add column if not exists requires_slot boolean not null default false;
alter table packages add column if not exists delivery_mode text not null default 'Offline';  -- Hybrid | Offline | Online
alter table packages add column if not exists tags          text[] not null default '{}';
alter table packages add column if not exists mrp           numeric;                          -- optional strike-through MRP

update packages set requires_slot = true,  delivery_mode = 'Hybrid',  tags = '{personal,continuous}'      where id like 'comp%';
update packages set requires_slot = true,  delivery_mode = 'Offline', tags = '{personal,cardio/strength}' where id like 'pt%';
update packages set requires_slot = false, delivery_mode = 'Offline', tags = '{continuous}'               where is_facility = true;
update packages set one_time = true, requires_slot = false, delivery_mode = 'Hybrid', tags = '{personal}'  where id = 'bp1';

-- ---- per-branch pricing -----------------------------------------------------
create table if not exists package_prices (
  package_id text references packages(id) on delete cascade,
  branch     text not null,
  price      numeric not null default 0,
  mrp        numeric,
  primary key (package_id, branch)
);
alter table package_prices enable row level security;
drop policy if exists package_prices_read on package_prices;
create policy package_prices_read on package_prices for select using (true);
drop policy if exists package_prices_staff on package_prices;
create policy package_prices_staff on package_prices for all using (is_staff()) with check (is_staff());

-- seed each package at its base price for both branches (edit per branch later)
insert into package_prices (package_id, branch, price)
select p.id, b.branch, p.price from packages p, (values ('Kochi'), ('Calicut')) b(branch)
on conflict do nothing;

-- ---- package → services bundle ---------------------------------------------
create table if not exists package_services (
  package_id text references packages(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  primary key (package_id, service_id)
);
alter table package_services enable row level security;
drop policy if exists package_services_read on package_services;
create policy package_services_read on package_services for select using (true);
drop policy if exists package_services_staff on package_services;
create policy package_services_staff on package_services for all using (is_staff()) with check (is_staff());

-- Comprehensive → all 9 services
insert into package_services (package_id, service_id)
select p.id, s.id from (values ('comp4'), ('comp12')) p(id), services s
where s.name in ('Initial Doctor Consultation','Doctor Followup (28 days)','Initial Fitness Consultation',
                 'Fitness Reassessment','12 Sessions Strength','Initial Diet Consultation','Diet Chart Explanation',
                 '10th Day Diet Followup','21st Day Diet Followup')
on conflict do nothing;

-- Personal Training → fitness services
insert into package_services (package_id, service_id)
select p.id, s.id from (values ('pt4'), ('pt12')) p(id), services s
where s.name in ('Initial Fitness Consultation','Fitness Reassessment','12 Sessions Strength')
on conflict do nothing;

-- BluePrint → the three initial consultations
insert into package_services (package_id, service_id)
select 'bp1', s.id from services s
where s.name in ('Initial Doctor Consultation','Initial Diet Consultation','Initial Fitness Consultation')
on conflict do nothing;
