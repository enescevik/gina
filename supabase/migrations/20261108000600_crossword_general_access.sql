-- General rollout after iPad authoring, solving and partial-score acceptance.
update public.interaction_types set enabled = true where type = 'crossword';
delete from gina.crossword_pilot_access;
