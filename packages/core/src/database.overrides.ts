import type { Database as GeneratedDatabase } from "./database.types";

/**
 * `database.types.ts` artık yalnız `scripts/gen-db-types-isolated.sh` ile üretilir ve elle düzenlenmez.
 * `supabase gen types` Postgres fonksiyon argümanlarının NULL kabul ettiğini bilemez (SQL'de argüman
 * nullability'si yoktur); bu yüzden üretilen tipte bu argümanlar `string`/`number` olarak çıkar.
 * Aşağıdaki liste, önceki elle bakımı yapılan tipte `| null` olan ve SQL tarafında NULL'u anlamlı biçimde
 * işleyen argümanlardır (istemciler bugün bu argümanlara null gönderiyor). Liste, yeniden üretimde
 * kaybolan nullability'yi geri ekler; başka hiçbir şeyi değiştirmez.
 */
type NullableRpcArgs = {
  admin_save_contribution_reward: "p_plan";
  change_child_education: "p_grade" | "p_school";
  change_child_education_with_calendar:
    | "p_grade"
    | "p_school"
    | "p_calendar_id"
    | "p_calendar_revision"
    | "p_reason"
    | "p_detail";
  mark_parent_inbox: "p_archived";
  push_record_delivery: "p_error" | "p_retry_after";
  record_curriculum_source_fetch: "p_revision";
  save_answer_review: "p_score";
  save_calendar_event: "p_values";
  score_open_answer: "p_score";
  set_operation_member: "p_expires_at";
};

type WithNullableArgs<Fn, Keys> = {
  [Field in keyof Fn]: Field extends "Args"
    ? { [Arg in keyof Fn[Field]]: Arg extends Keys ? Fn[Field][Arg] | null : Fn[Field][Arg] }
    : Fn[Field];
};

type GeneratedFunctions = GeneratedDatabase["public"]["Functions"];

type PatchedFunctions = {
  [Name in keyof GeneratedFunctions]: Name extends keyof NullableRpcArgs
    ? WithNullableArgs<GeneratedFunctions[Name], NullableRpcArgs[Name]>
    : GeneratedFunctions[Name];
};

export type Database = {
  [Schema in keyof GeneratedDatabase]: Schema extends "public"
    ? {
        [Section in keyof GeneratedDatabase["public"]]: Section extends "Functions"
          ? PatchedFunctions
          : GeneratedDatabase["public"][Section];
      }
    : GeneratedDatabase[Schema];
};
