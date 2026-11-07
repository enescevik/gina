import {z} from 'zod';
export const outcomeObservationsSchema=z.array(z.object({
 scope:z.string(),grade:z.number().int(),subject:z.string(),curriculum:z.string().nullable(),outcomes:z.array(z.string()).min(1),
 observations:z.number().int().nonnegative(),scored:z.number().int().nonnegative(),pending:z.number().int().nonnegative(),blank:z.number().int().nonnegative(),
 mean_points:z.number().min(0).max(100).nullable(),limited_observation:z.boolean(),last_at:z.string(),
}).refine(v=>v.observations===v.scored+v.pending+v.blank&&v.limited_observation===(v.scored<5)&&((v.mean_points===null)===(v.scored<5))));
