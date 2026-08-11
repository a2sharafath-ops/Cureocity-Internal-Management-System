-- Region, shift pattern and how often the client eats out.
--
-- WHY THESE THREE, AND WHY NOW
--
-- Section 1 of the dietitian's brief lists what a chart is designed from. Most
-- of it is captured somewhere. Three items are not, and each one is the reason
-- a different later section exists:
--
--   Client's region       -> section 9, the Kerala cuisine default
--   Shift timing          -> section 6, meal structure from the wake/sleep cycle
--   Outside-meal habit    -> section 10, restaurant and English-meal options
--
-- Until now all three lived in somebody's head. The Kerala default in
-- particular has been a convention rather than data: every chart is written in
-- Kerala dishes because that is what the clinic does, and a client from
-- Hyderabad is caught only if the dietitian remembers the conversation.
--
-- WHAT NULL MEANS, WHICH IS THE WHOLE DESIGN
--
-- `region` null means Kerala. The brief says "default is Kerala unless
-- specified otherwise", so an empty box is the default being taken rather than
-- a question nobody answered — and the screen says so in those words. Storing
-- 'Kerala' in every row instead would make the one case that matters, the
-- client from somewhere else, indistinguishable from a blank.
--
-- `shift_pattern` null means an ordinary daytime routine, for the same reason.
-- Only a pattern that changes the shape of the day is worth recording.
--
-- WHY FREE TEXT AND NOT A DROPDOWN
--
-- "Rotating, nights every third week" is a real answer and no list contains it.
-- The checks that read these look for a few unmistakable words and otherwise
-- say plainly that a human should read the note — which is better than a
-- dropdown that forces a real answer into the nearest wrong box.

alter table diet_assessments
  add column if not exists region        text,
  add column if not exists shift_pattern text,
  add column if not exists outside_meals text;

comment on column diet_assessments.region is
  'Where the client is from, when it is not Kerala. Null means the Kerala cuisine default of section 9 applies.';
comment on column diet_assessments.shift_pattern is
  'Night, rotating or otherwise unusual working hours. Null means an ordinary daytime routine.';
comment on column diet_assessments.outside_meals is
  'How often the client eats restaurant or English-style meals, for section 10.';

-- Proof on screen.
select count(*) as assessments,
       count(region)        as with_a_region_recorded,
       count(shift_pattern) as with_a_shift_recorded
  from diet_assessments;
