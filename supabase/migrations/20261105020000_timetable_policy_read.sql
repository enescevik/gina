-- The timetable Edge preflight reads the plan policy before downloading private sources.
-- Make that narrow service permission explicit rather than relying on project default grants.
grant select on public.ai_operation_policies to service_role;
