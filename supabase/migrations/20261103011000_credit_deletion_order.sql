-- Family deletion cascades through grants and generation jobs in an unspecified
-- order. Check the surviving allocation references at transaction end instead.
-- Standalone deletion of a used grant remains forbidden; spending cannot vanish.
alter table public.generation_credit_allocations
 alter constraint generation_credit_allocations_grant_id_fkey
 deferrable initially deferred;
