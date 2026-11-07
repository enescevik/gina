
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "active_families": {
                  Row: {
                    "family_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "family_id": string,"user_id": string
                  }
                  Update: {
                    "family_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "active_families_family_id_user_id_fkey"
      columns: ["family_id","user_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["family_id","user_id"]
    }
                  ]
                },"admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_chain_assignments": {
                  Row: {
                    "chain_id": string,"updated_at": string,"usage_key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chain_id": string,"updated_at"?: string,"usage_key": string
                  }
                  Update: {
                    "chain_id"?: string,"updated_at"?: string,"usage_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_chain_assignments_chain_id_fkey"
      columns: ["chain_id"]
isOneToOne: false
      referencedRelation: "ai_chains"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_chain_assignments_usage_key_fkey"
      columns: ["usage_key"]
isOneToOne: true
      referencedRelation: "ai_usage_kinds"
      referencedColumns: ["key"]
    }
                  ]
                },"ai_chain_attempts": {
                  Row: {
                    "chain_id": string,"created_at": string,"error_code": string | null,"finished_at": string | null,"id": string,"input_tokens": number | null,"lease": string | null,"model_id": string,"output_tokens": number | null,"position": number,"provider": string,"run_id": string,"status": string,"uncertain": boolean,"usage_key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chain_id": string,"created_at"?: string,"error_code"?: string | null,"finished_at"?: string | null,"id"?: string,"input_tokens"?: number | null,"lease"?: string | null,"model_id": string,"output_tokens"?: number | null,"position": number,"provider": string,"run_id": string,"status": string,"uncertain"?: boolean,"usage_key": string
                  }
                  Update: {
                    "chain_id"?: string,"created_at"?: string,"error_code"?: string | null,"finished_at"?: string | null,"id"?: string,"input_tokens"?: number | null,"lease"?: string | null,"model_id"?: string,"output_tokens"?: number | null,"position"?: number,"provider"?: string,"run_id"?: string,"status"?: string,"uncertain"?: boolean,"usage_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_chain_attempts_chain_id_fkey"
      columns: ["chain_id"]
isOneToOne: false
      referencedRelation: "ai_chains"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_chain_attempts_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "ai_models"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_chain_attempts_provider_fkey"
      columns: ["provider"]
isOneToOne: false
      referencedRelation: "ai_providers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_chain_attempts_usage_key_fkey"
      columns: ["usage_key"]
isOneToOne: false
      referencedRelation: "ai_usage_kinds"
      referencedColumns: ["key"]
    }
                  ]
                },"ai_chain_steps": {
                  Row: {
                    "chain_id": string,"model_id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "chain_id": string,"model_id": string,"position": number
                  }
                  Update: {
                    "chain_id"?: string,"model_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_chain_steps_chain_id_fkey"
      columns: ["chain_id"]
isOneToOne: false
      referencedRelation: "ai_chains"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_chain_steps_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "ai_models"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_chains": {
                  Row: {
                    "attempt_seconds": number,"enabled": boolean,"id": string,"name": string,"on_rate_limit": boolean,"on_server_error": boolean,"on_timeout": boolean,"total_seconds": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_seconds"?: number,"enabled"?: boolean,"id"?: string,"name": string,"on_rate_limit"?: boolean,"on_server_error"?: boolean,"on_timeout"?: boolean,"total_seconds"?: number,"updated_at"?: string
                  }
                  Update: {
                    "attempt_seconds"?: number,"enabled"?: boolean,"id"?: string,"name"?: string,"on_rate_limit"?: boolean,"on_server_error"?: boolean,"on_timeout"?: boolean,"total_seconds"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_feature_requirements": {
                  Row: {
                    "action": string,"entry_point": string | null,"feature": string,"input_kind": string,"min_context_tokens": number,"offered": boolean,"plans": (Database["public"]['Enums']["plan_code"])[],"requires_json_schema": boolean,"requires_pdf": boolean,"requires_vision": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"entry_point"?: string | null,"feature": string,"input_kind": string,"min_context_tokens": number,"offered"?: boolean,"plans": (Database["public"]['Enums']["plan_code"])[],"requires_json_schema"?: boolean,"requires_pdf"?: boolean,"requires_vision"?: boolean
                  }
                  Update: {
                    "action"?: string,"entry_point"?: string | null,"feature"?: string,"input_kind"?: string,"min_context_tokens"?: number,"offered"?: boolean,"plans"?: (Database["public"]['Enums']["plan_code"])[],"requires_json_schema"?: boolean,"requires_pdf"?: boolean,"requires_vision"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"ai_models": {
                  Row: {
                    "active": boolean,"adapter": string | null,"context_tokens": number | null,"contract_version": string | null,"cost_class": string,"created_at": string,"display_name": string,"id": string,"input_usd_per_mtok": number | null,"notes": string | null,"output_usd_per_mtok": number | null,"provider": string,"supports_json_schema": boolean,"supports_pdf": boolean,"supports_vision": boolean,"tokenizer": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"adapter"?: string | null,"context_tokens"?: number | null,"contract_version"?: string | null,"cost_class"?: string,"created_at"?: string,"display_name": string,"id": string,"input_usd_per_mtok"?: number | null,"notes"?: string | null,"output_usd_per_mtok"?: number | null,"provider"?: string,"supports_json_schema"?: boolean,"supports_pdf"?: boolean,"supports_vision"?: boolean,"tokenizer"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"adapter"?: string | null,"context_tokens"?: number | null,"contract_version"?: string | null,"cost_class"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"input_usd_per_mtok"?: number | null,"notes"?: string | null,"output_usd_per_mtok"?: number | null,"provider"?: string,"supports_json_schema"?: boolean,"supports_pdf"?: boolean,"supports_vision"?: boolean,"tokenizer"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_models_provider_fkey"
      columns: ["provider"]
isOneToOne: false
      referencedRelation: "ai_providers"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_operation_jobs": {
                  Row: {
                    "action": string,"chain_run_id": string | null,"created_at": string,"error_code": string | null,"family_id": string,"id": string,"input_hash": string,"lease": string,"provider": string | null,"requested_by": string | null,"result": Json | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"chain_run_id"?: string | null,"created_at"?: string,"error_code"?: string | null,"family_id": string,"id"?: string,"input_hash": string,"lease": string,"provider"?: string | null,"requested_by"?: string | null,"result"?: Json | null,"status": string,"updated_at"?: string
                  }
                  Update: {
                    "action"?: string,"chain_run_id"?: string | null,"created_at"?: string,"error_code"?: string | null,"family_id"?: string,"id"?: string,"input_hash"?: string,"lease"?: string,"provider"?: string | null,"requested_by"?: string | null,"result"?: Json | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_operation_jobs_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_operation_jobs_provider_fkey"
      columns: ["provider"]
isOneToOne: false
      referencedRelation: "ai_providers"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_operation_policies": {
                  Row: {
                    "action": string,"enabled": boolean,"max_concurrent": number,"max_media_bytes": number,"max_media_items": number,"monthly_limit": number,"per_minute": number,"plan_code": Database["public"]['Enums']["plan_code"]
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"enabled"?: boolean,"max_concurrent"?: number,"max_media_bytes"?: number,"max_media_items"?: number,"monthly_limit": number,"per_minute"?: number,"plan_code": Database["public"]['Enums']["plan_code"]
                  }
                  Update: {
                    "action"?: string,"enabled"?: boolean,"max_concurrent"?: number,"max_media_bytes"?: number,"max_media_items"?: number,"monthly_limit"?: number,"per_minute"?: number,"plan_code"?: Database["public"]['Enums']["plan_code"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_operation_policies_plan_code_fkey"
      columns: ["plan_code"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["code"]
    }
                  ]
                },"ai_provider_health": {
                  Row: {
                    "failures": number,"open_until": string | null,"provider": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "failures"?: number,"open_until"?: string | null,"provider": string,"updated_at"?: string
                  }
                  Update: {
                    "failures"?: number,"open_until"?: string | null,"provider"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_provider_health_provider_fkey"
      columns: ["provider"]
isOneToOne: true
      referencedRelation: "ai_providers"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_providers": {
                  Row: {
                    "adapter": string,"cost_class": string,"cross_border": boolean,"data_region": string,"display_name": string,"id": string,"key_secret_name": string,"notes": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adapter": string,"cost_class": string,"cross_border"?: boolean,"data_region": string,"display_name": string,"id": string,"key_secret_name": string,"notes"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "adapter"?: string,"cost_class"?: string,"cross_border"?: boolean,"data_region"?: string,"display_name"?: string,"id"?: string,"key_secret_name"?: string,"notes"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_request_attempts": {
                  Row: {
                    "action": string,"created_at": string,"family_id": string,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"family_id": string,"id"?: never
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"family_id"?: string,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_request_attempts_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_settings": {
                  Row: {
                    "enabled": boolean,"max_input_tokens": number,"max_output_tokens": number,"model_id": string | null,"plan_code": Database["public"]['Enums']["plan_code"],"prompt_version": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled"?: boolean,"max_input_tokens"?: number,"max_output_tokens"?: number,"model_id"?: string | null,"plan_code": Database["public"]['Enums']["plan_code"],"prompt_version"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "enabled"?: boolean,"max_input_tokens"?: number,"max_output_tokens"?: number,"model_id"?: string | null,"plan_code"?: Database["public"]['Enums']["plan_code"],"prompt_version"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_settings_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "ai_models"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_settings_plan_code_fkey"
      columns: ["plan_code"]
isOneToOne: true
      referencedRelation: "plans"
      referencedColumns: ["code"]
    }
                  ]
                },"ai_summaries": {
                  Row: {
                    "created_at": string,"error": string | null,"family_id": string,"id": string,"input_hash": string,"input_tokens": number | null,"model": string,"output_json": Json | null,"output_tokens": number | null,"prompt_version": string,"requested_by": string | null,"status": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error"?: string | null,"family_id": string,"id"?: string,"input_hash": string,"input_tokens"?: number | null,"model": string,"output_json"?: Json | null,"output_tokens"?: number | null,"prompt_version"?: string,"requested_by"?: string | null,"status"?: string,"week_start": string
                  }
                  Update: {
                    "created_at"?: string,"error"?: string | null,"family_id"?: string,"id"?: string,"input_hash"?: string,"input_tokens"?: number | null,"model"?: string,"output_json"?: Json | null,"output_tokens"?: number | null,"prompt_version"?: string,"requested_by"?: string | null,"status"?: string,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_summaries_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_usage_kinds": {
                  Row: {
                    "key": string,"label": string
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"label": string
                  }
                  Update: {
                    "key"?: string,"label"?: string
                  }
                  Relationships: [
                    
                  ]
                },"answer_review_consents": {
                  Row: {
                    "actor_id": string | null,"answer_hash": string,"attempt_id": string,"created_at": string,"family_id": string,"id": string,"question_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"answer_hash": string,"attempt_id": string,"created_at"?: string,"family_id": string,"id"?: string,"question_id": string,"version": string
                  }
                  Update: {
                    "actor_id"?: string | null,"answer_hash"?: string,"attempt_id"?: string,"created_at"?: string,"family_id"?: string,"id"?: string,"question_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "answer_review_consents_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "exam_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answer_review_consents_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answer_review_consents_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "current_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answer_review_consents_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answer_review_consents_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "standalone_question_bank"
      referencedColumns: ["id"]
    }
                  ]
                },"answer_review_suggestions": {
                  Row: {
                    "actor_id": string | null,"answer_hash": string,"attempt_id": string,"consent_version": string,"created_at": string,"family_id": string,"id": string,"image_hash": string | null,"job_id": string,"question_id": string,"result": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"answer_hash": string,"attempt_id": string,"consent_version": string,"created_at"?: string,"family_id": string,"id"?: string,"image_hash"?: string | null,"job_id": string,"question_id": string,"result": NonNullable<Json>
                  }
                  Update: {
                    "actor_id"?: string | null,"answer_hash"?: string,"attempt_id"?: string,"consent_version"?: string,"created_at"?: string,"family_id"?: string,"id"?: string,"image_hash"?: string | null,"job_id"?: string,"question_id"?: string,"result"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "answer_review_suggestions_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "exam_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answer_review_suggestions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answer_review_suggestions_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "ai_operation_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answer_review_suggestions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "current_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answer_review_suggestions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answer_review_suggestions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "standalone_question_bank"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"family_id": string | null,"id": number,"reason": string | null,"target_id": string | null,"target_table": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"family_id"?: string | null,"id"?: never,"reason"?: string | null,"target_id"?: string | null,"target_table"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"family_id"?: string | null,"id"?: never,"reason"?: string | null,"target_id"?: string | null,"target_table"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"badge_definitions": {
                  Row: {
                    "active": boolean,"family_id": string | null,"icon": string,"rule": NonNullable<Json>,"slug": string,"sort_order": number,"title_i18n": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"family_id"?: string | null,"icon": string,"rule": NonNullable<Json>,"slug": string,"sort_order"?: number,"title_i18n": NonNullable<Json>
                  }
                  Update: {
                    "active"?: boolean,"family_id"?: string | null,"icon"?: string,"rule"?: NonNullable<Json>,"slug"?: string,"sort_order"?: number,"title_i18n"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "badge_definitions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"beta_plan_events": {
                  Row: {
                    "created_at": string,"family_id": string | null,"id": number,"plan": Database["public"]['Enums']["plan_code"] | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"family_id"?: string | null,"id"?: never,"plan"?: Database["public"]['Enums']["plan_code"] | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"family_id"?: string | null,"id"?: never,"plan"?: Database["public"]['Enums']["plan_code"] | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "beta_plan_events_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"beta_plan_selections": {
                  Row: {
                    "family_id": string,"plan": Database["public"]['Enums']["plan_code"],"selected_by": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "family_id": string,"plan": Database["public"]['Enums']["plan_code"],"selected_by": string,"updated_at"?: string
                  }
                  Update: {
                    "family_id"?: string,"plan"?: Database["public"]['Enums']["plan_code"],"selected_by"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "beta_plan_selections_family_id_fkey"
      columns: ["family_id"]
isOneToOne: true
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"beta_test_access": {
                  Row: {
                    "expires_at": string,"family_id": string,"reason": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at": string,"family_id": string,"reason": string,"user_id": string
                  }
                  Update: {
                    "expires_at"?: string,"family_id"?: string,"reason"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "beta_test_access_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"child_badge_awards": {
                  Row: {
                    "awarded_at": string,"badge_slug": string,"child_id": string,"family_id": string,"source": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "awarded_at"?: string,"badge_slug": string,"child_id": string,"family_id": string,"source"?: Json | null
                  }
                  Update: {
                    "awarded_at"?: string,"badge_slug"?: string,"child_id"?: string,"family_id"?: string,"source"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "child_badge_awards_badge_slug_fkey"
      columns: ["badge_slug"]
isOneToOne: false
      referencedRelation: "badge_definitions"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "child_badge_awards_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_badge_awards_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"child_goals": {
                  Row: {
                    "child_id": string,"created_at": string,"created_by": string | null,"decided_at": string | null,"family_id": string,"id": string,"reward_id": string,"status": Database["public"]['Enums']["child_goal_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"family_id": string,"id"?: string,"reward_id": string,"status"?: Database["public"]['Enums']["child_goal_status"]
                  }
                  Update: {
                    "child_id"?: string,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"family_id"?: string,"id"?: string,"reward_id"?: string,"status"?: Database["public"]['Enums']["child_goal_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "child_goals_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_goals_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_goals_reward_id_fkey"
      columns: ["reward_id"]
isOneToOne: false
      referencedRelation: "family_rewards"
      referencedColumns: ["id"]
    }
                  ]
                },"child_inventory": {
                  Row: {
                    "acquired_at": string,"child_id": string,"display_slot": number | null,"family_id": string,"id": string,"request_id": string,"reward_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acquired_at"?: string,"child_id": string,"display_slot"?: number | null,"family_id": string,"id"?: string,"request_id": string,"reward_id": string
                  }
                  Update: {
                    "acquired_at"?: string,"child_id"?: string,"display_slot"?: number | null,"family_id"?: string,"id"?: string,"request_id"?: string,"reward_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "child_inventory_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_inventory_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_inventory_request_id_fkey"
      columns: ["request_id"]
isOneToOne: true
      referencedRelation: "reward_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_inventory_reward_id_fkey"
      columns: ["reward_id"]
isOneToOne: false
      referencedRelation: "family_rewards"
      referencedColumns: ["id"]
    }
                  ]
                },"child_pins": {
                  Row: {
                    "child_id": string,"failed_count": number,"locked_until": string | null,"pin_hash": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"failed_count"?: number,"locked_until"?: string | null,"pin_hash": string,"updated_at"?: string
                  }
                  Update: {
                    "child_id"?: string,"failed_count"?: number,"locked_until"?: string | null,"pin_hash"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "child_pins_child_id_fkey"
      columns: ["child_id"]
isOneToOne: true
      referencedRelation: "children"
      referencedColumns: ["id"]
    }
                  ]
                },"child_room_preferences": {
                  Row: {
                    "character_key": string,"child_id": string,"family_id": string,"pet_key": string,"theme_key": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "character_key"?: string,"child_id": string,"family_id": string,"pet_key"?: string,"theme_key"?: string,"updated_at"?: string
                  }
                  Update: {
                    "character_key"?: string,"child_id"?: string,"family_id"?: string,"pet_key"?: string,"theme_key"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "child_room_preferences_child_id_fkey"
      columns: ["child_id"]
isOneToOne: true
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_room_preferences_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"child_setup_requests": {
                  Row: {
                    "child_id": string,"created_at": string,"family_id": string,"id": string,"payload": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"created_at"?: string,"family_id": string,"id": string,"payload": NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "child_id"?: string,"created_at"?: string,"family_id"?: string,"id"?: string,"payload"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "child_setup_requests_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_setup_requests_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"child_shares": {
                  Row: {
                    "child_id": string,"created_at": string,"created_by": string | null,"expires_at": string,"family_id": string,"id": string,"label": string,"last_viewed_at": string | null,"outcome_snapshot": Json | null,"revoked_at": string | null,"scopes": (string)[],"token_hash": string,"view_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"family_id": string,"id"?: string,"label": string,"last_viewed_at"?: string | null,"outcome_snapshot"?: Json | null,"revoked_at"?: string | null,"scopes": (string)[],"token_hash": string,"view_count"?: number
                  }
                  Update: {
                    "child_id"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"family_id"?: string,"id"?: string,"label"?: string,"last_viewed_at"?: string | null,"outcome_snapshot"?: Json | null,"revoked_at"?: string | null,"scopes"?: (string)[],"token_hash"?: string,"view_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "child_shares_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_shares_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"children": {
                  Row: {
                    "archive_revision": number,"archived_at": string | null,"avatar": string,"birth_date": string | null,"birth_year": number | null,"created_at": string,"evening_reminder_end": number,"evening_reminder_start": number | null,"family_id": string,"gender": string,"grade": number | null,"id": string,"interests": (string)[],"name": string,"question_reading_enabled": boolean,"sort_order": number,"study_break_minutes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archive_revision"?: number,"archived_at"?: string | null,"avatar"?: string,"birth_date"?: string | null,"birth_year"?: number | null,"created_at"?: string,"evening_reminder_end"?: number,"evening_reminder_start"?: number | null,"family_id": string,"gender"?: string,"grade"?: number | null,"id"?: string,"interests"?: (string)[],"name": string,"question_reading_enabled"?: boolean,"sort_order"?: number,"study_break_minutes"?: number
                  }
                  Update: {
                    "archive_revision"?: number,"archived_at"?: string | null,"avatar"?: string,"birth_date"?: string | null,"birth_year"?: number | null,"created_at"?: string,"evening_reminder_end"?: number,"evening_reminder_start"?: number | null,"family_id"?: string,"gender"?: string,"grade"?: number | null,"id"?: string,"interests"?: (string)[],"name"?: string,"question_reading_enabled"?: boolean,"sort_order"?: number,"study_break_minutes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "children_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"contribution_rewards": {
                  Row: {
                    "amount": number,"enabled": boolean,"id": string,"kind": string,"plan": Database["public"]['Enums']["plan_code"] | null,"threshold": number,"title": string,"valid_days": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"enabled"?: boolean,"id"?: string,"kind": string,"plan"?: Database["public"]['Enums']["plan_code"] | null,"threshold": number,"title": string,"valid_days": number
                  }
                  Update: {
                    "amount"?: number,"enabled"?: boolean,"id"?: string,"kind"?: string,"plan"?: Database["public"]['Enums']["plan_code"] | null,"threshold"?: number,"title"?: string,"valid_days"?: number
                  }
                  Relationships: [
                    
                  ]
                },"device_children": {
                  Row: {
                    "child_id": string,"device_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"device_id": string
                  }
                  Update: {
                    "child_id"?: string,"device_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_children_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "device_children_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    }
                  ]
                },"device_pairing_attempts": {
                  Row: {
                    "family_id": string | null,"id": number,"ok": boolean,"tried_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "family_id"?: string | null,"id"?: never,"ok": boolean,"tried_at"?: string,"user_id": string
                  }
                  Update: {
                    "family_id"?: string | null,"id"?: never,"ok"?: boolean,"tried_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_pairing_attempts_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"device_pairing_locks": {
                  Row: {
                    "locked_until": string,"scope": string,"subject": string
                  }
                  ComputedFields: never
                  Insert: {
                    "locked_until": string,"scope": string,"subject": string
                  }
                  Update: {
                    "locked_until"?: string,"scope"?: string,"subject"?: string
                  }
                  Relationships: [
                    
                  ]
                },"device_pairing_previews": {
                  Row: {
                    "code": string,"created_at": string,"expires_at": string,"family_id": string,"token": string,"used_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"expires_at": string,"family_id": string,"token"?: string,"used_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"expires_at"?: string,"family_id"?: string,"token"?: string,"used_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_pairing_previews_code_fkey"
      columns: ["code"]
isOneToOne: false
      referencedRelation: "device_pairings"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "device_pairing_previews_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"device_pairings": {
                  Row: {
                    "auth_user_id": string,"code": string,"consumed_at": string | null,"device_name": string,"expires_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_user_id": string,"code": string,"consumed_at"?: string | null,"device_name"?: string,"expires_at"?: string
                  }
                  Update: {
                    "auth_user_id"?: string,"code"?: string,"consumed_at"?: string | null,"device_name"?: string,"expires_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"devices": {
                  Row: {
                    "access_mode": string,"active_child_id": string | null,"auth_user_id": string,"family_id": string,"id": string,"last_seen_at": string | null,"name": string,"paired_at": string,"pin_policy": string,"question_types": (string)[] | null,"question_types_at": string | null,"revoked_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "access_mode"?: string,"active_child_id"?: string | null,"auth_user_id": string,"family_id": string,"id"?: string,"last_seen_at"?: string | null,"name"?: string,"paired_at"?: string,"pin_policy"?: string,"question_types"?: (string)[] | null,"question_types_at"?: string | null,"revoked_at"?: string | null
                  }
                  Update: {
                    "access_mode"?: string,"active_child_id"?: string | null,"auth_user_id"?: string,"family_id"?: string,"id"?: string,"last_seen_at"?: string | null,"name"?: string,"paired_at"?: string,"pin_policy"?: string,"question_types"?: (string)[] | null,"question_types_at"?: string | null,"revoked_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "devices_active_child_id_fkey"
      columns: ["active_child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "devices_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"entitlement_overrides": {
                  Row: {
                    "created_at": string,"ends_at": string,"family_id": string,"granted_by": string | null,"id": string,"plan": Database["public"]['Enums']["plan_code"],"reason": string,"revoked_at": string | null,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_at": string,"family_id": string,"granted_by"?: string | null,"id"?: string,"plan": Database["public"]['Enums']["plan_code"],"reason": string,"revoked_at"?: string | null,"starts_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string,"family_id"?: string,"granted_by"?: string | null,"id"?: string,"plan"?: Database["public"]['Enums']["plan_code"],"reason"?: string,"revoked_at"?: string | null,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entitlement_overrides_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"event_exceptions": {
                  Row: {
                    "cancelled": boolean,"event_id": string,"occurrence_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled"?: boolean,"event_id": string,"occurrence_date": string
                  }
                  Update: {
                    "cancelled"?: boolean,"event_id"?: string,"occurrence_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_exceptions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "all_day": boolean,"archived_at": string | null,"child_id": string | null,"created_at": string,"created_by": string | null,"edit_revision": number,"ends_at": string | null,"family_id": string,"id": string,"location": string | null,"notes": string | null,"rrule": string | null,"starts_at": string,"timetable_entry_key": string | null,"title": string,"type": Database["public"]['Enums']["event_type"],"updated_at": string,"visible_to_child": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "all_day"?: boolean,"archived_at"?: string | null,"child_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"edit_revision"?: number,"ends_at"?: string | null,"family_id": string,"id"?: string,"location"?: string | null,"notes"?: string | null,"rrule"?: string | null,"starts_at": string,"timetable_entry_key"?: string | null,"title": string,"type"?: Database["public"]['Enums']["event_type"],"updated_at"?: string,"visible_to_child"?: boolean
                  }
                  Update: {
                    "all_day"?: boolean,"archived_at"?: string | null,"child_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"edit_revision"?: number,"ends_at"?: string | null,"family_id"?: string,"id"?: string,"location"?: string | null,"notes"?: string | null,"rrule"?: string | null,"starts_at"?: string,"timetable_entry_key"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["event_type"],"updated_at"?: string,"visible_to_child"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_answers": {
                  Row: {
                    "ai_details": Json | null,"ai_feedback": string | null,"ai_graded_at": string | null,"ai_score": number | null,"answer": Json | null,"answer_document": Json | null,"answer_key": string | null,"answer_text": string | null,"answered_at": string,"attempt_id": string,"edit_revision": number,"feedback": string | null,"graded_at": string | null,"graded_by": string | null,"is_correct": boolean | null,"question_id": string,"review_ai_id": string | null,"review_document": Json | null,"review_revision": number,"score": number | null,"score_details": Json | null,"score_exact": number | null,"scored_policy": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_details"?: Json | null,"ai_feedback"?: string | null,"ai_graded_at"?: string | null,"ai_score"?: number | null,"answer"?: Json | null,"answer_document"?: Json | null,"answer_key"?: string | null,"answer_text"?: string | null,"answered_at"?: string,"attempt_id": string,"edit_revision"?: number,"feedback"?: string | null,"graded_at"?: string | null,"graded_by"?: string | null,"is_correct"?: boolean | null,"question_id": string,"review_ai_id"?: string | null,"review_document"?: Json | null,"review_revision"?: number,"score"?: number | null,"score_details"?: Json | null,"score_exact"?: number | null,"scored_policy"?: string | null
                  }
                  Update: {
                    "ai_details"?: Json | null,"ai_feedback"?: string | null,"ai_graded_at"?: string | null,"ai_score"?: number | null,"answer"?: Json | null,"answer_document"?: Json | null,"answer_key"?: string | null,"answer_text"?: string | null,"answered_at"?: string,"attempt_id"?: string,"edit_revision"?: number,"feedback"?: string | null,"graded_at"?: string | null,"graded_by"?: string | null,"is_correct"?: boolean | null,"question_id"?: string,"review_ai_id"?: string | null,"review_document"?: Json | null,"review_revision"?: number,"score"?: number | null,"score_details"?: Json | null,"score_exact"?: number | null,"scored_policy"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_answers_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "exam_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "current_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "standalone_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_ai_reference"
      columns: ["review_ai_id"]
isOneToOne: false
      referencedRelation: "answer_review_suggestions"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_attempts": {
                  Row: {
                    "ai_feedback": Json | null,"child_id": string,"created_at": string,"deadline_at": string | null,"exam_id": string,"family_id": string,"finished_at": string | null,"graded_at": string | null,"id": string,"items_partial": number | null,"items_pending": number | null,"items_scored": number | null,"items_total": number | null,"items_unanswered": number | null,"mc_correct": number | null,"mc_total": number | null,"open_graded": number | null,"open_pending": number | null,"open_total": number | null,"open_unanswered": number | null,"provisional": boolean | null,"score_pct": number | null,"started_at": string,"status": Database["public"]['Enums']["attempt_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_feedback"?: Json | null,"child_id": string,"created_at"?: string,"deadline_at"?: string | null,"exam_id": string,"family_id": string,"finished_at"?: string | null,"graded_at"?: string | null,"id"?: string,"items_partial"?: number | null,"items_pending"?: number | null,"items_scored"?: number | null,"items_total"?: number | null,"items_unanswered"?: number | null,"mc_correct"?: number | null,"mc_total"?: number | null,"open_graded"?: number | null,"open_pending"?: number | null,"open_total"?: number | null,"open_unanswered"?: number | null,"provisional"?: boolean | null,"score_pct"?: number | null,"started_at"?: string,"status"?: Database["public"]['Enums']["attempt_status"]
                  }
                  Update: {
                    "ai_feedback"?: Json | null,"child_id"?: string,"created_at"?: string,"deadline_at"?: string | null,"exam_id"?: string,"family_id"?: string,"finished_at"?: string | null,"graded_at"?: string | null,"id"?: string,"items_partial"?: number | null,"items_pending"?: number | null,"items_scored"?: number | null,"items_total"?: number | null,"items_unanswered"?: number | null,"mc_correct"?: number | null,"mc_total"?: number | null,"open_graded"?: number | null,"open_pending"?: number | null,"open_total"?: number | null,"open_unanswered"?: number | null,"provisional"?: boolean | null,"score_pct"?: number | null,"started_at"?: string,"status"?: Database["public"]['Enums']["attempt_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_attempts_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_attempts_exam_id_fkey"
      columns: ["exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_attempts_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_blueprints": {
                  Row: {
                    "created_at": string,"created_by": string | null,"distribution_kind": string,"family_id": string,"grade": number,"id": string,"name": string,"official_source_verified": boolean,"official_verified_at": string | null,"personalization": Json | null,"provenance_corrected_at": string | null,"rows": NonNullable<Json>,"school_confirmed": boolean,"school_scenario": string,"source_context": NonNullable<Json>,"source_url": string | null,"subject": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"distribution_kind"?: string,"family_id": string,"grade": number,"id"?: string,"name": string,"official_source_verified"?: boolean,"official_verified_at"?: string | null,"personalization"?: Json | null,"provenance_corrected_at"?: string | null,"rows"?: NonNullable<Json>,"school_confirmed"?: boolean,"school_scenario"?: string,"source_context"?: NonNullable<Json>,"source_url"?: string | null,"subject": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"distribution_kind"?: string,"family_id"?: string,"grade"?: number,"id"?: string,"name"?: string,"official_source_verified"?: boolean,"official_verified_at"?: string | null,"personalization"?: Json | null,"provenance_corrected_at"?: string | null,"rows"?: NonNullable<Json>,"school_confirmed"?: boolean,"school_scenario"?: string,"source_context"?: NonNullable<Json>,"source_url"?: string | null,"subject"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_blueprints_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"exams": {
                  Row: {
                    "academic_year": number | null,"assessment_track": string | null,"blueprint_id": string | null,"child_id": string,"content_locked_at": string | null,"created_at": string,"created_by": string | null,"duration_minutes": number | null,"education_context": Json | null,"education_period_id": string | null,"exam_scope": string | null,"family_id": string,"grade": number,"id": string,"kind": string,"preparation": Json | null,"question_ids": (string)[],"question_reading_override": string,"school_declared": boolean | null,"status": Database["public"]['Enums']["exam_status"],"subject": string,"subject_links": Json | null,"term": number | null,"timed": boolean,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year"?: number | null,"assessment_track"?: string | null,"blueprint_id"?: string | null,"child_id": string,"content_locked_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"duration_minutes"?: number | null,"education_context"?: Json | null,"education_period_id"?: string | null,"exam_scope"?: string | null,"family_id": string,"grade": number,"id"?: string,"kind"?: string,"preparation"?: Json | null,"question_ids"?: (string)[],"question_reading_override"?: string,"school_declared"?: boolean | null,"status"?: Database["public"]['Enums']["exam_status"],"subject": string,"subject_links"?: Json | null,"term"?: number | null,"timed"?: boolean,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "academic_year"?: number | null,"assessment_track"?: string | null,"blueprint_id"?: string | null,"child_id"?: string,"content_locked_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"duration_minutes"?: number | null,"education_context"?: Json | null,"education_period_id"?: string | null,"exam_scope"?: string | null,"family_id"?: string,"grade"?: number,"id"?: string,"kind"?: string,"preparation"?: Json | null,"question_ids"?: (string)[],"question_reading_override"?: string,"school_declared"?: boolean | null,"status"?: Database["public"]['Enums']["exam_status"],"subject"?: string,"subject_links"?: Json | null,"term"?: number | null,"timed"?: boolean,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exams_blueprint_id_fkey"
      columns: ["blueprint_id"]
isOneToOne: false
      referencedRelation: "exam_blueprints"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exams_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exams_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"families": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"invite_code": string,"locale": string,"name": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"id"?: string,"invite_code"?: string,"locale"?: string,"name": string,"timezone"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"invite_code"?: string,"locale"?: string,"name"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"family_invite_attempts": {
                  Row: {
                    "tried_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "tried_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "tried_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"family_members": {
                  Row: {
                    "created_at": string,"display_name": string | null,"family_id": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"family_id": string,"role"?: Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"family_id"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_members_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"family_rewards": {
                  Row: {
                    "active": boolean,"archived_at": string | null,"cost_stars": number,"created_at": string,"created_by": string | null,"family_id": string,"icon": string,"id": string,"revision": number,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"archived_at"?: string | null,"cost_stars": number,"created_at"?: string,"created_by"?: string | null,"family_id": string,"icon"?: string,"id"?: string,"revision"?: number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"archived_at"?: string | null,"cost_stars"?: number,"created_at"?: string,"created_by"?: string | null,"family_id"?: string,"icon"?: string,"id"?: string,"revision"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_rewards_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"family_room_settings": {
                  Row: {
                    "city_id": string | null,"family_id": string,"motion_enabled": boolean,"sound_enabled": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city_id"?: string | null,"family_id": string,"motion_enabled"?: boolean,"sound_enabled"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "city_id"?: string | null,"family_id"?: string,"motion_enabled"?: boolean,"sound_enabled"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_room_settings_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "weather_cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "family_room_settings_family_id_fkey"
      columns: ["family_id"]
isOneToOne: true
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"generation_credit_allocations": {
                  Row: {
                    "consumed": number,"grant_id": string | null,"id": string,"job_id": string,"units": number
                  }
                  ComputedFields: never
                  Insert: {
                    "consumed"?: number,"grant_id"?: string | null,"id"?: string,"job_id": string,"units": number
                  }
                  Update: {
                    "consumed"?: number,"grant_id"?: string | null,"id"?: string,"job_id"?: string,"units"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "generation_credit_allocations_grant_id_fkey"
      columns: ["grant_id"]
isOneToOne: false
      referencedRelation: "learning_credit_grants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "generation_credit_allocations_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "prova_generation_jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"grades": {
                  Row: {
                    "child_id": string,"created_at": string,"education_context": Json | null,"family_id": string,"graded_on": string,"id": string,"kind": Database["public"]['Enums']["grade_kind"],"max_score": number,"note": string | null,"revision": number,"score": number,"subject": string,"withdrawn_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"created_at"?: string,"education_context"?: Json | null,"family_id": string,"graded_on"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["grade_kind"],"max_score"?: number,"note"?: string | null,"revision"?: number,"score": number,"subject": string,"withdrawn_at"?: string | null
                  }
                  Update: {
                    "child_id"?: string,"created_at"?: string,"education_context"?: Json | null,"family_id"?: string,"graded_on"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["grade_kind"],"max_score"?: number,"note"?: string | null,"revision"?: number,"score"?: number,"subject"?: string,"withdrawn_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "grades_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grades_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"group_exam_entries": {
                  Row: {
                    "alias": string,"child_id": string,"consent_version": string,"created_at": string,"enrolled_by": string | null,"exam_id": string,"family_id": string,"group_id": string,"id": string,"ranking_consent": boolean,"review_consent_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alias": string,"child_id": string,"consent_version": string,"created_at"?: string,"enrolled_by"?: string | null,"exam_id": string,"family_id": string,"group_id": string,"id"?: string,"ranking_consent"?: boolean,"review_consent_at"?: string | null
                  }
                  Update: {
                    "alias"?: string,"child_id"?: string,"consent_version"?: string,"created_at"?: string,"enrolled_by"?: string | null,"exam_id"?: string,"family_id"?: string,"group_id"?: string,"id"?: string,"ranking_consent"?: boolean,"review_consent_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_exam_entries_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_exam_entries_exam_id_fkey"
      columns: ["exam_id"]
isOneToOne: true
      referencedRelation: "exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_exam_entries_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_exam_entries_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "group_exams"
      referencedColumns: ["id"]
    }
                  ]
                },"group_exam_entry_questions": {
                  Row: {
                    "entry_id": string,"ord": number,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "entry_id": string,"ord": number,"question_id": string
                  }
                  Update: {
                    "entry_id"?: string,"ord"?: number,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_exam_entry_questions_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "group_exam_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_exam_entry_questions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "current_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_exam_entry_questions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_exam_entry_questions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "standalone_question_bank"
      referencedColumns: ["id"]
    }
                  ]
                },"group_exam_questions": {
                  Row: {
                    "content": NonNullable<Json>,"group_id": string,"ord": number
                  }
                  ComputedFields: never
                  Insert: {
                    "content": NonNullable<Json>,"group_id": string,"ord": number
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"group_id"?: string,"ord"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_exam_questions_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "group_exams"
      referencedColumns: ["id"]
    }
                  ]
                },"group_exams": {
                  Row: {
                    "collection_id": string | null,"created_at": string,"created_by": string | null,"creation_intent": NonNullable<Json>,"curriculum_version": string,"duration_minutes": number,"ends_at": string,"grade": number,"id": string,"package_id": string | null,"plans": (Database["public"]['Enums']["plan_code"])[],"requires_review": boolean,"starts_at": string,"status": string,"subject": string,"title": string,"version_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "collection_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"creation_intent": NonNullable<Json>,"curriculum_version": string,"duration_minutes": number,"ends_at": string,"grade": number,"id": string,"package_id"?: string | null,"plans": (Database["public"]['Enums']["plan_code"])[],"requires_review"?: boolean,"starts_at": string,"status"?: string,"subject": string,"title": string,"version_hash": string
                  }
                  Update: {
                    "collection_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"creation_intent"?: NonNullable<Json>,"curriculum_version"?: string,"duration_minutes"?: number,"ends_at"?: string,"grade"?: number,"id"?: string,"package_id"?: string | null,"plans"?: (Database["public"]['Enums']["plan_code"])[],"requires_review"?: boolean,"starts_at"?: string,"status"?: string,"subject"?: string,"title"?: string,"version_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_exams_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "library_collections"
      referencedColumns: ["id"]
    }
                  ]
                },"guided_input_options": {
                  Row: {
                    "active": boolean,"id": string,"kind": string,"label_en": string,"label_tr": string,"max_grade": number,"min_grade": number,"position": number,"revision": number,"subject": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"id": string,"kind": string,"label_en": string,"label_tr": string,"max_grade"?: number,"min_grade"?: number,"position"?: number,"revision"?: number,"subject"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"id"?: string,"kind"?: string,"label_en"?: string,"label_tr"?: string,"max_grade"?: number,"min_grade"?: number,"position"?: number,"revision"?: number,"subject"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"help_article_versions": {
                  Row: {
                    "article_id": string,"body": string,"created_at": string,"created_by": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"revision": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "article_id": string,"body": string,"created_at"?: string,"created_by"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"revision": number,"title": string
                  }
                  Update: {
                    "article_id"?: string,"body"?: string,"created_at"?: string,"created_by"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"revision"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "help_article_versions_article_id_fkey"
      columns: ["article_id"]
isOneToOne: false
      referencedRelation: "help_articles"
      referencedColumns: ["id"]
    }
                  ]
                },"help_articles": {
                  Row: {
                    "id": string,"locale": string,"platform": string,"published_revision": number | null,"revision": number,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"locale": string,"platform": string,"published_revision"?: number | null,"revision": number,"slug": string
                  }
                  Update: {
                    "id"?: string,"locale"?: string,"platform"?: string,"published_revision"?: number | null,"revision"?: number,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "help_articles_id_published_revision_fkey"
      columns: ["id","published_revision"]
isOneToOne: false
      referencedRelation: "help_article_versions"
      referencedColumns: ["article_id","revision"]
    }
                  ]
                },"help_attachments": {
                  Row: {
                    "bytes": number,"created_at": string,"created_by": string | null,"data": string,"family_id": string,"height": number | null,"id": string,"mime": string,"redaction": NonNullable<Json>,"sha256": string,"ticket_id": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bytes": number,"created_at"?: string,"created_by"?: string | null,"data": string,"family_id": string,"height"?: number | null,"id": string,"mime": string,"redaction": NonNullable<Json>,"sha256": string,"ticket_id": string,"width"?: number | null
                  }
                  Update: {
                    "bytes"?: number,"created_at"?: string,"created_by"?: string | null,"data"?: string,"family_id"?: string,"height"?: number | null,"id"?: string,"mime"?: string,"redaction"?: NonNullable<Json>,"sha256"?: string,"ticket_id"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "help_attachments_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "help_attachments_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "help_tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"help_messages": {
                  Row: {
                    "author_id": string | null,"author_role": string,"body": string,"created_at": string,"sequence": number,"ticket_id": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"author_role": string,"body": string,"created_at"?: string,"sequence"?: never,"ticket_id": string,"visibility": string
                  }
                  Update: {
                    "author_id"?: string | null,"author_role"?: string,"body"?: string,"created_at"?: string,"sequence"?: never,"ticket_id"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "help_messages_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "help_tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"help_receipts": {
                  Row: {
                    "actor_id": string,"family_id": string | null,"payload_hash": string,"request_id": string,"result": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"family_id"?: string | null,"payload_hash": string,"request_id": string,"result": NonNullable<Json>
                  }
                  Update: {
                    "actor_id"?: string,"family_id"?: string | null,"payload_hash"?: string,"request_id"?: string,"result"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "help_receipts_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"help_tickets": {
                  Row: {
                    "assigned_at": string | null,"assignee_id": string | null,"category": string,"created_at": string,"created_by": string | null,"family_id": string,"id": string,"idea_stage": string | null,"kind": string,"revision": number,"similar_to": string | null,"status": string,"subject": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string | null,"assignee_id"?: string | null,"category": string,"created_at"?: string,"created_by"?: string | null,"family_id": string,"id"?: string,"idea_stage"?: string | null,"kind": string,"revision"?: number,"similar_to"?: string | null,"status"?: string,"subject": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_at"?: string | null,"assignee_id"?: string | null,"category"?: string,"created_at"?: string,"created_by"?: string | null,"family_id"?: string,"id"?: string,"idea_stage"?: string | null,"kind"?: string,"revision"?: number,"similar_to"?: string | null,"status"?: string,"subject"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "help_tickets_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "help_tickets_similar_to_fkey"
      columns: ["similar_to"]
isOneToOne: false
      referencedRelation: "help_tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"holidays": {
                  Row: {
                    "country": string,"ends_on": string,"id": string,"kind": string,"name": NonNullable<Json>,"school_year": string | null,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string,"ends_on": string,"id"?: string,"kind": string,"name": NonNullable<Json>,"school_year"?: string | null,"starts_on": string
                  }
                  Update: {
                    "country"?: string,"ends_on"?: string,"id"?: string,"kind"?: string,"name"?: NonNullable<Json>,"school_year"?: string | null,"starts_on"?: string
                  }
                  Relationships: [
                    
                  ]
                },"interaction_types": {
                  Row: {
                    "auto_scorable": boolean,"created_at": string,"enabled": boolean,"family": string,"phase": string,"policy": string,"policy_version": number,"practice_only": boolean,"schema_version": number,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_scorable": boolean,"created_at"?: string,"enabled"?: boolean,"family": string,"phase": string,"policy": string,"policy_version": number,"practice_only": boolean,"schema_version": number,"type": string
                  }
                  Update: {
                    "auto_scorable"?: boolean,"created_at"?: string,"enabled"?: boolean,"family"?: string,"phase"?: string,"policy"?: string,"policy_version"?: number,"practice_only"?: boolean,"schema_version"?: number,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"learning_credit_grants": {
                  Row: {
                    "amount": number,"ends_at": string,"family_id": string,"id": string,"kind": string,"milestone": number | null,"policy_id": string | null,"reason": string,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"ends_at": string,"family_id": string,"id"?: string,"kind": string,"milestone"?: number | null,"policy_id"?: string | null,"reason": string,"starts_at"?: string
                  }
                  Update: {
                    "amount"?: number,"ends_at"?: string,"family_id"?: string,"id"?: string,"kind"?: string,"milestone"?: number | null,"policy_id"?: string | null,"reason"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "learning_credit_grants_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learning_credit_grants_policy_id_fkey"
      columns: ["policy_id"]
isOneToOne: false
      referencedRelation: "contribution_rewards"
      referencedColumns: ["id"]
    }
                  ]
                },"learning_source_ai_consents": {
                  Row: {
                    "actor_id": string,"created_at": string,"family_id": string,"purpose": string,"scope_id": string,"source_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"created_at"?: string,"family_id": string,"purpose": string,"scope_id": string,"source_id": string,"version": string
                  }
                  Update: {
                    "actor_id"?: string,"created_at"?: string,"family_id"?: string,"purpose"?: string,"scope_id"?: string,"source_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "learning_source_ai_consents_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learning_source_ai_consents_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "learning_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"learning_source_links": {
                  Row: {
                    "alt": string,"created_at": string,"goal_id": string | null,"id": string,"question_id": string | null,"reward_id": string | null,"source_id": string,"task_id": string | null,"timetable_child_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt"?: string,"created_at"?: string,"goal_id"?: string | null,"id"?: string,"question_id"?: string | null,"reward_id"?: string | null,"source_id": string,"task_id"?: string | null,"timetable_child_id"?: string | null
                  }
                  Update: {
                    "alt"?: string,"created_at"?: string,"goal_id"?: string | null,"id"?: string,"question_id"?: string | null,"reward_id"?: string | null,"source_id"?: string,"task_id"?: string | null,"timetable_child_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "learning_source_links_goal_id_fkey"
      columns: ["goal_id"]
isOneToOne: false
      referencedRelation: "child_goals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learning_source_links_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "current_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learning_source_links_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learning_source_links_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "standalone_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learning_source_links_reward_id_fkey"
      columns: ["reward_id"]
isOneToOne: false
      referencedRelation: "family_rewards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learning_source_links_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "learning_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learning_source_links_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "task_templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learning_source_links_timetable_child_id_fkey"
      columns: ["timetable_child_id"]
isOneToOne: false
      referencedRelation: "school_timetables"
      referencedColumns: ["child_id"]
    }
                  ]
                },"learning_source_sets": {
                  Row: {
                    "anchor_id": string,"created_at": string,"family_id": string,"pages": number,"source_ids": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor_id": string,"created_at"?: string,"family_id": string,"pages": number,"source_ids": (string)[]
                  }
                  Update: {
                    "anchor_id"?: string,"created_at"?: string,"family_id"?: string,"pages"?: number,"source_ids"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "learning_source_sets_anchor_id_fkey"
      columns: ["anchor_id"]
isOneToOne: true
      referencedRelation: "learning_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learning_source_sets_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"learning_sources": {
                  Row: {
                    "bytes": number,"created_at": string,"family_id": string,"height": number | null,"id": string,"kind": string,"mime": string,"name": string,"object_path": string,"pages": number | null,"sha256": string,"status": string,"storage_consent": string,"uploaded_by": string | null,"verified_at": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bytes": number,"created_at"?: string,"family_id": string,"height"?: number | null,"id": string,"kind": string,"mime": string,"name": string,"object_path": string,"pages"?: number | null,"sha256": string,"status"?: string,"storage_consent": string,"uploaded_by"?: string | null,"verified_at"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "bytes"?: number,"created_at"?: string,"family_id"?: string,"height"?: number | null,"id"?: string,"kind"?: string,"mime"?: string,"name"?: string,"object_path"?: string,"pages"?: number | null,"sha256"?: string,"status"?: string,"storage_consent"?: string,"uploaded_by"?: string | null,"verified_at"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "learning_sources_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"library_collections": {
                  Row: {
                    "created_at": string,"curriculum_version": string,"description": string,"grade": number,"id": string,"plans": (Database["public"]['Enums']["plan_code"])[],"status": string,"subject": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"curriculum_version"?: string,"description"?: string,"grade": number,"id"?: string,"plans"?: (Database["public"]['Enums']["plan_code"])[],"status"?: string,"subject": string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"curriculum_version"?: string,"description"?: string,"grade"?: number,"id"?: string,"plans"?: (Database["public"]['Enums']["plan_code"])[],"status"?: string,"subject"?: string,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"library_items": {
                  Row: {
                    "collection_id": string,"content": NonNullable<Json>,"content_hash": string,"created_at": string,"id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "collection_id": string,"content": NonNullable<Json>,"content_hash": string,"created_at"?: string,"id"?: string,"status"?: string
                  }
                  Update: {
                    "collection_id"?: string,"content"?: NonNullable<Json>,"content_hash"?: string,"created_at"?: string,"id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "library_items_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "library_collections"
      referencedColumns: ["id"]
    }
                  ]
                },"library_redemptions": {
                  Row: {
                    "created_at": string,"credit_grant_id": string | null,"family_id": string,"item_id": string,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"credit_grant_id"?: string | null,"family_id": string,"item_id": string,"question_id": string
                  }
                  Update: {
                    "created_at"?: string,"credit_grant_id"?: string | null,"family_id"?: string,"item_id"?: string,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "library_redemptions_credit_grant_id_fkey"
      columns: ["credit_grant_id"]
isOneToOne: false
      referencedRelation: "learning_credit_grants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_redemptions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_redemptions_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "library_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_redemptions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "current_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_redemptions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_redemptions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "standalone_question_bank"
      referencedColumns: ["id"]
    }
                  ]
                },"mutation_receipts": {
                  Row: {
                    "actor_id": string,"created_at": string,"family_id": string,"operation": string,"payload": NonNullable<Json>,"request_id": string,"result": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"created_at"?: string,"family_id": string,"operation": string,"payload": NonNullable<Json>,"request_id": string,"result": NonNullable<Json>
                  }
                  Update: {
                    "actor_id"?: string,"created_at"?: string,"family_id"?: string,"operation"?: string,"payload"?: NonNullable<Json>,"request_id"?: string,"result"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "mutation_receipts_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"note_sync": {
                  Row: {
                    "family_id": string,"revision": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "family_id": string,"revision"?: number,"user_id": string
                  }
                  Update: {
                    "family_id"?: string,"revision"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "note_sync_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "archived_at": string | null,"author_child_id": string | null,"author_user_id": string | null,"body": string,"child_id": string | null,"created_at": string,"family_id": string,"id": string,"revision": number,"subject": string | null,"title": string | null,"updated_at": string,"visibility": Database["public"]['Enums']["note_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"author_child_id"?: string | null,"author_user_id"?: string | null,"body"?: string,"child_id"?: string | null,"created_at"?: string,"family_id": string,"id"?: string,"revision"?: number,"subject"?: string | null,"title"?: string | null,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["note_visibility"]
                  }
                  Update: {
                    "archived_at"?: string | null,"author_child_id"?: string | null,"author_user_id"?: string | null,"body"?: string,"child_id"?: string | null,"created_at"?: string,"family_id"?: string,"id"?: string,"revision"?: number,"subject"?: string | null,"title"?: string | null,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["note_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "notes_author_child_id_fkey"
      columns: ["author_child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notes_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notes_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"operations_members": {
                  Row: {
                    "expires_at": string,"granted_by": string | null,"revoked_at": string | null,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at": string,"granted_by"?: string | null,"revoked_at"?: string | null,"role": string,"user_id": string
                  }
                  Update: {
                    "expires_at"?: string,"granted_by"?: string | null,"revoked_at"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"parent_pins": {
                  Row: {
                    "failed_count": number,"family_id": string,"locked_until": string | null,"pin_hash": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "failed_count"?: number,"family_id": string,"locked_until"?: string | null,"pin_hash": string,"updated_at"?: string
                  }
                  Update: {
                    "failed_count"?: number,"family_id"?: string,"locked_until"?: string | null,"pin_hash"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "parent_pins_family_id_fkey"
      columns: ["family_id"]
isOneToOne: true
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_products": {
                  Row: {
                    "active": boolean,"android_base_plan_id": string | null,"android_offer_id": string | null,"android_product_id": string | null,"period": Database["public"]['Enums']["billing_period"],"plan": Database["public"]['Enums']["plan_code"],"platform": Database["public"]['Enums']["store_platform"] | null,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"android_base_plan_id"?: string | null,"android_offer_id"?: string | null,"android_product_id"?: string | null,"period": Database["public"]['Enums']["billing_period"],"plan": Database["public"]['Enums']["plan_code"],"platform"?: Database["public"]['Enums']["store_platform"] | null,"product_id": string
                  }
                  Update: {
                    "active"?: boolean,"android_base_plan_id"?: string | null,"android_offer_id"?: string | null,"android_product_id"?: string | null,"period"?: Database["public"]['Enums']["billing_period"],"plan"?: Database["public"]['Enums']["plan_code"],"platform"?: Database["public"]['Enums']["store_platform"] | null,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_products_plan_fkey"
      columns: ["plan"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["code"]
    }
                  ]
                },"plans": {
                  Row: {
                    "ai_model": string | null,"ai_weekly": boolean,"code": Database["public"]['Enums']["plan_code"],"cohort_monthly": number,"history_days": number | null,"library_monthly": number,"max_active_tasks_per_child": number | null,"max_children": number,"max_devices": number | null,"max_notes": number | null,"name_i18n": NonNullable<Json>,"prova_ai_generate_monthly": number,"prova_ai_grading": boolean,"prova_booklet": boolean,"prova_monthly_exams": number | null,"prova_scenarios": boolean,"prova_study_plan": boolean,"setup_ai_monthly": number,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_model"?: string | null,"ai_weekly"?: boolean,"code": Database["public"]['Enums']["plan_code"],"cohort_monthly"?: number,"history_days"?: number | null,"library_monthly"?: number,"max_active_tasks_per_child"?: number | null,"max_children": number,"max_devices"?: number | null,"max_notes"?: number | null,"name_i18n": NonNullable<Json>,"prova_ai_generate_monthly"?: number,"prova_ai_grading"?: boolean,"prova_booklet"?: boolean,"prova_monthly_exams"?: number | null,"prova_scenarios"?: boolean,"prova_study_plan"?: boolean,"setup_ai_monthly"?: number,"sort_order"?: number
                  }
                  Update: {
                    "ai_model"?: string | null,"ai_weekly"?: boolean,"code"?: Database["public"]['Enums']["plan_code"],"cohort_monthly"?: number,"history_days"?: number | null,"library_monthly"?: number,"max_active_tasks_per_child"?: number | null,"max_children"?: number,"max_devices"?: number | null,"max_notes"?: number | null,"name_i18n"?: NonNullable<Json>,"prova_ai_generate_monthly"?: number,"prova_ai_grading"?: boolean,"prova_booklet"?: boolean,"prova_monthly_exams"?: number | null,"prova_scenarios"?: boolean,"prova_study_plan"?: boolean,"setup_ai_monthly"?: number,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"prova_ai_usage": {
                  Row: {
                    "action": string,"created_at": string,"family_id": string,"id": string,"input_tokens": number | null,"items": number,"model": string | null,"operation_id": string | null,"output_tokens": number | null,"requested_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"family_id": string,"id"?: string,"input_tokens"?: number | null,"items"?: number,"model"?: string | null,"operation_id"?: string | null,"output_tokens"?: number | null,"requested_by"?: string | null
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"family_id"?: string,"id"?: string,"input_tokens"?: number | null,"items"?: number,"model"?: string | null,"operation_id"?: string | null,"output_tokens"?: number | null,"requested_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "prova_ai_usage_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prova_ai_usage_operation_id_fkey"
      columns: ["operation_id"]
isOneToOne: true
      referencedRelation: "ai_operation_jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"prova_drafts": {
                  Row: {
                    "content": NonNullable<Json>,"created_at": string,"created_by": string | null,"discarded_at": string | null,"exam_id": string | null,"family_id": string,"id": string,"submitted_at": string | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "content": NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"discarded_at"?: string | null,"exam_id"?: string | null,"family_id": string,"id": string,"submitted_at"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"discarded_at"?: string | null,"exam_id"?: string | null,"family_id"?: string,"id"?: string,"submitted_at"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "prova_drafts_exam_id_fkey"
      columns: ["exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prova_drafts_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"prova_generation_jobs": {
                  Row: {
                    "chain_run_id": string | null,"created_at": string,"error_code": string | null,"family_id": string,"id": string,"items": number,"lease": string | null,"prompt_hash": string,"provider": string | null,"provider_result": Json | null,"requested_by": string | null,"result": Json | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chain_run_id"?: string | null,"created_at"?: string,"error_code"?: string | null,"family_id": string,"id": string,"items": number,"lease"?: string | null,"prompt_hash": string,"provider"?: string | null,"provider_result"?: Json | null,"requested_by"?: string | null,"result"?: Json | null,"status": string,"updated_at"?: string
                  }
                  Update: {
                    "chain_run_id"?: string | null,"created_at"?: string,"error_code"?: string | null,"family_id"?: string,"id"?: string,"items"?: number,"lease"?: string | null,"prompt_hash"?: string,"provider"?: string | null,"provider_result"?: Json | null,"requested_by"?: string | null,"result"?: Json | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "prova_generation_jobs_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prova_generation_jobs_provider_fkey"
      columns: ["provider"]
isOneToOne: false
      referencedRelation: "ai_providers"
      referencedColumns: ["id"]
    }
                  ]
                },"push_outbox": {
                  Row: {
                    "attempts": number,"audience": string,"claimed_at": string | null,"created_at": string,"exclude_user_id": string | null,"family_id": string,"id": number,"kind": string,"last_error": string | null,"lease_id": string | null,"next_attempt_at": string,"payload": NonNullable<Json>,"recovery_revision": number,"sent_at": string | null,"status": string,"target_child_id": string | null,"target_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"audience": string,"claimed_at"?: string | null,"created_at"?: string,"exclude_user_id"?: string | null,"family_id": string,"id"?: never,"kind": string,"last_error"?: string | null,"lease_id"?: string | null,"next_attempt_at"?: string,"payload"?: NonNullable<Json>,"recovery_revision"?: number,"sent_at"?: string | null,"status"?: string,"target_child_id"?: string | null,"target_user_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"audience"?: string,"claimed_at"?: string | null,"created_at"?: string,"exclude_user_id"?: string | null,"family_id"?: string,"id"?: never,"kind"?: string,"last_error"?: string | null,"lease_id"?: string | null,"next_attempt_at"?: string,"payload"?: NonNullable<Json>,"recovery_revision"?: number,"sent_at"?: string | null,"status"?: string,"target_child_id"?: string | null,"target_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_outbox_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "push_outbox_target_child_id_fkey"
      columns: ["target_child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    }
                  ]
                },"push_preferences": {
                  Row: {
                    "announcements": boolean,"approvals": boolean,"education_reminders": boolean,"exams": boolean,"family_id": string,"updated_at": string,"user_id": string,"weekly_summary": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "announcements"?: boolean,"approvals"?: boolean,"education_reminders"?: boolean,"exams"?: boolean,"family_id": string,"updated_at"?: string,"user_id": string,"weekly_summary"?: boolean
                  }
                  Update: {
                    "announcements"?: boolean,"approvals"?: boolean,"education_reminders"?: boolean,"exams"?: boolean,"family_id"?: string,"updated_at"?: string,"user_id"?: string,"weekly_summary"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_preferences_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"push_tokens": {
                  Row: {
                    "created_at": string,"device_id": string | null,"family_id": string,"id": string,"locale": string,"platform": string,"role": string,"token": string,"token_type": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"device_id"?: string | null,"family_id": string,"id"?: string,"locale"?: string,"platform": string,"role": string,"token": string,"token_type": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"device_id"?: string | null,"family_id"?: string,"id"?: string,"locale"?: string,"platform"?: string,"role"?: string,"token"?: string,"token_type"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "push_tokens_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"question_answer_keys": {
                  Row: {
                    "content_hash": string,"created_at": string,"family_id": string | null,"interaction_type": string,"key": NonNullable<Json>,"points": number,"policy": string,"policy_version": number,"question_id": string,"schema_version": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content_hash": string,"created_at"?: string,"family_id"?: string | null,"interaction_type": string,"key": NonNullable<Json>,"points"?: number,"policy": string,"policy_version": number,"question_id": string,"schema_version": number,"updated_at"?: string
                  }
                  Update: {
                    "content_hash"?: string,"created_at"?: string,"family_id"?: string | null,"interaction_type"?: string,"key"?: NonNullable<Json>,"points"?: number,"policy"?: string,"policy_version"?: number,"question_id"?: string,"schema_version"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_answer_keys_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_answer_keys_interaction_type_fkey"
      columns: ["interaction_type"]
isOneToOne: false
      referencedRelation: "interaction_types"
      referencedColumns: ["type"]
    },{
      foreignKeyName: "question_answer_keys_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "current_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_answer_keys_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_answer_keys_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "standalone_question_bank"
      referencedColumns: ["id"]
    }
                  ]
                },"question_bank": {
                  Row: {
                    "choices": Json | null,"correct_key": string | null,"created_at": string,"created_by": string | null,"difficulty": Database["public"]['Enums']["question_difficulty"],"expected_answer": string | null,"explanation": string | null,"family_id": string | null,"grade": number,"id": string,"interaction_type": string | null,"kind": Database["public"]['Enums']["question_kind"],"payload": Json | null,"provenance": NonNullable<Json>,"scenario_code": string | null,"schema_version": number | null,"solution": string | null,"source_urls": (string)[],"stem": string,"subject": string,"times_asked": number,"topic": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "choices"?: Json | null,"correct_key"?: string | null,"created_at"?: string,"created_by"?: string | null,"difficulty"?: Database["public"]['Enums']["question_difficulty"],"expected_answer"?: string | null,"explanation"?: string | null,"family_id"?: string | null,"grade": number,"id"?: string,"interaction_type"?: string | null,"kind": Database["public"]['Enums']["question_kind"],"payload"?: Json | null,"provenance"?: NonNullable<Json>,"scenario_code"?: string | null,"schema_version"?: number | null,"solution"?: string | null,"source_urls"?: (string)[],"stem": string,"subject": string,"times_asked"?: number,"topic": string,"updated_at"?: string
                  }
                  Update: {
                    "choices"?: Json | null,"correct_key"?: string | null,"created_at"?: string,"created_by"?: string | null,"difficulty"?: Database["public"]['Enums']["question_difficulty"],"expected_answer"?: string | null,"explanation"?: string | null,"family_id"?: string | null,"grade"?: number,"id"?: string,"interaction_type"?: string | null,"kind"?: Database["public"]['Enums']["question_kind"],"payload"?: Json | null,"provenance"?: NonNullable<Json>,"scenario_code"?: string | null,"schema_version"?: number | null,"solution"?: string | null,"source_urls"?: (string)[],"stem"?: string,"subject"?: string,"times_asked"?: number,"topic"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_bank_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_bank_interaction_type_fkey"
      columns: ["interaction_type"]
isOneToOne: false
      referencedRelation: "interaction_types"
      referencedColumns: ["type"]
    }
                  ]
                },"question_child_signals": {
                  Row: {
                    "attempt_id": string,"family_id": string,"liked": boolean,"question_id": string,"struggled": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_id": string,"family_id": string,"liked"?: boolean,"question_id": string,"struggled"?: boolean
                  }
                  Update: {
                    "attempt_id"?: string,"family_id"?: string,"liked"?: boolean,"question_id"?: string,"struggled"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_child_signals_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "exam_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_child_signals_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_child_signals_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "current_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_child_signals_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_child_signals_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "standalone_question_bank"
      referencedColumns: ["id"]
    }
                  ]
                },"question_contributions": {
                  Row: {
                    "consent_version": string,"content": NonNullable<Json>,"content_hash": string,"created_at": string,"family_id": string,"id": string,"library_item_id": string | null,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"source_question_id": string | null,"status": string,"submitted_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_version": string,"content": NonNullable<Json>,"content_hash": string,"created_at"?: string,"family_id": string,"id": string,"library_item_id"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"source_question_id"?: string | null,"status"?: string,"submitted_by"?: string | null
                  }
                  Update: {
                    "consent_version"?: string,"content"?: NonNullable<Json>,"content_hash"?: string,"created_at"?: string,"family_id"?: string,"id"?: string,"library_item_id"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"source_question_id"?: string | null,"status"?: string,"submitted_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_contributions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_contributions_library_item_id_fkey"
      columns: ["library_item_id"]
isOneToOne: false
      referencedRelation: "library_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_contributions_source_question_id_fkey"
      columns: ["source_question_id"]
isOneToOne: false
      referencedRelation: "current_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_contributions_source_question_id_fkey"
      columns: ["source_question_id"]
isOneToOne: false
      referencedRelation: "question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_contributions_source_question_id_fkey"
      columns: ["source_question_id"]
isOneToOne: false
      referencedRelation: "standalone_question_bank"
      referencedColumns: ["id"]
    }
                  ]
                },"question_focus": {
                  Row: {
                    "child_id": string,"created_by": string,"expires_at": string,"family_id": string,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"created_by": string,"expires_at": string,"family_id": string,"question_id": string
                  }
                  Update: {
                    "child_id"?: string,"created_by"?: string,"expires_at"?: string,"family_id"?: string,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_focus_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_focus_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_focus_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "current_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_focus_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_focus_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "standalone_question_bank"
      referencedColumns: ["id"]
    }
                  ]
                },"question_reactions": {
                  Row: {
                    "created_at": string,"family_id": string,"parent_user_id": string,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"family_id": string,"parent_user_id": string,"question_id": string
                  }
                  Update: {
                    "created_at"?: string,"family_id"?: string,"parent_user_id"?: string,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_reactions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_reactions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "current_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_reactions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_reactions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "standalone_question_bank"
      referencedColumns: ["id"]
    }
                  ]
                },"question_reports": {
                  Row: {
                    "attempt_id": string | null,"created_at": string,"family_id": string,"id": string,"question_id": string,"reason": string,"reporter_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_id"?: string | null,"created_at"?: string,"family_id": string,"id": string,"question_id": string,"reason": string,"reporter_id": string,"status"?: string
                  }
                  Update: {
                    "attempt_id"?: string | null,"created_at"?: string,"family_id"?: string,"id"?: string,"question_id"?: string,"reason"?: string,"reporter_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_reports_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "exam_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_reports_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_reports_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "current_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_reports_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_reports_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "standalone_question_bank"
      referencedColumns: ["id"]
    }
                  ]
                },"question_source_groups": {
                  Row: {
                    "body": string,"created_at": string,"family_id": string,"finalized_at": string | null,"grade": number,"id": string,"previous_id": string | null,"series_id": string,"subject": string,"title": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"created_at"?: string,"family_id": string,"finalized_at"?: string | null,"grade": number,"id": string,"previous_id"?: string | null,"series_id": string,"subject": string,"title": string,"version": number
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"family_id"?: string,"finalized_at"?: string | null,"grade"?: number,"id"?: string,"previous_id"?: string | null,"series_id"?: string,"subject"?: string,"title"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_source_groups_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"question_source_members": {
                  Row: {
                    "group_id": string,"position": number,"prompt": string,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"position": number,"prompt": string,"question_id": string
                  }
                  Update: {
                    "group_id"?: string,"position"?: number,"prompt"?: string,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_source_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "question_source_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_source_members_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "current_question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_source_members_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "question_bank"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_source_members_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "standalone_question_bank"
      referencedColumns: ["id"]
    }
                  ]
                },"reinforcement_snoozes": {
                  Row: {
                    "child_id": string,"family_id": string,"scope_key": string,"until_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"family_id": string,"scope_key": string,"until_at": string
                  }
                  Update: {
                    "child_id"?: string,"family_id"?: string,"scope_key"?: string,"until_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reinforcement_snoozes_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reinforcement_snoozes_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"reward_catalog_sync": {
                  Row: {
                    "family_id": string,"revision": number
                  }
                  ComputedFields: never
                  Insert: {
                    "family_id": string,"revision"?: number
                  }
                  Update: {
                    "family_id"?: string,"revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "reward_catalog_sync_family_id_fkey"
      columns: ["family_id"]
isOneToOne: true
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"reward_requests": {
                  Row: {
                    "child_id": string,"cost_snapshot": number,"decided_at": string | null,"decided_by": string | null,"delivered_at": string | null,"family_id": string,"goal_id": string | null,"id": string,"idempotency_key": string,"requested_at": string,"reward_id": string,"reward_snapshot": Json | null,"status": Database["public"]['Enums']["reward_request_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"cost_snapshot": number,"decided_at"?: string | null,"decided_by"?: string | null,"delivered_at"?: string | null,"family_id": string,"goal_id"?: string | null,"id"?: string,"idempotency_key": string,"requested_at"?: string,"reward_id": string,"reward_snapshot"?: Json | null,"status"?: Database["public"]['Enums']["reward_request_status"]
                  }
                  Update: {
                    "child_id"?: string,"cost_snapshot"?: number,"decided_at"?: string | null,"decided_by"?: string | null,"delivered_at"?: string | null,"family_id"?: string,"goal_id"?: string | null,"id"?: string,"idempotency_key"?: string,"requested_at"?: string,"reward_id"?: string,"reward_snapshot"?: Json | null,"status"?: Database["public"]['Enums']["reward_request_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reward_requests_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reward_requests_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reward_requests_goal_id_fkey"
      columns: ["goal_id"]
isOneToOne: false
      referencedRelation: "child_goals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reward_requests_reward_id_fkey"
      columns: ["reward_id"]
isOneToOne: false
      referencedRelation: "family_rewards"
      referencedColumns: ["id"]
    }
                  ]
                },"room_weather_cache": {
                  Row: {
                    "city_id": string,"expires_at": string,"forecast": Json | null,"last_modified": string | null,"refresh_after": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city_id": string,"expires_at"?: string,"forecast"?: Json | null,"last_modified"?: string | null,"refresh_after"?: string
                  }
                  Update: {
                    "city_id"?: string,"expires_at"?: string,"forecast"?: Json | null,"last_modified"?: string | null,"refresh_after"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "room_weather_cache_city_id_fkey"
      columns: ["city_id"]
isOneToOne: true
      referencedRelation: "weather_cities"
      referencedColumns: ["id"]
    }
                  ]
                },"school_grade_sync": {
                  Row: {
                    "child_id": string,"family_id": string,"revision": number
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"family_id": string,"revision"?: number
                  }
                  Update: {
                    "child_id"?: string,"family_id"?: string,"revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "school_grade_sync_child_id_fkey"
      columns: ["child_id"]
isOneToOne: true
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "school_grade_sync_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"school_timetables": {
                  Row: {
                    "child_id": string,"family_id": string,"lessons": NonNullable<Json>,"revision": number,"settings": NonNullable<Json>,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"family_id": string,"lessons"?: NonNullable<Json>,"revision"?: number,"settings"?: NonNullable<Json>,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "child_id"?: string,"family_id"?: string,"lessons"?: NonNullable<Json>,"revision"?: number,"settings"?: NonNullable<Json>,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "school_timetables_child_id_fkey"
      columns: ["child_id"]
isOneToOne: true
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "school_timetables_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"setup_ai_jobs": {
                  Row: {
                    "created_at": string,"family_id": string,"id": string,"lease_token": string | null,"outcome_unknown": boolean,"prompt_hash": string,"result": Json | null,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"family_id": string,"id": string,"lease_token"?: string | null,"outcome_unknown"?: boolean,"prompt_hash": string,"result"?: Json | null,"status": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"family_id"?: string,"id"?: string,"lease_token"?: string | null,"outcome_unknown"?: boolean,"prompt_hash"?: string,"result"?: Json | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "setup_ai_jobs_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"source_deletion_queue": {
                  Row: {
                    "attempts": number,"created_at": string,"last_attempt_at": string | null,"last_error": string | null,"object_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"last_attempt_at"?: string | null,"last_error"?: string | null,"object_path": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"last_attempt_at"?: string | null,"last_error"?: string | null,"object_path"?: string
                  }
                  Relationships: [
                    
                  ]
                },"star_events": {
                  Row: {
                    "child_id": string,"completion_id": string | null,"created_at": string,"created_by": string | null,"delta": number,"family_id": string,"id": number,"reason": string,"refund_request_id": string | null,"reward_request_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"completion_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"delta": number,"family_id": string,"id"?: never,"reason": string,"refund_request_id"?: string | null,"reward_request_id"?: string | null
                  }
                  Update: {
                    "child_id"?: string,"completion_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"delta"?: number,"family_id"?: string,"id"?: never,"reason"?: string,"refund_request_id"?: string | null,"reward_request_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "star_events_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "star_events_completion_id_fkey"
      columns: ["completion_id"]
isOneToOne: false
      referencedRelation: "task_completions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "star_events_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "star_events_refund_request_id_fkey"
      columns: ["refund_request_id"]
isOneToOne: false
      referencedRelation: "reward_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "star_events_reward_request_id_fkey"
      columns: ["reward_request_id"]
isOneToOne: false
      referencedRelation: "reward_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"store_notifications": {
                  Row: {
                    "attempts": number,"error": string | null,"event_key": string,"event_type": string | null,"id": string,"lease_token": string | null,"lease_until": string | null,"payload": NonNullable<Json>,"platform": Database["public"]['Enums']["store_platform"],"processed_at": string | null,"received_at": string,"store_key": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"error"?: string | null,"event_key": string,"event_type"?: string | null,"id"?: string,"lease_token"?: string | null,"lease_until"?: string | null,"payload": NonNullable<Json>,"platform": Database["public"]['Enums']["store_platform"],"processed_at"?: string | null,"received_at"?: string,"store_key"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"error"?: string | null,"event_key"?: string,"event_type"?: string | null,"id"?: string,"lease_token"?: string | null,"lease_until"?: string | null,"payload"?: NonNullable<Json>,"platform"?: Database["public"]['Enums']["store_platform"],"processed_at"?: string | null,"received_at"?: string,"store_key"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"store_subscriptions": {
                  Row: {
                    "acknowledged_at": string | null,"auto_renewing": boolean,"created_at": string,"expires_at": string,"family_id": string,"id": string,"last_source": string | null,"notified_at": string | null,"plan": Database["public"]['Enums']["plan_code"],"platform": Database["public"]['Enums']["store_platform"],"product_id": string,"purchaser_user_id": string | null,"raw": Json | null,"status": Database["public"]['Enums']["subscription_status"],"store_key": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_at"?: string | null,"auto_renewing"?: boolean,"created_at"?: string,"expires_at": string,"family_id": string,"id"?: string,"last_source"?: string | null,"notified_at"?: string | null,"plan": Database["public"]['Enums']["plan_code"],"platform": Database["public"]['Enums']["store_platform"],"product_id": string,"purchaser_user_id"?: string | null,"raw"?: Json | null,"status"?: Database["public"]['Enums']["subscription_status"],"store_key": string,"updated_at"?: string
                  }
                  Update: {
                    "acknowledged_at"?: string | null,"auto_renewing"?: boolean,"created_at"?: string,"expires_at"?: string,"family_id"?: string,"id"?: string,"last_source"?: string | null,"notified_at"?: string | null,"plan"?: Database["public"]['Enums']["plan_code"],"platform"?: Database["public"]['Enums']["store_platform"],"product_id"?: string,"purchaser_user_id"?: string | null,"raw"?: Json | null,"status"?: Database["public"]['Enums']["subscription_status"],"store_key"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_subscriptions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"study_plan_calendar_items": {
                  Row: {
                    "created_at": string,"day": number,"event_id": string | null,"family_id": string,"plan_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": number,"event_id"?: string | null,"family_id": string,"plan_id": string
                  }
                  Update: {
                    "created_at"?: string,"day"?: number,"event_id"?: string | null,"family_id"?: string,"plan_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "study_plan_calendar_items_event_id_fkey"
      columns: ["event_id"]
isOneToOne: true
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "study_plan_calendar_items_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "study_plan_calendar_items_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "study_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"study_plans": {
                  Row: {
                    "ai_job_id": string | null,"attempt_id": string | null,"child_id": string,"created_at": string,"created_by": string | null,"family_id": string,"grade": number,"id": string,"input_hash": string | null,"model": string | null,"plan": NonNullable<Json>,"prompt_version": string | null,"status": string,"subject": string,"updated_at": string,"weak_topics": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_job_id"?: string | null,"attempt_id"?: string | null,"child_id": string,"created_at"?: string,"created_by"?: string | null,"family_id": string,"grade": number,"id"?: string,"input_hash"?: string | null,"model"?: string | null,"plan"?: NonNullable<Json>,"prompt_version"?: string | null,"status"?: string,"subject": string,"updated_at"?: string,"weak_topics"?: NonNullable<Json>
                  }
                  Update: {
                    "ai_job_id"?: string | null,"attempt_id"?: string | null,"child_id"?: string,"created_at"?: string,"created_by"?: string | null,"family_id"?: string,"grade"?: number,"id"?: string,"input_hash"?: string | null,"model"?: string | null,"plan"?: NonNullable<Json>,"prompt_version"?: string | null,"status"?: string,"subject"?: string,"updated_at"?: string,"weak_topics"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "study_plans_ai_job_id_fkey"
      columns: ["ai_job_id"]
isOneToOne: true
      referencedRelation: "ai_operation_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "study_plans_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "exam_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "study_plans_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "study_plans_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"task_completions": {
                  Row: {
                    "child_id": string,"client_id": string,"completed_at": string,"completed_by": string | null,"due_date": string,"family_id": string,"id": string,"return_note": string | null,"return_reason": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["completion_status"],"task_snapshot": Json | null,"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"client_id": string,"completed_at"?: string,"completed_by"?: string | null,"due_date": string,"family_id": string,"id"?: string,"return_note"?: string | null,"return_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["completion_status"],"task_snapshot"?: Json | null,"template_id": string
                  }
                  Update: {
                    "child_id"?: string,"client_id"?: string,"completed_at"?: string,"completed_by"?: string | null,"due_date"?: string,"family_id"?: string,"id"?: string,"return_note"?: string | null,"return_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["completion_status"],"task_snapshot"?: Json | null,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_completions_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_completions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_completions_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "task_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"task_routine_sync": {
                  Row: {
                    "child_id": string,"family_id": string,"revision": number
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"family_id": string,"revision"?: number
                  }
                  Update: {
                    "child_id"?: string,"family_id"?: string,"revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_routine_sync_child_id_fkey"
      columns: ["child_id"]
isOneToOne: true
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_routine_sync_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"task_templates": {
                  Row: {
                    "active": boolean,"archived_at": string | null,"child_id": string,"created_at": string,"days_of_week": (number)[],"effective_from": string | null,"ends_on": string | null,"family_id": string,"icon": string,"id": string,"period_id": string | null,"requires_approval": boolean,"revision": number,"sort_order": number,"source_period_id": string | null,"source_routine_id": string | null,"stars": number,"starts_on": string,"time_of_day": Database["public"]['Enums']["time_of_day"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"archived_at"?: string | null,"child_id": string,"created_at"?: string,"days_of_week"?: (number)[],"effective_from"?: string | null,"ends_on"?: string | null,"family_id": string,"icon"?: string,"id"?: string,"period_id"?: string | null,"requires_approval"?: boolean,"revision"?: number,"sort_order"?: number,"source_period_id"?: string | null,"source_routine_id"?: string | null,"stars"?: number,"starts_on"?: string,"time_of_day"?: Database["public"]['Enums']["time_of_day"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"archived_at"?: string | null,"child_id"?: string,"created_at"?: string,"days_of_week"?: (number)[],"effective_from"?: string | null,"ends_on"?: string | null,"family_id"?: string,"icon"?: string,"id"?: string,"period_id"?: string | null,"requires_approval"?: boolean,"revision"?: number,"sort_order"?: number,"source_period_id"?: string | null,"source_routine_id"?: string | null,"stars"?: number,"starts_on"?: string,"time_of_day"?: Database["public"]['Enums']["time_of_day"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_templates_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_templates_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_templates_source_routine_id_fkey"
      columns: ["source_routine_id"]
isOneToOne: false
      referencedRelation: "task_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"timetable_imports": {
                  Row: {
                    "applied_revision": number | null,"child_id": string,"created_at": string,"draft": NonNullable<Json>,"family_id": string,"id": string,"source_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applied_revision"?: number | null,"child_id": string,"created_at"?: string,"draft": NonNullable<Json>,"family_id": string,"id": string,"source_id": string
                  }
                  Update: {
                    "applied_revision"?: number | null,"child_id"?: string,"created_at"?: string,"draft"?: NonNullable<Json>,"family_id"?: string,"id"?: string,"source_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "timetable_imports_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timetable_imports_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timetable_imports_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "ai_operation_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timetable_imports_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "learning_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"weather_cities": {
                  Row: {
                    "country": string,"id": string,"latitude": number,"longitude": number,"name": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country": string,"id": string,"latitude": number,"longitude": number,"name": string,"timezone": string
                  }
                  Update: {
                    "country"?: string,"id"?: string,"latitude"?: number,"longitude"?: number,"name"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "current_question_bank": {
                  Row: {
                    "choices": Json | null,"correct_key": string | null,"created_at": string,"created_by": string | null,"difficulty": Database["public"]['Enums']["question_difficulty"],"expected_answer": string | null,"explanation": string | null,"family_id": string | null,"grade": number,"id": string,"interaction_type": string | null,"kind": Database["public"]['Enums']["question_kind"],"payload": Json | null,"provenance": NonNullable<Json>,"scenario_code": string | null,"schema_version": number | null,"solution": string | null,"source_urls": (string)[],"stem": string,"subject": string,"times_asked": number,"topic": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                           "choices"?: Json | null,"correct_key"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"difficulty"?: Database["public"]['Enums']["question_difficulty"] | null,"expected_answer"?: string | null,"explanation"?: string | null,"family_id"?: string | null,"grade"?: number | null,"id"?: string | null,"interaction_type"?: string | null,"kind"?: Database["public"]['Enums']["question_kind"] | null,"payload"?: Json | null,"provenance"?: Json | null,"scenario_code"?: string | null,"schema_version"?: number | null,"solution"?: string | null,"source_urls"?: (string)[] | null,"stem"?: string | null,"subject"?: string | null,"times_asked"?: number | null,"topic"?: string | null,"updated_at"?: string | null
                         }
                        Update: {
                           "choices"?: Json | null,"correct_key"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"difficulty"?: Database["public"]['Enums']["question_difficulty"] | null,"expected_answer"?: string | null,"explanation"?: string | null,"family_id"?: string | null,"grade"?: number | null,"id"?: string | null,"interaction_type"?: string | null,"kind"?: Database["public"]['Enums']["question_kind"] | null,"payload"?: Json | null,"provenance"?: Json | null,"scenario_code"?: string | null,"schema_version"?: number | null,"solution"?: string | null,"source_urls"?: (string)[] | null,"stem"?: string | null,"subject"?: string | null,"times_asked"?: number | null,"topic"?: string | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "question_bank_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_bank_interaction_type_fkey"
      columns: ["interaction_type"]
isOneToOne: false
      referencedRelation: "interaction_types"
      referencedColumns: ["type"]
    }
                  ]
                },"standalone_question_bank": {
                  Row: {
                    "choices": Json | null,"correct_key": string | null,"created_at": string,"created_by": string | null,"difficulty": Database["public"]['Enums']["question_difficulty"],"expected_answer": string | null,"explanation": string | null,"family_id": string | null,"grade": number,"id": string,"interaction_type": string | null,"kind": Database["public"]['Enums']["question_kind"],"payload": Json | null,"provenance": NonNullable<Json>,"scenario_code": string | null,"schema_version": number | null,"solution": string | null,"source_urls": (string)[],"stem": string,"subject": string,"times_asked": number,"topic": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                           "choices"?: Json | null,"correct_key"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"difficulty"?: Database["public"]['Enums']["question_difficulty"] | null,"expected_answer"?: string | null,"explanation"?: string | null,"family_id"?: string | null,"grade"?: number | null,"id"?: string | null,"interaction_type"?: string | null,"kind"?: Database["public"]['Enums']["question_kind"] | null,"payload"?: Json | null,"provenance"?: Json | null,"scenario_code"?: string | null,"schema_version"?: number | null,"solution"?: string | null,"source_urls"?: (string)[] | null,"stem"?: string | null,"subject"?: string | null,"times_asked"?: number | null,"topic"?: string | null,"updated_at"?: string | null
                         }
                        Update: {
                           "choices"?: Json | null,"correct_key"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"difficulty"?: Database["public"]['Enums']["question_difficulty"] | null,"expected_answer"?: string | null,"explanation"?: string | null,"family_id"?: string | null,"grade"?: number | null,"id"?: string | null,"interaction_type"?: string | null,"kind"?: Database["public"]['Enums']["question_kind"] | null,"payload"?: Json | null,"provenance"?: Json | null,"scenario_code"?: string | null,"schema_version"?: number | null,"solution"?: string | null,"source_urls"?: (string)[] | null,"stem"?: string | null,"subject"?: string | null,"times_asked"?: number | null,"topic"?: string | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "question_bank_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_bank_interaction_type_fkey"
      columns: ["interaction_type"]
isOneToOne: false
      referencedRelation: "interaction_types"
      referencedColumns: ["type"]
    }
                  ]
                }
          }
          Functions: {
            "accept_ai_grade":
{ Args: { "p_attempt_id": string,"p_expected": number,"p_question_id": string }; Returns: {
              "ai_feedback": Json | null,
"child_id": string,
"created_at": string,
"deadline_at": string | null,
"exam_id": string,
"family_id": string,
"finished_at": string | null,
"graded_at": string | null,
"id": string,
"items_partial": number | null,
"items_pending": number | null,
"items_scored": number | null,
"items_total": number | null,
"items_unanswered": number | null,
"mc_correct": number | null,
"mc_total": number | null,
"open_graded": number | null,
"open_pending": number | null,
"open_total": number | null,
"open_unanswered": number | null,
"provisional": boolean | null,
"score_pct": number | null,
"started_at": string,
"status": Database["public"]['Enums']["attempt_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "exam_attempts"
        isOneToOne: true
        isSetofReturn: false
      } },
"acquire_library_units":
{ Args: { "p_draft_id"?: string,"p_package_id": string,"p_publication_version": number,"p_request_id": string,"p_unit_keys": (string)[] }; Returns: Json
                           },
"add_help_attachment":
{ Args: { "p_attachment_id": string,"p_data": string,"p_height": number,"p_mime": string,"p_redaction": Json,"p_request_id": string,"p_ticket_id": string,"p_width": number }; Returns: Json
                           },
"admin_add_library_item":
{ Args: { "p_collection_id": string,"p_content": Json,"p_publish"?: boolean }; Returns: string
                           },
"admin_ai_chains":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_ai_failed_operations":
{ Args: { "p_action"?: string,"p_from"?: string,"p_limit"?: number,"p_offset"?: number,"p_statuses"?: (string)[],"p_to"?: string }; Returns: Json
                           },
"admin_ai_operations":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_ai_policy_matrix":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_announcement_channels":
{ Args: { "p_id": string }; Returns: Json
                           },
"admin_announcement_push_audience":
{ Args: { "p_id": string,"p_revision": number }; Returns: Json
                           },
"admin_announcements":
{ Args: { "p_before"?: string,"p_before_id"?: string }; Returns: Json
                           },
"admin_assign_ai_chain":
{ Args: { "p_chain_id": string,"p_expected_updated_at"?: string,"p_usage_key": string }; Returns: undefined
                           },
"admin_audit_actors":
{ Args: { "p_ids": (string)[] }; Returns: {
              "id": string,"label": string
            }[]
                           },
"admin_cancel_group_exam":
{ Args: { "p_id": string,"p_reason": string }; Returns: undefined
                           },
"admin_change_curriculum_candidate":
{ Args: { "p_action": string,"p_confirmed": boolean,"p_id": string,"p_note": string,"p_request_id": string,"p_review": Json,"p_revision": number }; Returns: Json
                           },
"admin_cohort_review_detail":
{ Args: { "p_entry": string }; Returns: Json
                           },
"admin_cohort_review_queue":
{ Args: { "p_group": string }; Returns: Json
                           },
"admin_content_prereview_health":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_content_prereviews":
{ Args: { "p_limit"?: number,"p_status"?: string }; Returns: Json
                           },
"admin_create_group_exam":
{ Args: { "p_collection": string,"p_end": string,"p_id": string,"p_items": (string)[],"p_minutes": number,"p_plans": (Database["public"]['Enums']["plan_code"])[],"p_start": string,"p_title": string }; Returns: string
                           },
"admin_create_package_group_exam":
{ Args: { "p_end": string,"p_id": string,"p_minutes": number,"p_package_id": string,"p_plans": (Database["public"]['Enums']["plan_code"])[],"p_publication_version": number,"p_start": string,"p_title": string,"p_units": (string)[] }; Returns: string
                           },
"admin_create_reviewed_group_exam":
{ Args: { "p_end": string,"p_id": string,"p_minutes": number,"p_package_id": string,"p_plans": (Database["public"]['Enums']["plan_code"])[],"p_publication_version": number,"p_review": boolean,"p_start": string,"p_title": string,"p_units": (string)[] }; Returns: string
                           },
"admin_curriculum_pipeline":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_dashboard":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_decide_contribution_set":
{ Args: { "p_approve": boolean,"p_confirmed": boolean,"p_id": string,"p_note": string,"p_request_id": string,"p_teachers": Json }; Returns: Json
                           } |
{ Args: { "p_approve": boolean,"p_confirmed": boolean,"p_id": string,"p_note": string,"p_question_notes": Json,"p_request_id": string,"p_teachers": Json }; Returns: Json
                           },
"admin_delete_global_question":
{ Args: { "p_question_id": string }; Returns: undefined
                           },
"admin_education_calendar_checks":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_education_calendars":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_education_holidays":
{ Args: { "p_academic_year"?: number }; Returns: Json
                           },
"admin_education_reminder_settings":
{ Args: { "p_enabled": boolean,"p_request": string,"p_revision": number }; Returns: Json
                           },
"admin_education_report_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_expire_override":
{ Args: { "p_override_id": string,"p_reason": string }; Returns: undefined
                           },
"admin_families_search":
{ Args: { "p_cursor"?: string,"p_expiring_within_days"?: number,"p_limit"?: number,"p_query"?: string,"p_sort"?: string }; Returns: Json
                           },
"admin_family_entitlement_timeline":
{ Args: { "p_cursor"?: string,"p_family_id": string,"p_limit"?: number }; Returns: Json
                           },
"admin_find_operator_account":
{ Args: { "p_email": string }; Returns: Json
                           },
"admin_get_contribution_set":
{ Args: { "p_id": string }; Returns: Json
                           },
"admin_get_curriculum_candidate":
{ Args: { "p_id": string }; Returns: Json
                           },
"admin_get_library_import":
{ Args: { "p_id": string,"p_include_answers"?: boolean }; Returns: Json
                           },
"admin_get_library_reviews":
{ Args: { "p_package_id": string }; Returns: Json
                           },
"admin_grant_override":
{ Args: { "p_ends_at": string,"p_family_id": string,"p_plan": Database["public"]['Enums']["plan_code"],"p_reason": string,"p_starts_at"?: string }; Returns: string
                           },
"admin_group_exams":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_group_package_catalog":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_group_policy":
{ Args: { "p_enabled": boolean,"p_limits": Json }; Returns: undefined
                           },
"admin_help_ticket_meta":
{ Args: { "p_ticket_id": string }; Returns: Json
                           },
"admin_import_curriculum_candidates":
{ Args: { "p_bundle": Json,"p_request_id": string }; Returns: Json
                           },
"admin_import_education_calendar_seed":
{ Args: { "p_execute"?: boolean,"p_request": string,"p_seed": Json }; Returns: Json
                           },
"admin_import_education_holidays":
{ Args: { "p_execute"?: boolean,"p_request": string,"p_seed": Json }; Returns: Json
                           },
"admin_import_library_bundle":
{ Args: { "p_bundle": Json,"p_request_id": string }; Returns: Json
                           },
"admin_learning_library":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_library_content_items":
{ Args: { "p_kind"?: string,"p_limit"?: number,"p_status"?: string }; Returns: Json
                           },
"admin_library_content_page":
{ Args: { "p_cursor"?: string,"p_kind"?: string,"p_limit"?: number,"p_prereview"?: string,"p_status"?: string }; Returns: Json
                           },
"admin_library_group_integrity":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"admin_library_package_trail":
{ Args: { "p_package_id": string }; Returns: Json
                           },
"admin_library_publication":
{ Args: { "p_package_id": string }; Returns: Json
                           },
"admin_list_contribution_sets":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_list_curriculum_candidates":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_list_curriculum_source_targets":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_list_curriculum_sources":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_list_library_draft_packages":
{ Args: { "p_before_created_at"?: string,"p_before_id"?: string,"p_limit"?: number }; Returns: Json
                           },
"admin_list_library_imports":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"admin_list_overrides":
{ Args: { "p_family_id"?: string,"p_include_inactive"?: boolean }; Returns: {
              "created_at": string,"ends_at": string,"family_id": string,"family_name": string,"granted_by": string,"id": string,"is_active": boolean,"plan": Database["public"]['Enums']["plan_code"],"reason": string,"revoked_at": string,"starts_at": string
            }[]
                           },
"admin_model_disable_preview":
{ Args: { "p_model_id": string }; Returns: Json
                           },
"admin_operation_members":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_operator_scopes":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_override_apply":
{ Args: { "p_family_id": string,"p_idempotency_key": string,"p_plan": Database["public"]['Enums']["plan_code"],"p_reason": string,"p_replace_conflicts"?: boolean,"p_until": string }; Returns: Json
                           },
"admin_override_preview":
{ Args: { "p_family_id": string,"p_plan": Database["public"]['Enums']["plan_code"],"p_reason": string,"p_until": string }; Returns: Json
                           },
"admin_prereview_candidate_context":
{ Args: { "p_ids": (string)[] }; Returns: Json
                           },
"admin_preview_announcement":
{ Args: { "p_id": string,"p_revision": number }; Returns: Json
                           },
"admin_provider_change_impact":
{ Args: { "p_from": string,"p_to": string }; Returns: Json
                           },
"admin_publish_announcement":
{ Args: { "p_confirmed": boolean,"p_fingerprint": string,"p_id": string,"p_request": string,"p_revision": number }; Returns: Json
                           },
"admin_publish_cohort_results":
{ Args: { "p_fingerprint": string,"p_group": string,"p_request": string,"p_version": number }; Returns: Json
                           },
"admin_publish_education_calendar":
{ Args: { "p_checks": Json,"p_id": string,"p_note": string,"p_request": string,"p_revision": number }; Returns: Json
                           },
"admin_publish_library_item":
{ Args: { "p_id": string,"p_published": boolean }; Returns: undefined
                           },
"admin_question_facets":
{ Args: Record<PropertyKey, never>; Returns: {
              "grade": number,"question_count": number,"subject": string,"times_asked_total": number,"topic": string
            }[]
                           },
"admin_record_curriculum_extraction":
{ Args: { "p_request_id": string,"p_result": Json,"p_revision_id": string }; Returns: Json
                           },
"admin_retry_ai_operation":
{ Args: { "p_id": string,"p_reason": string }; Returns: undefined
                           },
"admin_retry_prova_generation":
{ Args: { "p_id": string,"p_reason": string }; Returns: undefined
                           },
"admin_review_contribution":
{ Args: { "p_approve": boolean,"p_collection_id": string,"p_id": string,"p_note": string }; Returns: Json
                           },
"admin_review_curriculum_source_revision":
{ Args: { "p_action": string,"p_confirmed": boolean,"p_note": string,"p_request_id": string,"p_revision_id": string }; Returns: Json
                           },
"admin_review_education_report":
{ Args: { "p_id": string,"p_note": string,"p_request": string,"p_revision": number,"p_status": string }; Returns: Json
                           },
"admin_review_library_question":
{ Args: { "p_expected_review_revision": number,"p_note": string,"p_outcome": string,"p_package_id": string,"p_question_key": string,"p_question_revision": number,"p_request_id": string }; Returns: Json
                           },
"admin_save_ai_chain":
{ Args: { "p_attempt_seconds": number,"p_enabled": boolean,"p_expected_updated_at"?: string,"p_id": string,"p_models": (string)[],"p_name": string,"p_on_rate_limit": boolean,"p_on_server_error": boolean,"p_on_timeout": boolean,"p_total_seconds": number }; Returns: Json
                           },
"admin_save_announcement":
{ Args: { "p_id": string,"p_request": string,"p_revision": number,"p_value": Json }; Returns: Json
                           },
"admin_save_cohort_review":
{ Args: { "p_answer_hash": string,"p_appeal_revision"?: number,"p_entry": string,"p_feedback": string,"p_ord": number,"p_outcome": string,"p_points": Json,"p_request": string,"p_response"?: string,"p_revision": number }; Returns: Json
                           },
"admin_save_contribution_reward":
{ Args: { "p_amount": number,"p_days": number,"p_enabled": boolean,"p_id": string,"p_kind": string,"p_plan": Database["public"]['Enums']["plan_code"],"p_threshold": number,"p_title": string }; Returns: string
                           },
"admin_save_curriculum_source_target":
{ Args: { "p_request_id": string,"p_target": Json }; Returns: Json
                           },
"admin_save_education_calendar":
{ Args: { "p_academic_year": number,"p_id": string,"p_place_id": string,"p_publish"?: boolean,"p_request": string,"p_revision": number,"p_stage": string,"p_value": Json }; Returns: Json
                           },
"admin_save_education_place":
{ Args: { "p_id": string,"p_request": string,"p_revision": number,"p_value": Json }; Returns: Json
                           },
"admin_save_guided_input":
{ Args: { "p_id": string,"p_revision": number,"p_value": Json }; Returns: number
                           },
"admin_save_library_collection":
{ Args: { "p_curriculum": string,"p_description": string,"p_grade": number,"p_id": string,"p_plans": (Database["public"]['Enums']["plan_code"])[],"p_status": string,"p_subject": string,"p_title": string }; Returns: string
                           },
"admin_save_override":
{ Args: { "p_command": Json,"p_request_id": string }; Returns: Json
                           },
"admin_save_subject_synonym":
{ Args: { "p_action": string,"p_alias": string,"p_grade_max": number,"p_grade_min": number,"p_key": Json,"p_note": string,"p_request": string,"p_revision": number,"p_subject_id": string }; Returns: Json
                           },
"admin_search_families":
{ Args: { "p_limit"?: number,"p_query"?: string }; Returns: {
              "child_count": number,"created_at": string,"device_count": number,"id": string,"member_count": number,"name": string,"plan": Database["public"]['Enums']["plan_code"],"plan_expires_at": string,"plan_source": string
            }[]
                           },
"admin_set_ai_enabled":
{ Args: { "p_enabled": boolean }; Returns: undefined
                           },
"admin_set_ai_operation_policy":
{ Args: { "p_action": string,"p_concurrent": number,"p_enabled": boolean,"p_monthly": number,"p_per_minute": number,"p_plan": Database["public"]['Enums']["plan_code"] }; Returns: undefined
                           },
"admin_set_education_holiday_status":
{ Args: { "p_id": string,"p_request": string,"p_revision": number,"p_status": string }; Returns: Json
                           },
"admin_set_library_publication":
{ Args: { "p_confirmed": boolean,"p_curriculum_label": string,"p_description": string,"p_expected_version": number,"p_package_id": string,"p_plans": (Database["public"]['Enums']["plan_code"])[],"p_reason"?: string,"p_request_id": string,"p_review_fingerprint": string,"p_status": string,"p_title": string }; Returns: Json
                           },
"admin_set_library_quota":
{ Args: { "p_monthly": number,"p_plan": Database["public"]['Enums']["plan_code"] }; Returns: undefined
                           },
"admin_set_operation_member":
{ Args: { "p_expires_at": string,"p_reason": string,"p_request_id": string,"p_revoke": boolean,"p_role": string,"p_user_id": string }; Returns: Json
                           },
"admin_set_operator_scope":
{ Args: { "p_allow_global"?: boolean,"p_grant": boolean,"p_place_id": string,"p_reason": string,"p_request_id": string,"p_user_id": string }; Returns: Json
                           },
"admin_source_file_limit":
{ Args: { "p_max_files": number }; Returns: undefined
                           },
"admin_subject_synonym_changes":
{ Args: { "p_subject_id"?: string }; Returns: Json
                           },
"admin_subject_synonyms":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_support_operators":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_support_queue":
{ Args: { "p_assignee"?: string,"p_before_id"?: string,"p_before_time"?: string,"p_category"?: string,"p_kind"?: string,"p_query"?: string,"p_status"?: string,"p_waiting"?: boolean }; Returns: Json
                           },
"admin_withdraw_announcement":
{ Args: { "p_id": string,"p_request": string,"p_revision": number }; Returns: Json
                           },
"admin_workqueue":
{ Args: { "p_role"?: string }; Returns: Json
                           },
"ai_chain_finish_attempt":
{ Args: { "p_error"?: string,"p_id": string,"p_input"?: number,"p_ok": boolean,"p_output"?: number,"p_uncertain"?: boolean }; Returns: undefined
                           },
"ai_chain_start_attempt":
{ Args: { "p_chain": string,"p_input_kind": string,"p_job_id"?: string,"p_job_kind"?: string,"p_lease"?: string,"p_model": string,"p_plan": string,"p_position": number,"p_run": string,"p_skip"?: string,"p_usage": string }; Returns: Json
                           },
"ai_model_support":
{ Args: { "p_model_id": string }; Returns: Json
                           },
"appeal_cohort_review":
{ Args: { "p_child": string,"p_group": string,"p_ord": number,"p_reason": string,"p_request": string,"p_review_revision": number }; Returns: Json
                           },
"apple_revocation_begin":
{ Args: { "p_allow_without_token"?: boolean,"p_apple_sub": string,"p_client_id"?: string,"p_request_id": string,"p_token_ciphertext"?: string,"p_token_type"?: string,"p_user_id": string }; Returns: Json
                           },
"apple_revocation_claim":
{ Args: { "p_limit"?: number }; Returns: {
              "apple_sub": string,"attempts": number,"client_id": string,"job_id": string,"token_ciphertext": string,"token_type": string
            }[]
                           },
"apple_revocation_mark_deleted":
{ Args: { "p_job_id": string }; Returns: undefined
                           },
"apple_revocation_record":
{ Args: { "p_error"?: string,"p_job_id": string,"p_outcome": string }; Returns: string
                           },
"apple_token_store":
{ Args: { "p_apple_sub": string,"p_client_id": string,"p_token_ciphertext": string,"p_token_type": string,"p_user_id": string }; Returns: undefined
                           },
"apply_ai_grades":
{ Args: { "p_attempt_id": string,"p_grades": Json,"p_summary"?: Json }; Returns: {
              "ai_feedback": Json | null,
"child_id": string,
"created_at": string,
"deadline_at": string | null,
"exam_id": string,
"family_id": string,
"finished_at": string | null,
"graded_at": string | null,
"id": string,
"items_partial": number | null,
"items_pending": number | null,
"items_scored": number | null,
"items_total": number | null,
"items_unanswered": number | null,
"mc_correct": number | null,
"mc_total": number | null,
"open_graded": number | null,
"open_pending": number | null,
"open_total": number | null,
"open_unanswered": number | null,
"provisional": boolean | null,
"score_pct": number | null,
"started_at": string,
"status": Database["public"]['Enums']["attempt_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "exam_attempts"
        isOneToOne: true
        isSetofReturn: false
      } },
"apply_due_education_changes":
{ Args: { "p_child_id": string }; Returns: Json
                           },
"apply_learning_plan_import":
{ Args: { "p_child_id": string,"p_import_id": string,"p_items": Json,"p_request_id": string }; Returns: Json
                           },
"apply_legacy_open_zero_corrections":
{ Args: { "p_attempt_ids": (string)[],"p_family_id"?: string,"p_request_id": string }; Returns: Json
                           },
"apply_repeat_calendar":
{ Args: { "p_attempt_id": string,"p_items": Json,"p_question_ids": (string)[],"p_request_id": string,"p_source_hash": string }; Returns: Json
                           },
"apply_study_plan_calendar":
{ Args: { "p_items": Json,"p_plan_id": string,"p_request_id": string,"p_updated_at": string }; Returns: Json
                           },
"apply_timetable_import":
{ Args: { "p_import_id": string,"p_lessons": Json,"p_request_id": string,"p_revision": number,"p_settings": Json }; Returns: number
                           },
"apply_verified_store_state":
{ Args: { "p_caller_family_id"?: string,"p_purchaser_user_id"?: string,"p_state": Json }; Returns: Json
                           },
"assign_help_ticket":
{ Args: { "p_assignee": string,"p_expected_assignee": string,"p_request_id": string,"p_ticket_id": string }; Returns: Json
                           },
"assign_question_source_group":
{ Args: { "p_child_id": string,"p_group_id": string,"p_minutes"?: number,"p_request_id": string,"p_timed"?: boolean,"p_title": string }; Returns: string
                           },
"attach_question_source":
{ Args: { "p_alt": string,"p_question_id": string,"p_source_id": string }; Returns: undefined
                           },
"begin_curriculum_extraction":
{ Args: { "p_actor_id": string,"p_revision_id": string }; Returns: Json
                           },
"begin_question_contribution":
{ Args: { "p_id": string,"p_no_personal_data": boolean,"p_question_id": string,"p_rights": boolean,"p_supersedes"?: string }; Returns: Json
                           },
"bulk_archive_apply":
{ Args: { "p_idempotency_key": string,"p_items": Json }; Returns: Json
                           },
"bulk_archive_history":
{ Args: { "p_before"?: string }; Returns: Json
                           },
"bulk_archive_preview":
{ Args: { "p_scope": Json }; Returns: Json
                           },
"bulk_restore_apply":
{ Args: { "p_idempotency_key": string,"p_items": Json }; Returns: Json
                           },
"cancel_child_education_schedule":
{ Args: { "p_child_id": string,"p_request_id": string,"p_schedule_id": string }; Returns: Json
                           },
"cancel_reward_request":
{ Args: { "p_request_id": string }; Returns: {
              "child_id": string,
"cost_snapshot": number,
"decided_at": string | null,
"decided_by": string | null,
"delivered_at": string | null,
"family_id": string,
"goal_id": string | null,
"id": string,
"idempotency_key": string,
"requested_at": string,
"reward_id": string,
"reward_snapshot": Json | null,
"status": Database["public"]['Enums']["reward_request_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "reward_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_unstarted_generation":
{ Args: { "p_id": string,"p_intent": Json }; Returns: Json
                           },
"change_child_education":
{ Args: { "p_academic_year": number,"p_action": string,"p_child_id": string,"p_grade": number,"p_keep_timetable": boolean,"p_request_id": string,"p_revision": number,"p_school": string,"p_starts_on": string,"p_timetable_revision": number }; Returns: Json
                           },
"change_child_education_with_calendar":
{ Args: { "p_academic_year": number,"p_action": string,"p_calendar_id": string,"p_calendar_revision": number,"p_child_id": string,"p_detail": string,"p_grade": number,"p_keep_timetable": boolean,"p_place_id": string,"p_reason": string,"p_request_id": string,"p_revision": number,"p_school": string,"p_stage": string,"p_starts_on": string,"p_timetable_revision": number }; Returns: Json
                           },
"change_reward":
{ Args: { "p_action": string,"p_id": string,"p_request_id": string,"p_revision": number,"p_value"?: Json }; Returns: Json
                           },
"change_school_grade":
{ Args: { "p_action": string,"p_child_id": string,"p_id": string,"p_request_id": string,"p_revision": number,"p_value"?: Json }; Returns: Json
                           },
"change_task_routine":
{ Args: { "p_action": string,"p_effective_from"?: string,"p_id": string,"p_request_id": string,"p_revision": number,"p_value"?: Json }; Returns: Json
                           },
"channel_claim":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"channel_one_click_unsubscribe":
{ Args: { "p_token": string }; Returns: Json
                           },
"channel_readiness":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"channel_record_result":
{ Args: { "p_error"?: string,"p_id": number,"p_lease": string,"p_provider"?: string,"p_provider_message_id"?: string,"p_retry_after"?: number,"p_status": string }; Returns: boolean
                           },
"channel_report_provider_status":
{ Args: { "p_channel": string,"p_configured": boolean,"p_missing"?: (string)[],"p_provider": string }; Returns: undefined
                           },
"check_deletion_preview":
{ Args: { "p_token": string,"p_user_id": string }; Returns: Json
                           },
"child_education_reports":
{ Args: { "p_child_id": string }; Returns: Json
                           },
"child_logout":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"child_mode_pin_status":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"child_pin_login":
{ Args: { "p_child_id": string,"p_pin": string }; Returns: boolean
                           },
"child_star_balance":
{ Args: { "p_child_id": string,"p_day"?: string }; Returns: Json
                           },
"child_subject_links":
{ Args: { "p_child_id": string }; Returns: Json
                           },
"child_topic_mastery":
{ Args: { "p_child_id": string }; Returns: {
              "accuracy": number,"correct": number,"grade": number,"last_at": string,"level_total": number,"pending": number,"score": number,"subject": string,"topic": string,"total": number
            }[]
                           },
"claim_operator_reconcile":
{ Args: { "p_id": string }; Returns: Json
                           },
"claim_room_weather_refresh":
{ Args: { "p_city_id": string }; Returns: boolean
                           },
"claim_store_notification":
{ Args: { "p_event_key": string,"p_event_type": string,"p_payload": Json,"p_platform": Database["public"]['Enums']["store_platform"] }; Returns: Json
                           },
"clear_curriculum_pilot_family":
{ Args: { "p_family_id": string }; Returns: Json
                           },
"complete_prova_generation":
{ Args: { "p_id": string,"p_input": number,"p_model": string,"p_output": number,"p_prompt_version": string,"p_rows": Json }; Returns: Json
                           },
"complete_prova_generation_v2":
{ Args: { "p_id": string,"p_input": number,"p_lease": string,"p_model": string,"p_output": number,"p_prompt_version": string,"p_rows": Json }; Returns: Json
                           },
"complete_task":
{ Args: { "p_acting_child_id"?: string,"p_client_id": string,"p_due_date": string,"p_template_id": string }; Returns: {
              "child_id": string,
"client_id": string,
"completed_at": string,
"completed_by": string | null,
"due_date": string,
"family_id": string,
"id": string,
"return_note": string | null,
"return_reason": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": Database["public"]['Enums']["completion_status"],
"task_snapshot": Json | null,
"template_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "task_completions"
        isOneToOne: true
        isSetofReturn: false
      } },
"configure_child_device":
{ Args: { "p_child_ids": (string)[],"p_device_id": string,"p_name": string,"p_pin_required": boolean }; Returns: undefined
                           },
"confirm_child_deletion":
{ Args: { "p_child_id": string,"p_preview_token": string,"p_request_id": string }; Returns: Json
                           },
"confirm_contact_verification":
{ Args: { "p_token": string }; Returns: Json
                           },
"content_prereview_claim":
{ Args: { "p_id": string,"p_kind": string,"p_lease": string,"p_prompt_version": string }; Returns: Json
                           },
"content_prereview_finish":
{ Args: { "p_error"?: string,"p_id": string,"p_kind": string,"p_lease": string,"p_status": string,"p_verdict": Json }; Returns: Json
                           },
"content_prereview_library_images":
{ Args: { "p_id": string,"p_lease": string }; Returns: Json
                           },
"content_prereview_next":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"content_prereview_provider":
{ Args: { "p_error"?: string,"p_ok"?: boolean,"p_provider": string,"p_uncertain"?: boolean }; Returns: Json
                           },
"contribution_review_trail":
{ Args: { "p_id": string }; Returns: Json
                           },
"create_child_outcome_share":
{ Args: { "p_child_id": string,"p_expires_in_days": number,"p_label": string,"p_preview_hash": string,"p_scopes": (string)[],"p_subject": string }; Returns: {
              "expires_at": string,"id": string,"token": string
            }[]
                           },
"create_child_share":
{ Args: { "p_child_id": string,"p_expires_in_days"?: number,"p_label": string,"p_scopes": (string)[] }; Returns: {
              "expires_at": string,"id": string,"token": string
            }[]
                           },
"create_family":
{ Args: { "p_display_name"?: string,"p_name": string }; Returns: string
                           },
"create_help_ticket":
{ Args: { "p_body": string,"p_category": string,"p_kind": string,"p_request_id": string,"p_subject": string }; Returns: Json
                           },
"create_level_test":
{ Args: { "p_blueprint_id"?: string,"p_child_id": string,"p_duration_minutes"?: number,"p_grade": number,"p_max_questions"?: number,"p_per_topic"?: number,"p_subject": string,"p_timed"?: boolean,"p_title"?: string }; Returns: {
              "academic_year": number | null,
"assessment_track": string | null,
"blueprint_id": string | null,
"child_id": string,
"content_locked_at": string | null,
"created_at": string,
"created_by": string | null,
"duration_minutes": number | null,
"education_context": Json | null,
"education_period_id": string | null,
"exam_scope": string | null,
"family_id": string,
"grade": number,
"id": string,
"kind": string,
"preparation": Json | null,
"question_ids": (string)[],
"question_reading_override": string,
"school_declared": boolean | null,
"status": Database["public"]['Enums']["exam_status"],
"subject": string,
"subject_links": Json | null,
"term": number | null,
"timed": boolean,
"title": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "exams"
        isOneToOne: true
        isSetofReturn: false
      } },
"custom_access_token_hook":
{ Args: { "event": Json }; Returns: Json
                           },
"decide_education_holiday":
{ Args: { "p_child_id": string,"p_decision": string,"p_key": string,"p_request_id": string,"p_revision": number }; Returns: Json
                           },
"decide_reward_request":
{ Args: { "p_approve": boolean,"p_request_id": string }; Returns: {
              "child_id": string,
"cost_snapshot": number,
"decided_at": string | null,
"decided_by": string | null,
"delivered_at": string | null,
"family_id": string,
"goal_id": string | null,
"id": string,
"idempotency_key": string,
"requested_at": string,
"reward_id": string,
"reward_snapshot": Json | null,
"status": Database["public"]['Enums']["reward_request_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "reward_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"defer_study_day":
{ Args: { "p_child_id": string,"p_day": string }; Returns: {
              "repeat_count": number,"task_count": number
            }[]
                           },
"delete_learning_source":
{ Args: { "p_source_id": string }; Returns: undefined
                           },
"deletion_preview":
{ Args: { "p_target": Json }; Returns: Json
                           },
"deliver_reward_request":
{ Args: { "p_request_id": string }; Returns: {
              "child_id": string,
"cost_snapshot": number,
"decided_at": string | null,
"decided_by": string | null,
"delivered_at": string | null,
"family_id": string,
"goal_id": string | null,
"id": string,
"idempotency_key": string,
"requested_at": string,
"reward_id": string,
"reward_snapshot": Json | null,
"status": Database["public"]['Enums']["reward_request_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "reward_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"device_pairing_status":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"education_calendar_catalog":
{ Args: { "p_child_id"?: string }; Returns: Json
                           },
"education_change_state":
{ Args: { "p_child_id": string }; Returns: Json
                           },
"education_holiday_suggestions":
{ Args: { "p_child_id": string }; Returns: Json
                           },
"education_report_periods":
{ Args: { "p_child_id": string }; Returns: Json
                           },
"enqueue_content_prereview":
{ Args: { "p_scope": string }; Returns: Json
                           },
"enroll_group_exam":
{ Args: { "p_child": string,"p_consent": boolean,"p_group": string,"p_ranking": boolean }; Returns: string
                           },
"enroll_reviewed_group_exam":
{ Args: { "p_child": string,"p_consent": boolean,"p_group": string,"p_ranking": boolean,"p_review_consent": boolean }; Returns: string
                           },
"expire_unlinked_learning_sources":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"fail_prova_generation_v2":
{ Args: { "p_code": string,"p_id": string,"p_lease": string,"p_uncertain": boolean }; Returns: undefined
                           },
"family_library_credits":
{ Args: { "p_family_id"?: string }; Returns: Json
                           },
"family_star_balances":
{ Args: Record<PropertyKey, never>; Returns: {
              "balance": number,"child_id": string
            }[]
                           },
"finance_reconcile_jobs":
{ Args: { "p_family_id": string }; Returns: Json
                           },
"finance_request_reconcile":
{ Args: { "p_family_id": string,"p_id": string,"p_reason": string,"p_subscription_id": string }; Returns: Json
                           },
"finance_workspace":
{ Args: { "p_family_id"?: string,"p_query"?: string }; Returns: Json
                           },
"finish_ai_operation":
{ Args: { "p_error"?: string,"p_id": string,"p_lease": string,"p_result": Json,"p_uncertain"?: boolean }; Returns: undefined
                           },
"finish_exam_attempt":
{ Args: { "p_attempt_id": string }; Returns: {
              "ai_feedback": Json | null,
"child_id": string,
"created_at": string,
"deadline_at": string | null,
"exam_id": string,
"family_id": string,
"finished_at": string | null,
"graded_at": string | null,
"id": string,
"items_partial": number | null,
"items_pending": number | null,
"items_scored": number | null,
"items_total": number | null,
"items_unanswered": number | null,
"mc_correct": number | null,
"mc_total": number | null,
"open_graded": number | null,
"open_pending": number | null,
"open_total": number | null,
"open_unanswered": number | null,
"provisional": boolean | null,
"score_pct": number | null,
"started_at": string,
"status": Database["public"]['Enums']["attempt_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "exam_attempts"
        isOneToOne: true
        isSetofReturn: false
      } },
"finish_operator_reconcile":
{ Args: { "p_code"?: string,"p_id": string,"p_state"?: Json,"p_token": string }; Returns: Json
                           },
"finish_question_contribution":
{ Args: { "p_actor": string,"p_family": string,"p_id": string,"p_media": Json }; Returns: Json
                           },
"finish_setup_generation":
{ Args: { "p_id": string,"p_lease": string,"p_result": Json,"p_unknown"?: boolean }; Returns: boolean
                           },
"finish_store_notification":
{ Args: { "p_error"?: string,"p_event_key": string,"p_platform": Database["public"]['Enums']["store_platform"],"p_store_key"?: string,"p_token": string }; Returns: boolean
                           },
"future_learning_ready":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"get_ai_usage":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_answer_review":
{ Args: { "p_attempt_id": string,"p_question_id": string }; Returns: Json
                           },
"get_attempt_questions":
{ Args: { "p_exam_id": string }; Returns: {
              "choices": Json,"difficulty": Database["public"]['Enums']["question_difficulty"],"id": string,"kind": Database["public"]['Enums']["question_kind"],"ord": number,"stem": string
            }[]
                           },
"get_attempt_questions_v2":
{ Args: { "p_exam_id": string,"p_supported": (string)[] }; Returns: {
              "choices": Json,"difficulty": Database["public"]['Enums']["question_difficulty"],"id": string,"interaction_type": string,"kind": Database["public"]['Enums']["question_kind"],"ord": number,"payload": Json,"schema_version": number,"stem": string
            }[]
                           },
"get_attempt_summary":
{ Args: { "p_attempt_id": string }; Returns: Json
                           },
"get_attempt_topic_stats":
{ Args: { "p_attempt_id": string }; Returns: {
              "pct": number,"pending": number,"topic": string,"total": number
            }[]
                           },
"get_beta_test_access":
{ Args: Record<PropertyKey, never>; Returns: {
              "expires_at": string,"selected_plan": Database["public"]['Enums']["plan_code"]
            }[]
                           },
"get_catalog_blueprint_context":
{ Args: { "p_blueprint_id": string,"p_family_id": string }; Returns: Json
                           },
"get_child_answer_reviews":
{ Args: { "p_attempt_id": string }; Returns: Json
                           },
"get_child_archive_preview":
{ Args: { "p_child_id": string }; Returns: Json
                           },
"get_child_device_access":
{ Args: { "p_device_id"?: string }; Returns: Json
                           },
"get_child_education":
{ Args: { "p_child_id": string }; Returns: Json
                           },
"get_child_question_solution":
{ Args: { "p_attempt_id": string,"p_question_id": string }; Returns: Json
                           },
"get_child_question_type_support":
{ Args: { "p_child_id": string }; Returns: Json
                           },
"get_curriculum_pilot_family":
{ Args: { "p_family_id": string }; Returns: Json
                           },
"get_curriculum_scenarios":
{ Args: { "p_child_id": string,"p_exam": number,"p_subject": string,"p_term": number,"p_year": string }; Returns: Json
                           },
"get_curriculum_source_freshness":
{ Args: { "p_subject": string,"p_term": number,"p_year": string }; Returns: Json
                           },
"get_curriculum_source_status":
{ Args: { "p_subject": string,"p_term": number,"p_year": string }; Returns: Json
                           },
"get_curriculum_source_target":
{ Args: { "p_exam_family": string,"p_term": number,"p_year": string }; Returns: Json
                           },
"get_discarded_prova_drafts":
{ Args: { "p_before_id"?: string,"p_before_updated"?: string,"p_child_id"?: string }; Returns: Json
                           },
"get_family_entitlement":
{ Args: { "p_family_id"?: string }; Returns: {
              "expires_at": string,"plan": Database["public"]['Enums']["plan_code"],"source": string
            }[]
                           },
"get_family_weekly_review":
{ Args: { "p_week"?: string }; Returns: Json
                           },
"get_group_exams":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_group_result":
{ Args: { "p_child": string,"p_group": string }; Returns: Json
                           },
"get_guided_input_options":
{ Args: { "p_child": string,"p_kind": string }; Returns: Json
                           },
"get_help_articles":
{ Args: { "p_editor"?: boolean,"p_locale"?: string,"p_platform"?: string }; Returns: Json
                           },
"get_help_attachment":
{ Args: { "p_attachment_id": string }; Returns: Json
                           },
"get_help_editor_article":
{ Args: { "p_id": string }; Returns: Json
                           },
"get_help_ticket":
{ Args: { "p_before"?: number,"p_ticket_id": string }; Returns: Json
                           },
"get_interaction_types":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_learning_library":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_learning_plan":
{ Args: { "p_child_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"get_learning_plan_import":
{ Args: { "p_child_id": string,"p_locale": string,"p_source_id": string }; Returns: Json
                           },
"get_learning_plan_item":
{ Args: { "p_child_id": string,"p_id": string }; Returns: Json
                           },
"get_learning_source_access":
{ Args: { "p_question_id"?: string,"p_source_id": string }; Returns: Json
                           },
"get_learning_source_policy":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_learning_source_set":
{ Args: { "p_source": string }; Returns: Json
                           },
"get_legacy_open_zero_corrections":
{ Args: { "p_family_id"?: string }; Returns: Json
                           },
"get_library_items":
{ Args: { "p_collection_id": string }; Returns: Json
                           },
"get_library_package_units":
{ Args: { "p_package_id": string }; Returns: Json
                           },
"get_prova_drafts":
{ Args: { "p_id"?: string }; Returns: Json
                           },
"get_prova_entitlement":
{ Args: { "p_family_id"?: string }; Returns: Json
                           },
"get_prova_favorite_shapes":
{ Args: { "p_family_id": string,"p_grade": number,"p_parent_id": string,"p_subject": string }; Returns: {
              "cognitive_demand": string,"difficulty": string,"kind": string
            }[]
                           },
"get_prova_favorite_style_available":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"get_prova_question_fit":
{ Args: { "p_child_id": string,"p_question_ids": (string)[] }; Returns: Json
                           },
"get_published_library_packages":
{ Args: { "p_grade": number,"p_subject": string }; Returns: Json
                           },
"get_question_answer_keys":
{ Args: { "p_question_ids": (string)[] }; Returns: Json
                           },
"get_question_context":
{ Args: { "p_question_ids": (string)[] }; Returns: Json
                           },
"get_question_group_policy":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"get_question_media":
{ Args: { "p_question_ids": (string)[] }; Returns: Json
                           },
"get_question_reading_permission":
{ Args: { "p_exam_id": string }; Returns: boolean
                           },
"get_reinforcement_questions":
{ Args: { "p_child_id": string,"p_question_id": string }; Returns: (string)[]
                           },
"get_reinforcement_suggestions":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_repeat_calendar":
{ Args: { "p_attempt_id": string }; Returns: Json
                           },
"get_repeat_calendar_event":
{ Args: { "p_event_id": string }; Returns: Json
                           },
"get_repeat_candidates":
{ Args: { "p_draft_id": string }; Returns: Json
                           },
"get_review_ai_policy":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_saved_exam_answers":
{ Args: { "p_attempt_id": string }; Returns: {
              "answer_key": string,"answer_text": string,"question_id": string
            }[]
                           },
"get_saved_exam_answers_v2":
{ Args: { "p_attempt_id": string }; Returns: {
              "answer_key": string,"answer_text": string,"question_id": string,"revision": number
            }[]
                           },
"get_saved_exam_answers_v3":
{ Args: { "p_attempt_id": string }; Returns: {
              "answer_document": Json,"answer_key": string,"answer_text": string,"question_id": string,"revision": number
            }[]
                           },
"get_saved_exam_answers_v4":
{ Args: { "p_attempt_id": string }; Returns: {
              "answer": Json,"answer_document": Json,"answer_key": string,"answer_text": string,"question_id": string,"revision": number
            }[]
                           },
"get_scenario_question_fit":
{ Args: { "p_question_ids": (string)[] }; Returns: Json
                           },
"get_school_bag":
{ Args: { "p_child_id": string,"p_day": string }; Returns: Json
                           },
"get_setup_ai_entitlement":
{ Args: { "p_family_id"?: string }; Returns: Json
                           },
"get_setup_sources":
{ Args: { "p_ids": (string)[],"p_kind": string }; Returns: Json
                           },
"get_shared_child_view":
{ Args: { "p_token": string }; Returns: Json
                           },
"get_structured_score_overrides":
{ Args: { "p_attempt_id": string }; Returns: Json
                           },
"get_study_day_deferral":
{ Args: { "p_child_id": string }; Returns: {
              "day": string,"deferred": boolean,"repeat_count": number,"task_count": number
            }[]
                           },
"get_study_preference_history":
{ Args: { "p_child_id": string }; Returns: {
              "actor": string,"changed_at": string,"id": number,"new_value": string,"setting": string
            }[]
                           },
"get_study_preferences":
{ Args: { "p_child_id": string }; Returns: {
              "break_minutes": number,"evening_end": number,"evening_start": number,"timezone": string
            }[]
                           },
"get_timetable_sources":
{ Args: { "p_child_id": string }; Returns: Json
                           },
"get_weekly_summary_data":
{ Args: { "p_family_id": string,"p_week_start": string }; Returns: Json
                           },
"group_exam_phases":
{ Args: { "p_group": string }; Returns: Json
                           },
"help_ticket_updates":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"iap_reconcile_candidates":
{ Args: { "p_limit"?: number,"p_min_age"?: string,"p_window"?: string }; Returns: {
              "expires_at": string,"family_id": string,"id": string,"platform": Database["public"]['Enums']["store_platform"],"product_id": string,"status": Database["public"]['Enums']["subscription_status"],"store_key": string
            }[]
                           },
"join_family":
{ Args: { "p_display_name"?: string,"p_invite_code": string }; Returns: string
                           },
"learning_outcome_observations":
{ Args: { "p_child_id": string,"p_days"?: number,"p_grade"?: number,"p_period"?: string,"p_subject"?: string }; Returns: Json
                           },
"learning_progress":
{ Args: { "p_child_id": string,"p_days"?: number,"p_grade"?: number,"p_subject"?: string }; Returns: Json
                           },
"learning_progress_education":
{ Args: { "p_child_id": string,"p_days"?: number,"p_grade"?: number,"p_period"?: string,"p_subject"?: string }; Returns: Json
                           },
"library_policy_preview":
{ Args: { "p_accepted_count": number,"p_rules"?: Json }; Returns: Json
                           },
"list_help_attachments":
{ Args: { "p_ticket_id": string }; Returns: Json
                           },
"list_help_editor_articles":
{ Args: { "p_after_id"?: string,"p_after_slug"?: string,"p_locale"?: string,"p_platform"?: string }; Returns: Json
                           },
"list_help_tickets":
{ Args: { "p_kind"?: string,"p_offset"?: number,"p_operator"?: boolean,"p_status"?: string }; Returns: Json
                           },
"list_my_families":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"list_operator_help_tickets":
{ Args: { "p_before_id"?: string,"p_before_time"?: string,"p_category"?: string,"p_kind"?: string,"p_status"?: string }; Returns: Json
                           },
"list_question_contributions":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"list_scenario_question_fit":
{ Args: { "p_limit"?: number,"p_state"?: string }; Returns: Json
                           },
"list_school_grades":
{ Args: { "p_before_date"?: string,"p_before_id"?: string,"p_child_id": string,"p_period"?: string }; Returns: Json
                           },
"mark_help_ticket_read":
{ Args: { "p_sequence": number,"p_ticket_id": string }; Returns: Json
                           },
"mark_operator_prereview_notices_read":
{ Args: { "p_ids"?: (string)[] }; Returns: Json
                           },
"mark_parent_inbox":
{ Args: { "p_archived"?: boolean,"p_id": string }; Returns: undefined
                           },
"my_admin_access":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_notification_channels":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_operation_roles":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"note_history":
{ Args: { "p_before_revision"?: number,"p_id": string }; Returns: Json
                           },
"operator_prereview_notices":
{ Args: { "p_limit"?: number,"p_unread_only"?: boolean }; Returns: Json
                           },
"pair_child_device":
{ Args: { "p_code": string }; Returns: string
                           } |
{ Args: { "p_code": string,"p_preview_token": string }; Returns: string
                           },
"pair_device":
{ Args: { "p_code": string }; Returns: string
                           } |
{ Args: { "p_code": string,"p_preview_token": string }; Returns: string
                           },
"parent_inbox":
{ Args: { "p_archived"?: boolean,"p_before"?: string,"p_before_id"?: string }; Returns: Json
                           },
"parent_pin_set":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"pick_level_questions":
{ Args: { "p_blueprint_id"?: string,"p_grade": number,"p_max_questions"?: number,"p_per_topic"?: number,"p_subject": string }; Returns: {
              "difficulty": Database["public"]['Enums']["question_difficulty"],"ord": number,"question_id": string,"topic": string
            }[]
                           },
"plan_for_day":
{ Args: { "p_child_id": string,"p_day": string }; Returns: Json
                           },
"plan_for_days":
{ Args: { "p_child_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"prepare_learning_plan_import":
{ Args: { "p_child": string,"p_context": Json,"p_family": string,"p_locale": string,"p_source": string,"p_user": string }; Returns: Json
                           },
"prepare_library_delivery_media":
{ Args: { "p_actor": string,"p_assets": Json,"p_package_id": string }; Returns: undefined
                           },
"prepare_weekly_summary":
{ Args: { "p_context": Json,"p_family": string,"p_user": string,"p_week": string }; Returns: Json
                           },
"preview_device_pairing":
{ Args: { "p_code": string }; Returns: Json
                           },
"preview_education_calendar":
{ Args: { "p_academic_year": number,"p_action": string,"p_child_id": string,"p_place_id": string,"p_stage": string,"p_starts_on": string }; Returns: Json
                           },
"preview_education_period_transfer":
{ Args: { "p_child_id": string,"p_from_period_id": string,"p_to_period_id": string }; Returns: Json
                           },
"preview_family_invite":
{ Args: { "p_invite_code": string }; Returns: Json
                           },
"preview_legacy_open_zero_corrections":
{ Args: { "p_family_id"?: string }; Returns: Json
                           },
"preview_question_contribution":
{ Args: { "p_question_id": string }; Returns: Json
                           },
"preview_teacher_outcome_share":
{ Args: { "p_child_id": string,"p_subject"?: string }; Returns: Json
                           },
"push_claim_batch":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,
"audience": string,
"claimed_at": string | null,
"created_at": string,
"exclude_user_id": string | null,
"family_id": string,
"id": number,
"kind": string,
"last_error": string | null,
"lease_id": string | null,
"next_attempt_at": string,
"payload": NonNullable<Json>,
"recovery_revision": number,
"sent_at": string | null,
"status": string,
"target_child_id": string | null,
"target_user_id": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "push_outbox"
        isOneToOne: false
        isSetofReturn: true
      } },
"push_claim_v2":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,
"audience": string,
"claimed_at": string | null,
"created_at": string,
"exclude_user_id": string | null,
"family_id": string,
"id": number,
"kind": string,
"last_error": string | null,
"lease_id": string | null,
"next_attempt_at": string,
"payload": NonNullable<Json>,
"recovery_revision": number,
"sent_at": string | null,
"status": string,
"target_child_id": string | null,
"target_user_id": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "push_outbox"
        isOneToOne: false
        isSetofReturn: true
      } },
"push_delivery_targets":
{ Args: { "p_lease": string,"p_outbox_id": number }; Returns: {
              "locale": string,"platform": string,"token": string,"token_hash": string,"token_id": string,"token_type": string
            }[]
                           },
"push_finish_delivery":
{ Args: { "p_lease": string,"p_outbox_id": number }; Returns: string
                           },
"push_record_delivery":
{ Args: { "p_error"?: string,"p_lease": string,"p_outbox_id": number,"p_retry_after"?: number,"p_status": string,"p_token_hash": string,"p_token_id": string }; Returns: boolean
                           },
"push_targets":
{ Args: { "p_outbox_id": number }; Returns: {
              "locale": string,"platform": string,"token": string,"token_id": string,"token_type": string
            }[]
                           },
"read_library_source_bytes":
{ Args: { "p_source_id": string }; Returns: Json
                           },
"record_curriculum_extraction_service":
{ Args: { "p_actor_id": string,"p_request_id": string,"p_result": Json,"p_revision_id": string }; Returns: Json
                           },
"record_curriculum_source_fetch":
{ Args: { "p_actor_id": string,"p_request_id": string,"p_revision": Json,"p_source": Json }; Returns: Json
                           },
"record_scenario_question_fit_suggestion":
{ Args: { "p_question_id": string,"p_verdict": Json }; Returns: Json
                           },
"record_source_cleanup":
{ Args: { "p_path": string,"p_success": boolean }; Returns: undefined
                           },
"record_store_account_conflict":
{ Args: { "p_caller_family_id": string,"p_platform": Database["public"]['Enums']["store_platform"],"p_source"?: string,"p_store_key": string,"p_user_id"?: string }; Returns: string
                           },
"redeem_library_item":
{ Args: { "p_item_id": string }; Returns: string
                           },
"register_learning_source_set":
{ Args: { "p_ids": (string)[] }; Returns: string
                           },
"register_push_token":
{ Args: { "p_locale"?: string,"p_platform": string,"p_token": string }; Returns: undefined
                           },
"register_timetable_import":
{ Args: { "p_child": string,"p_job": string,"p_source": string }; Returns: Json
                           },
"reject_device_pairing":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"release_channel_failure_page":
{ Args: { "p_before"?: string,"p_before_id"?: number,"p_channel"?: string,"p_limit"?: number,"p_reason"?: string }; Returns: Json
                           },
"release_channel_failures":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"release_channel_operations":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"release_curriculum_extraction":
{ Args: { "p_actor_id": string,"p_error": string,"p_revision_id": string }; Returns: Json
                           },
"release_push_operations":
{ Args: { "p_before"?: number,"p_limit"?: number,"p_status"?: string }; Returns: Json
                           },
"release_requeue_channel":
{ Args: { "p_id": number }; Returns: Json
                           },
"release_retry_push":
{ Args: { "p_confirmed": boolean,"p_outbox_id": number,"p_reason": string,"p_request": string,"p_revision": number }; Returns: Json
                           },
"reply_help_ticket":
{ Args: { "p_body": string,"p_internal"?: boolean,"p_request_id": string,"p_revision": number,"p_status"?: string,"p_ticket_id": string }; Returns: Json
                           },
"report_question":
{ Args: { "p_attempt_id"?: string,"p_question_id": string,"p_reason": string,"p_request_id": string }; Returns: string
                           },
"request_contact_verification":
{ Args: { "p_kind": string,"p_value": string }; Returns: Json
                           },
"request_content_prereview":
{ Args: { "p_id": string,"p_kind": string }; Returns: Json
                           },
"request_pairing":
{ Args: { "p_device_name"?: string }; Returns: string
                           },
"request_reward":
{ Args: { "p_acting_child_id"?: string,"p_idempotency_key": string,"p_reward_id": string }; Returns: {
              "child_id": string,
"cost_snapshot": number,
"decided_at": string | null,
"decided_by": string | null,
"delivered_at": string | null,
"family_id": string,
"goal_id": string | null,
"id": string,
"idempotency_key": string,
"requested_at": string,
"reward_id": string,
"reward_snapshot": Json | null,
"status": Database["public"]['Enums']["reward_request_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "reward_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"reserve_ai_operation":
{ Args: { "p_action": string,"p_family_id": string,"p_hash": string,"p_lease": string,"p_provider"?: string,"p_user_id": string }; Returns: Json
                           },
"reserve_catalog_prova_generation":
{ Args: { "p_blueprint_id": string,"p_draft_id": string,"p_family_id": string,"p_hash": string,"p_id": string,"p_items": number,"p_user_id": string }; Returns: Json
                           },
"reserve_child_ai_operation":
{ Args: { "p_action": string,"p_child_id": string,"p_family_id": string,"p_hash": string,"p_lease": string,"p_user_id": string }; Returns: Json
                           },
"reserve_child_ai_operation_routed":
{ Args: { "p_action": string,"p_child_id": string,"p_family_id": string,"p_hash": string,"p_lease": string,"p_provider": string,"p_user_id": string }; Returns: Json
                           },
"reserve_learning_plan_import":
{ Args: { "p_context": string,"p_family": string,"p_lease": string,"p_provider"?: string,"p_user": string }; Returns: Json
                           },
"reserve_learning_source":
{ Args: { "p_bytes": number,"p_consent": boolean,"p_id": string,"p_kind": string,"p_mime": string,"p_name": string,"p_sha256": string }; Returns: Json
                           },
"reserve_prova_generation":
{ Args: { "p_family_id": string,"p_hash": string,"p_id": string,"p_items": number,"p_user_id": string }; Returns: Json
                           },
"reserve_prova_generation_v2":
{ Args: { "p_family_id": string,"p_hash": string,"p_id": string,"p_items": number,"p_user_id": string }; Returns: Json
                           },
"reserve_prova_generation_v3":
{ Args: { "p_context": Json,"p_family_id": string,"p_hash": string,"p_id": string,"p_intent": Json,"p_items": number,"p_user_id": string }; Returns: Json
                           },
"reserve_setup_ai":
{ Args: { "p_family_id": string,"p_hash": string,"p_id": string,"p_user_id": string }; Returns: Json
                           },
"reserve_setup_generation":
{ Args: { "p_family_id": string,"p_hash": string,"p_id": string,"p_lease": string,"p_user_id": string }; Returns: Json
                           },
"reserve_weekly_summary":
{ Args: { "p_context": string,"p_family": string,"p_lease": string,"p_provider"?: string,"p_user": string }; Returns: Json
                           },
"resolve_ai_chain":
{ Args: { "p_plan": string,"p_usage_key": string }; Returns: Json
                           },
"resolve_question_report":
{ Args: { "p_id": string,"p_status": string }; Returns: undefined
                           },
"resume_prova_generation":
{ Args: { "p_family_id": string,"p_id": string,"p_intent": Json,"p_user_id": string }; Returns: Json
                           },
"review_answer_fingerprint":
{ Args: { "p_attempt_id": string,"p_question_id": string }; Returns: string
                           },
"review_help_article":
{ Args: { "p_action": string,"p_id": string,"p_reason": string,"p_request_id": string,"p_revision": number }; Returns: Json
                           },
"review_scenario_question_fit":
{ Args: { "p_input": Json,"p_question_id": string,"p_request_id": string }; Returns: Json
                           },
"review_task":
{ Args: { "p_approve": boolean,"p_completion_id": string }; Returns: {
              "child_id": string,
"client_id": string,
"completed_at": string,
"completed_by": string | null,
"due_date": string,
"family_id": string,
"id": string,
"return_note": string | null,
"return_reason": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": Database["public"]['Enums']["completion_status"],
"task_snapshot": Json | null,
"template_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "task_completions"
        isOneToOne: true
        isSetofReturn: false
      } },
"review_task_once":
{ Args: { "p_approve": boolean,"p_completion_id": string,"p_expected_completed_at": string,"p_request_id": string,"p_return_note"?: string,"p_return_reason"?: string }; Returns: Json
                           },
"revoke_child_share":
{ Args: { "p_share_id": string }; Returns: undefined
                           },
"revoke_contact_channel":
{ Args: { "p_kind": string }; Returns: Json
                           },
"revoke_device":
{ Args: { "p_device_id": string }; Returns: undefined
                           },
"reward_history":
{ Args: { "p_before_revision"?: number,"p_id": string }; Returns: Json
                           },
"routines_for_day":
{ Args: { "p_child_id": string,"p_day": string }; Returns: Json
                           },
"save_ai_group_edit":
{ Args: { "p_group": Json,"p_group_id": string,"p_questions": Json,"p_request_id": string }; Returns: Json
                           },
"save_ai_question_edit":
{ Args: { "p_question": Json,"p_request_id": string,"p_source_id": string }; Returns: Json
                           },
"save_answer_review":
{ Args: { "p_ai_id"?: string,"p_answer_hash": string,"p_attempt_id": string,"p_document": Json,"p_feedback": string,"p_question_id": string,"p_request_id": string,"p_revision": number,"p_score": number }; Returns: number
                           },
"save_calendar_event":
{ Args: { "p_event_id": string,"p_request_id": string,"p_revision": number,"p_values": Json }; Returns: Json
                           },
"save_catalog_blueprint":
{ Args: { "p_input": Json,"p_request_id": string }; Returns: string
                           },
"save_child_setup":
{ Args: { "p_child_id"?: string,"p_profile": Json,"p_request_id": string,"p_tasks"?: Json }; Returns: string
                           },
"save_family_blueprint":
{ Args: { "p_input": Json,"p_request_id": string }; Returns: string
                           },
"save_help_article":
{ Args: { "p_body": string,"p_id": string,"p_locale": string,"p_platform": string,"p_request_id": string,"p_revision": number,"p_slug": string,"p_title": string }; Returns: Json
                           },
"save_learning_plan":
{ Args: { "p_child_id": string,"p_content": Json,"p_id": string,"p_request_id": string,"p_revision": number }; Returns: Json
                           },
"save_parent_note":
{ Args: { "p_action"?: string,"p_child_id"?: string,"p_id"?: string,"p_request_id": string,"p_revision"?: number,"p_value"?: Json }; Returns: Json
                           },
"save_prova_draft":
{ Args: { "p_content": Json,"p_id": string,"p_request_id": string,"p_version": number }; Returns: Json
                           },
"save_prova_provider_result":
{ Args: { "p_id": string,"p_lease": string,"p_result": Json }; Returns: undefined
                           },
"save_question_source_group":
{ Args: { "p_group": Json,"p_images"?: Json,"p_previous_id"?: string,"p_questions": Json,"p_request_id": string }; Returns: Json
                           },
"save_question_with_sources":
{ Args: { "p_images"?: Json,"p_question": Json,"p_request_id": string }; Returns: string
                           },
"save_school_bag":
{ Args: { "p_child_id": string,"p_day": string,"p_items": Json,"p_program_revision": number,"p_request_id": string,"p_revision": number }; Returns: Json
                           },
"save_school_timetable":
{ Args: { "p_child_id": string,"p_lessons": Json,"p_revision": number,"p_settings": Json }; Returns: number
                           } |
{ Args: { "p_child_id": string,"p_effective_from": string,"p_lessons": Json,"p_revision": number,"p_settings": Json }; Returns: number
                           },
"save_school_timetable_request":
{ Args: { "p_child_id": string,"p_effective_from"?: string,"p_lessons": Json,"p_request_id": string,"p_revision": number,"p_settings": Json }; Returns: Json
                           },
"save_setup_batch":
{ Args: { "p_child_id"?: string,"p_items": Json,"p_kind": string,"p_request_id": string }; Returns: Json
                           },
"save_support_canned_reply":
{ Args: { "p_archived"?: boolean,"p_body": string,"p_categories"?: (string)[],"p_expected_revision": number,"p_id": string,"p_locale": string,"p_position"?: number,"p_request_id": string,"p_title": string }; Returns: Json
                           },
"schedule_child_education_change":
{ Args: { "p_academic_year": number,"p_action": string,"p_child_id": string,"p_grade": number,"p_keep_timetable": boolean,"p_request_id": string,"p_revision": number,"p_school": string,"p_starts_on": string }; Returns: Json
                           },
"schedule_child_education_change_with_calendar":
{ Args: { "p_academic_year": number,"p_action": string,"p_calendar_id": string,"p_calendar_revision": number,"p_child_id": string,"p_detail": string,"p_grade": number,"p_keep_timetable": boolean,"p_place_id": string,"p_reason": string,"p_request_id": string,"p_revision": number,"p_school": string,"p_stage": string,"p_starts_on": string }; Returns: Json
                           },
"school_grade_history":
{ Args: { "p_before_revision"?: number,"p_id": string }; Returns: Json
                           },
"school_grade_records":
{ Args: { "p_before_date"?: string,"p_before_id"?: string,"p_child_id": string,"p_period"?: string,"p_withdrawn"?: boolean }; Returns: Json
                           },
"score_open_answer":
{ Args: { "p_attempt_id": string,"p_feedback"?: string,"p_question_id": string,"p_score": number }; Returns: {
              "ai_feedback": Json | null,
"child_id": string,
"created_at": string,
"deadline_at": string | null,
"exam_id": string,
"family_id": string,
"finished_at": string | null,
"graded_at": string | null,
"id": string,
"items_partial": number | null,
"items_pending": number | null,
"items_scored": number | null,
"items_total": number | null,
"items_unanswered": number | null,
"mc_correct": number | null,
"mc_total": number | null,
"open_graded": number | null,
"open_pending": number | null,
"open_total": number | null,
"open_unanswered": number | null,
"provisional": boolean | null,
"score_pct": number | null,
"started_at": string,
"status": Database["public"]['Enums']["attempt_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "exam_attempts"
        isOneToOne: true
        isSetofReturn: false
      } },
"select_family":
{ Args: { "p_family_id": string }; Returns: undefined
                           },
"set_beta_test_plan":
{ Args: { "p_plan"?: Database["public"]['Enums']["plan_code"] }; Returns: undefined
                           },
"set_child_archived":
{ Args: { "p_archived": boolean,"p_child_id": string,"p_request_id": string,"p_revision": number }; Returns: Json
                           },
"set_child_goal":
{ Args: { "p_acting_child_id"?: string,"p_reward_id": string }; Returns: {
              "child_id": string,
"created_at": string,
"created_by": string | null,
"decided_at": string | null,
"family_id": string,
"id": string,
"reward_id": string,
"status": Database["public"]['Enums']["child_goal_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "child_goals"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_child_pin":
{ Args: { "p_child_id": string,"p_pin": string }; Returns: undefined
                           },
"set_child_subject_links":
{ Args: { "p_child_id": string,"p_links": Json,"p_request_id": string,"p_source"?: string }; Returns: Json
                           },
"set_curriculum_pilot_family":
{ Args: { "p_family_id": string,"p_hours": number,"p_reason": string }; Returns: Json
                           },
"set_group_ranking_consent":
{ Args: { "p_child": string,"p_enabled": boolean,"p_group": string }; Returns: undefined
                           },
"set_idea_stage":
{ Args: { "p_expected_similar": string,"p_expected_stage": string,"p_request_id": string,"p_similar_to": string,"p_stage": string,"p_ticket_id": string }; Returns: Json
                           },
"set_notification_preference":
{ Args: { "p_channel": string,"p_enabled": boolean,"p_purpose": string }; Returns: Json
                           },
"set_operation_member":
{ Args: { "p_expires_at": string,"p_reason": string,"p_revoke": boolean,"p_role": string,"p_user_id": string }; Returns: undefined
                           },
"set_parent_pin":
{ Args: { "p_pin": string }; Returns: undefined
                           },
"set_prova_draft_discarded":
{ Args: { "p_discarded": boolean,"p_id": string,"p_request_id": string,"p_version": number }; Returns: Json
                           },
"set_question_child_signal":
{ Args: { "p_attempt_id": string,"p_field": string,"p_question_id": string,"p_selected": boolean }; Returns: undefined
                           },
"set_question_focus":
{ Args: { "p_child_id": string,"p_question_id": string,"p_selected": boolean }; Returns: undefined
                           },
"set_room_pet":
{ Args: { "p_acting_child_id"?: string,"p_pet": string }; Returns: undefined
                           },
"set_room_preference":
{ Args: { "p_acting_child_id"?: string,"p_character": string,"p_theme"?: string }; Returns: undefined
                           },
"set_structured_answer_score":
{ Args: { "p_answer_hash": string,"p_attempt_id": string,"p_question_id": string,"p_reason"?: string,"p_request_id": string,"p_score": number }; Returns: Json
                           },
"set_study_plan_status":
{ Args: { "p_plan_id": string,"p_status": string }; Returns: {
              "ai_job_id": string | null,
"attempt_id": string | null,
"child_id": string,
"created_at": string,
"created_by": string | null,
"family_id": string,
"grade": number,
"id": string,
"input_hash": string | null,
"model": string | null,
"plan": NonNullable<Json>,
"prompt_version": string | null,
"status": string,
"subject": string,
"updated_at": string,
"weak_topics": NonNullable<Json>
            }
                          SetofOptions: {
        from: "*"
        to: "study_plans"
        isOneToOne: true
        isSetofReturn: false
      } },
"settle_group_attempts":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"shared_input_ranges":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"shared_source_limits":
{ Args: { "p_action"?: string,"p_family"?: string }; Returns: Json
                           },
"snooze_reinforcement":
{ Args: { "p_child_id": string,"p_question_id": string }; Returns: undefined
                           },
"start_exam_attempt":
{ Args: { "p_exam_id": string }; Returns: {
              "ai_feedback": Json | null,
"child_id": string,
"created_at": string,
"deadline_at": string | null,
"exam_id": string,
"family_id": string,
"finished_at": string | null,
"graded_at": string | null,
"id": string,
"items_partial": number | null,
"items_pending": number | null,
"items_scored": number | null,
"items_total": number | null,
"items_unanswered": number | null,
"mc_correct": number | null,
"mc_total": number | null,
"open_graded": number | null,
"open_pending": number | null,
"open_total": number | null,
"open_unanswered": number | null,
"provisional": boolean | null,
"score_pct": number | null,
"started_at": string,
"status": Database["public"]['Enums']["attempt_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "exam_attempts"
        isOneToOne: true
        isSetofReturn: false
      } },
"store_weekly_summary":
{ Args: { "p_context": string,"p_family": string,"p_job": string,"p_user": string }; Returns: Json
                           },
"submit_exam_answer":
{ Args: { "p_answer_key"?: string,"p_answer_text"?: string,"p_attempt_id": string,"p_question_id": string }; Returns: undefined
                           },
"submit_exam_answer_once":
{ Args: { "p_answer_key"?: string,"p_answer_text"?: string,"p_attempt_id": string,"p_expected_revision": number,"p_question_id": string,"p_request_id": string }; Returns: number
                           },
"submit_exam_answer_v3":
{ Args: { "p_answer_document"?: Json,"p_answer_key"?: string,"p_answer_text"?: string,"p_attempt_id": string,"p_expected_revision": number,"p_question_id": string,"p_request_id": string }; Returns: number
                           },
"submit_exam_answer_v4":
{ Args: { "p_answer"?: Json,"p_answer_document"?: Json,"p_answer_key"?: string,"p_answer_text"?: string,"p_attempt_id": string,"p_expected_revision": number,"p_question_id": string,"p_request_id": string }; Returns: number
                           },
"submit_prova_draft":
{ Args: { "p_id": string,"p_request_id": string,"p_version": number }; Returns: string
                           },
"submit_question_contribution":
{ Args: { "p_no_personal_data": boolean,"p_question_id": string,"p_request_id": string,"p_rights_confirmed": boolean }; Returns: string
                           },
"suggest_subject":
{ Args: { "p_grade"?: number,"p_text": string }; Returns: Json
                           },
"support_canned_replies":
{ Args: { "p_include_archived"?: boolean,"p_locale"?: string,"p_ticket"?: string }; Returns: Json
                           },
"task_routine_history":
{ Args: { "p_before_revision"?: number,"p_id": string }; Returns: Json
                           },
"transfer_education_period_items":
{ Args: { "p_child_id": string,"p_from_period_id": string,"p_items": Json,"p_request_id": string,"p_revision": number,"p_to_period_id": string }; Returns: Json
                           },
"undo_child_education_change":
{ Args: { "p_child_id": string,"p_request_id": string,"p_revision": number }; Returns: Json
                           },
"undo_complete":
{ Args: { "p_completion_id": string }; Returns: undefined
                           },
"unregister_push_token":
{ Args: { "p_token": string }; Returns: undefined
                           },
"unsubscribe_with_token":
{ Args: { "p_token": string }; Returns: Json
                           },
"verify_child_pin":
{ Args: { "p_child_id": string,"p_pin": string }; Returns: boolean
                           },
"verify_parent_pin":
{ Args: { "p_pin": string }; Returns: boolean
                           },
"weekly_review_children":
{ Args: { "p_week": string }; Returns: Json
                           },
"withdraw_question_contribution":
{ Args: { "p_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "attempt_status": "in_progress"|"submitted"|"graded","billing_period": "monthly"|"yearly","child_goal_status": "active"|"reached"|"redeemed"|"cancelled","completion_status": "done"|"approved"|"returned","event_type": "school"|"activity"|"holiday"|"exam"|"family"|"doctor"|"birthday"|"other","exam_status": "draft"|"ready"|"assigned"|"completed","grade_kind": "exam"|"homework"|"project"|"oral"|"performance","member_role": "parent"|"guardian","note_visibility": "private"|"family"|"child"|"teacher","plan_code": "free"|"plus"|"pro","question_difficulty": "kolay"|"orta"|"orta_ustu"|"zor","question_kind": "multiple_choice"|"open_ended"|"structured","reward_request_status": "requested"|"approved"|"declined"|"delivered"|"cancelled","store_platform": "apple"|"google","subscription_status": "active"|"grace"|"on_hold"|"expired"|"revoked","time_of_day": "morning"|"afternoon"|"evening"|"any"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "attempt_status": ["in_progress", "submitted", "graded"],"billing_period": ["monthly", "yearly"],"child_goal_status": ["active", "reached", "redeemed", "cancelled"],"completion_status": ["done", "approved", "returned"],"event_type": ["school", "activity", "holiday", "exam", "family", "doctor", "birthday", "other"],"exam_status": ["draft", "ready", "assigned", "completed"],"grade_kind": ["exam", "homework", "project", "oral", "performance"],"member_role": ["parent", "guardian"],"note_visibility": ["private", "family", "child", "teacher"],"plan_code": ["free", "plus", "pro"],"question_difficulty": ["kolay", "orta", "orta_ustu", "zor"],"question_kind": ["multiple_choice", "open_ended", "structured"],"reward_request_status": ["requested", "approved", "declined", "delivered", "cancelled"],"store_platform": ["apple", "google"],"subscription_status": ["active", "grace", "on_hold", "expired", "revoked"],"time_of_day": ["morning", "afternoon", "evening", "any"]
          }
        }
} as const
