
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admins": {
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
                },"children": {
                  Row: {
                    "avatar": string,"birth_date": string | null,"created_at": string,"family_id": string,"grade": number | null,"id": string,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar"?: string,"birth_date"?: string | null,"created_at"?: string,"family_id": string,"grade"?: number | null,"id"?: string,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "avatar"?: string,"birth_date"?: string | null,"created_at"?: string,"family_id"?: string,"grade"?: number | null,"id"?: string,"name"?: string,"sort_order"?: number
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
                    "active_child_id": string | null,"auth_user_id": string,"family_id": string,"id": string,"last_seen_at": string | null,"name": string,"paired_at": string,"revoked_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active_child_id"?: string | null,"auth_user_id": string,"family_id": string,"id"?: string,"last_seen_at"?: string | null,"name"?: string,"paired_at"?: string,"revoked_at"?: string | null
                  }
                  Update: {
                    "active_child_id"?: string | null,"auth_user_id"?: string,"family_id"?: string,"id"?: string,"last_seen_at"?: string | null,"name"?: string,"paired_at"?: string,"revoked_at"?: string | null
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
                    "all_day": boolean,"child_id": string | null,"created_at": string,"created_by": string | null,"ends_at": string | null,"family_id": string,"id": string,"location": string | null,"notes": string | null,"rrule": string | null,"starts_at": string,"title": string,"type": Database["public"]['Enums']["event_type"],"updated_at": string,"visible_to_child": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "all_day"?: boolean,"child_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"family_id": string,"id"?: string,"location"?: string | null,"notes"?: string | null,"rrule"?: string | null,"starts_at": string,"title": string,"type"?: Database["public"]['Enums']["event_type"],"updated_at"?: string,"visible_to_child"?: boolean
                  }
                  Update: {
                    "all_day"?: boolean,"child_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"family_id"?: string,"id"?: string,"location"?: string | null,"notes"?: string | null,"rrule"?: string | null,"starts_at"?: string,"title"?: string,"type"?: Database["public"]['Enums']["event_type"],"updated_at"?: string,"visible_to_child"?: boolean
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
                },"grades": {
                  Row: {
                    "child_id": string,"created_at": string,"family_id": string,"graded_on": string,"id": string,"kind": Database["public"]['Enums']["grade_kind"],"max_score": number,"note": string | null,"score": number,"subject": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"created_at"?: string,"family_id": string,"graded_on"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["grade_kind"],"max_score"?: number,"note"?: string | null,"score": number,"subject": string
                  }
                  Update: {
                    "child_id"?: string,"created_at"?: string,"family_id"?: string,"graded_on"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["grade_kind"],"max_score"?: number,"note"?: string | null,"score"?: number,"subject"?: string
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
                },"notes": {
                  Row: {
                    "author_child_id": string | null,"author_user_id": string | null,"body": string,"child_id": string | null,"created_at": string,"family_id": string,"id": string,"subject": string | null,"title": string | null,"updated_at": string,"visibility": Database["public"]['Enums']["note_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "author_child_id"?: string | null,"author_user_id"?: string | null,"body"?: string,"child_id"?: string | null,"created_at"?: string,"family_id": string,"id"?: string,"subject"?: string | null,"title"?: string | null,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["note_visibility"]
                  }
                  Update: {
                    "author_child_id"?: string | null,"author_user_id"?: string | null,"body"?: string,"child_id"?: string | null,"created_at"?: string,"family_id"?: string,"id"?: string,"subject"?: string | null,"title"?: string | null,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["note_visibility"]
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
                },"parent_pins": {
                  Row: {
                    "family_id": string,"pin_hash": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "family_id": string,"pin_hash": string,"updated_at"?: string
                  }
                  Update: {
                    "family_id"?: string,"pin_hash"?: string,"updated_at"?: string
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
                    "active": boolean,"period": Database["public"]['Enums']["billing_period"],"plan": Database["public"]['Enums']["plan_code"],"platform": Database["public"]['Enums']["store_platform"] | null,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"period": Database["public"]['Enums']["billing_period"],"plan": Database["public"]['Enums']["plan_code"],"platform"?: Database["public"]['Enums']["store_platform"] | null,"product_id": string
                  }
                  Update: {
                    "active"?: boolean,"period"?: Database["public"]['Enums']["billing_period"],"plan"?: Database["public"]['Enums']["plan_code"],"platform"?: Database["public"]['Enums']["store_platform"] | null,"product_id"?: string
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
                    "ai_model": string | null,"ai_weekly": boolean,"code": Database["public"]['Enums']["plan_code"],"history_days": number | null,"max_active_tasks_per_child": number | null,"max_children": number,"max_devices": number | null,"max_notes": number | null,"name_i18n": NonNullable<Json>,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_model"?: string | null,"ai_weekly"?: boolean,"code": Database["public"]['Enums']["plan_code"],"history_days"?: number | null,"max_active_tasks_per_child"?: number | null,"max_children": number,"max_devices"?: number | null,"max_notes"?: number | null,"name_i18n": NonNullable<Json>,"sort_order"?: number
                  }
                  Update: {
                    "ai_model"?: string | null,"ai_weekly"?: boolean,"code"?: Database["public"]['Enums']["plan_code"],"history_days"?: number | null,"max_active_tasks_per_child"?: number | null,"max_children"?: number,"max_devices"?: number | null,"max_notes"?: number | null,"name_i18n"?: NonNullable<Json>,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"star_events": {
                  Row: {
                    "child_id": string,"completion_id": string | null,"created_at": string,"created_by": string | null,"delta": number,"family_id": string,"id": number,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"completion_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"delta": number,"family_id": string,"id"?: never,"reason": string
                  }
                  Update: {
                    "child_id"?: string,"completion_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"delta"?: number,"family_id"?: string,"id"?: never,"reason"?: string
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
    }
                  ]
                },"store_notifications": {
                  Row: {
                    "error": string | null,"event_key": string,"event_type": string | null,"id": string,"payload": NonNullable<Json>,"platform": Database["public"]['Enums']["store_platform"],"processed_at": string | null,"received_at": string,"store_key": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"event_key": string,"event_type"?: string | null,"id"?: string,"payload": NonNullable<Json>,"platform": Database["public"]['Enums']["store_platform"],"processed_at"?: string | null,"received_at"?: string,"store_key"?: string | null
                  }
                  Update: {
                    "error"?: string | null,"event_key"?: string,"event_type"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"platform"?: Database["public"]['Enums']["store_platform"],"processed_at"?: string | null,"received_at"?: string,"store_key"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"store_subscriptions": {
                  Row: {
                    "auto_renewing": boolean,"created_at": string,"expires_at": string,"family_id": string,"id": string,"plan": Database["public"]['Enums']["plan_code"],"platform": Database["public"]['Enums']["store_platform"],"product_id": string,"purchaser_user_id": string | null,"raw": Json | null,"status": Database["public"]['Enums']["subscription_status"],"store_key": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_renewing"?: boolean,"created_at"?: string,"expires_at": string,"family_id": string,"id"?: string,"plan": Database["public"]['Enums']["plan_code"],"platform": Database["public"]['Enums']["store_platform"],"product_id": string,"purchaser_user_id"?: string | null,"raw"?: Json | null,"status"?: Database["public"]['Enums']["subscription_status"],"store_key": string,"updated_at"?: string
                  }
                  Update: {
                    "auto_renewing"?: boolean,"created_at"?: string,"expires_at"?: string,"family_id"?: string,"id"?: string,"plan"?: Database["public"]['Enums']["plan_code"],"platform"?: Database["public"]['Enums']["store_platform"],"product_id"?: string,"purchaser_user_id"?: string | null,"raw"?: Json | null,"status"?: Database["public"]['Enums']["subscription_status"],"store_key"?: string,"updated_at"?: string
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
                },"task_completions": {
                  Row: {
                    "child_id": string,"client_id": string,"completed_at": string,"completed_by": string | null,"due_date": string,"family_id": string,"id": string,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["completion_status"],"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"client_id": string,"completed_at"?: string,"completed_by"?: string | null,"due_date": string,"family_id": string,"id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["completion_status"],"template_id": string
                  }
                  Update: {
                    "child_id"?: string,"client_id"?: string,"completed_at"?: string,"completed_by"?: string | null,"due_date"?: string,"family_id"?: string,"id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["completion_status"],"template_id"?: string
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
                },"task_templates": {
                  Row: {
                    "active": boolean,"child_id": string,"created_at": string,"days_of_week": (number)[],"ends_on": string | null,"family_id": string,"icon": string,"id": string,"requires_approval": boolean,"sort_order": number,"stars": number,"starts_on": string,"time_of_day": Database["public"]['Enums']["time_of_day"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"child_id": string,"created_at"?: string,"days_of_week"?: (number)[],"ends_on"?: string | null,"family_id": string,"icon"?: string,"id"?: string,"requires_approval"?: boolean,"sort_order"?: number,"stars"?: number,"starts_on"?: string,"time_of_day"?: Database["public"]['Enums']["time_of_day"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"child_id"?: string,"created_at"?: string,"days_of_week"?: (number)[],"ends_on"?: string | null,"family_id"?: string,"icon"?: string,"id"?: string,"requires_approval"?: boolean,"sort_order"?: number,"stars"?: number,"starts_on"?: string,"time_of_day"?: Database["public"]['Enums']["time_of_day"],"title"?: string,"updated_at"?: string
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
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "child_logout":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"child_pin_login":
{ Args: { "p_child_id": string,"p_pin": string }; Returns: boolean
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
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": Database["public"]['Enums']["completion_status"],
"template_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "task_completions"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_family":
{ Args: { "p_display_name"?: string,"p_name": string }; Returns: string
                           },
"custom_access_token_hook":
{ Args: { "event": Json }; Returns: Json
                           },
"get_family_entitlement":
{ Args: { "p_family_id"?: string }; Returns: {
              "expires_at": string,"plan": Database["public"]['Enums']["plan_code"],"source": string
            }[]
                           },
"get_weekly_summary_data":
{ Args: { "p_family_id": string,"p_week_start": string }; Returns: Json
                           },
"join_family":
{ Args: { "p_display_name"?: string,"p_invite_code": string }; Returns: string
                           },
"pair_device":
{ Args: { "p_code": string }; Returns: string
                           },
"parent_pin_set":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"request_pairing":
{ Args: { "p_device_name"?: string }; Returns: string
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
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": Database["public"]['Enums']["completion_status"],
"template_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "task_completions"
        isOneToOne: true
        isSetofReturn: false
      } },
"revoke_device":
{ Args: { "p_device_id": string }; Returns: undefined
                           },
"set_child_pin":
{ Args: { "p_child_id": string,"p_pin": string }; Returns: undefined
                           },
"set_parent_pin":
{ Args: { "p_pin": string }; Returns: undefined
                           },
"undo_complete":
{ Args: { "p_completion_id": string }; Returns: undefined
                           },
"verify_child_pin":
{ Args: { "p_child_id": string,"p_pin": string }; Returns: boolean
                           },
"verify_parent_pin":
{ Args: { "p_pin": string }; Returns: boolean
                           }
          }
          Enums: {
            "billing_period": "monthly"|"yearly","completion_status": "done"|"approved"|"returned","event_type": "school"|"activity"|"holiday"|"exam"|"family"|"doctor"|"birthday"|"other","grade_kind": "exam"|"homework"|"project"|"oral"|"performance","member_role": "parent"|"guardian","note_visibility": "private"|"family"|"child"|"teacher","plan_code": "free"|"plus"|"pro","store_platform": "apple"|"google","subscription_status": "active"|"grace"|"on_hold"|"expired"|"revoked","time_of_day": "morning"|"afternoon"|"evening"|"any"
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
            "billing_period": ["monthly", "yearly"],"completion_status": ["done", "approved", "returned"],"event_type": ["school", "activity", "holiday", "exam", "family", "doctor", "birthday", "other"],"grade_kind": ["exam", "homework", "project", "oral", "performance"],"member_role": ["parent", "guardian"],"note_visibility": ["private", "family", "child", "teacher"],"plan_code": ["free", "plus", "pro"],"store_platform": ["apple", "google"],"subscription_status": ["active", "grace", "on_hold", "expired", "revoked"],"time_of_day": ["morning", "afternoon", "evening", "any"]
          }
        }
} as const
