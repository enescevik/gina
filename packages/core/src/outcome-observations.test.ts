import {describe,it,expect} from 'vitest';
import {outcomeObservationsSchema, practiceDifficultySuggestion} from './outcome-observations';
const row={scope:'outcomes:x',grade:3,subject:'Matematik',curriculum:null,outcomes:['A','B'],observations:7,scored:5,pending:1,blank:1,mean_points:60,limited_observation:false,last_at:'2026-11-07T00:00:00Z'};
describe('joint outcome observations',()=>{
 it('keeps jointly tagged outcomes together',()=>expect(outcomeObservationsSchema.parse([row])[0]?.outcomes).toEqual(['A','B']));
 it('rejects a numeric average below the observation threshold',()=>expect(outcomeObservationsSchema.safeParse([{...row,observations:6,scored:4,limited_observation:true}]).success).toBe(false));
 it('does not merge pending or blank into the scored denominator',()=>expect(outcomeObservationsSchema.safeParse([{...row,observations:5}]).success).toBe(false));
 it('accepts insufficient observations only with null mean',()=>expect(outcomeObservationsSchema.safeParse([{...row,observations:6,scored:4,limited_observation:true,mean_points:null}]).success).toBe(true));
});

describe("parent practice difficulty suggestion", () => {
  const evidence = { ...row, observations: 6, pending: 0, mean_points: 59 };
  it("offers easier practice from a single sufficiently observed outcome set", () => {
    expect(practiceDifficultySuggestion([evidence])).toEqual({ difficulty: "kolay", scored: 5 });
    expect(practiceDifficultySuggestion([{ ...evidence, mean_points: 85 }])).toEqual({ difficulty: "orta", scored: 5 });
  });
  it("avoids recommendations from pending, insufficient or combined evidence", () => {
    expect(practiceDifficultySuggestion([{ ...evidence, pending: 1 }])).toBeNull();
    expect(practiceDifficultySuggestion([{ ...evidence, scored: 4 }])).toBeNull();
    expect(practiceDifficultySuggestion([evidence, { ...evidence, scope: "another" }])).toBeNull();
    expect(practiceDifficultySuggestion([{ ...evidence, mean_points: 72 }])).toBeNull();
  });
});
