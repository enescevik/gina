
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
                    "character_key": string,"child_id": string,"family_id": string,"theme_key": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "character_key"?: string,"child_id": string,"family_id": string,"theme_key"?: string,"updated_at"?: string
                  }
                  Update: {
                    "character_key"?: string,"child_id"?: string,"family_id"?: string,"theme_key"?: string,"updated_at"?: string
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
                },"exam_answers": {
                  Row: {
                    "ai_feedback": string | null,"ai_score": number | null,"answer_key": string | null,"answer_text": string | null,"answered_at": string,"attempt_id": string,"is_correct": boolean | null,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_feedback"?: string | null,"ai_score"?: number | null,"answer_key"?: string | null,"answer_text"?: string | null,"answered_at"?: string,"attempt_id": string,"is_correct"?: boolean | null,"question_id": string
                  }
                  Update: {
                    "ai_feedback"?: string | null,"ai_score"?: number | null,"answer_key"?: string | null,"answer_text"?: string | null,"answered_at"?: string,"attempt_id"?: string,"is_correct"?: boolean | null,"question_id"?: string
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
      referencedRelation: "question_bank"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_attempts": {
                  Row: {
                    "ai_feedback": Json | null,"child_id": string,"created_at": string,"deadline_at": string | null,"exam_id": string,"family_id": string,"finished_at": string | null,"id": string,"mc_correct": number | null,"mc_total": number | null,"started_at": string,"status": Database["public"]['Enums']["attempt_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_feedback"?: Json | null,"child_id": string,"created_at"?: string,"deadline_at"?: string | null,"exam_id": string,"family_id": string,"finished_at"?: string | null,"id"?: string,"mc_correct"?: number | null,"mc_total"?: number | null,"started_at"?: string,"status"?: Database["public"]['Enums']["attempt_status"]
                  }
                  Update: {
                    "ai_feedback"?: Json | null,"child_id"?: string,"created_at"?: string,"deadline_at"?: string | null,"exam_id"?: string,"family_id"?: string,"finished_at"?: string | null,"id"?: string,"mc_correct"?: number | null,"mc_total"?: number | null,"started_at"?: string,"status"?: Database["public"]['Enums']["attempt_status"]
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
                    "created_at": string,"created_by": string | null,"family_id": string,"grade": number,"id": string,"name": string,"rows": NonNullable<Json>,"source_url": string | null,"subject": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"family_id": string,"grade": number,"id"?: string,"name": string,"rows"?: NonNullable<Json>,"source_url"?: string | null,"subject": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"family_id"?: string,"grade"?: number,"id"?: string,"name"?: string,"rows"?: NonNullable<Json>,"source_url"?: string | null,"subject"?: string
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
                    "blueprint_id": string | null,"child_id": string,"created_at": string,"created_by": string | null,"duration_minutes": number | null,"family_id": string,"grade": number,"id": string,"kind": string,"question_ids": (string)[],"status": Database["public"]['Enums']["exam_status"],"subject": string,"timed": boolean,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blueprint_id"?: string | null,"child_id": string,"created_at"?: string,"created_by"?: string | null,"duration_minutes"?: number | null,"family_id": string,"grade": number,"id"?: string,"kind"?: string,"question_ids"?: (string)[],"status"?: Database["public"]['Enums']["exam_status"],"subject": string,"timed"?: boolean,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "blueprint_id"?: string | null,"child_id"?: string,"created_at"?: string,"created_by"?: string | null,"duration_minutes"?: number | null,"family_id"?: string,"grade"?: number,"id"?: string,"kind"?: string,"question_ids"?: (string)[],"status"?: Database["public"]['Enums']["exam_status"],"subject"?: string,"timed"?: boolean,"title"?: string,"updated_at"?: string
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
                    "active": boolean,"cost_stars": number,"created_at": string,"created_by": string | null,"family_id": string,"icon": string,"id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"cost_stars": number,"created_at"?: string,"created_by"?: string | null,"family_id": string,"icon"?: string,"id"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"cost_stars"?: number,"created_at"?: string,"created_by"?: string | null,"family_id"?: string,"icon"?: string,"id"?: string,"title"?: string,"updated_at"?: string
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
                },"question_bank": {
                  Row: {
                    "choices": Json | null,"correct_key": string | null,"created_at": string,"created_by": string | null,"difficulty": Database["public"]['Enums']["question_difficulty"],"expected_answer": string | null,"explanation": string | null,"family_id": string | null,"grade": number,"id": string,"kind": Database["public"]['Enums']["question_kind"],"provenance": NonNullable<Json>,"scenario_code": string | null,"solution": string | null,"source_urls": (string)[],"stem": string,"subject": string,"times_asked": number,"topic": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "choices"?: Json | null,"correct_key"?: string | null,"created_at"?: string,"created_by"?: string | null,"difficulty"?: Database["public"]['Enums']["question_difficulty"],"expected_answer"?: string | null,"explanation"?: string | null,"family_id"?: string | null,"grade": number,"id"?: string,"kind": Database["public"]['Enums']["question_kind"],"provenance"?: NonNullable<Json>,"scenario_code"?: string | null,"solution"?: string | null,"source_urls"?: (string)[],"stem": string,"subject": string,"times_asked"?: number,"topic": string,"updated_at"?: string
                  }
                  Update: {
                    "choices"?: Json | null,"correct_key"?: string | null,"created_at"?: string,"created_by"?: string | null,"difficulty"?: Database["public"]['Enums']["question_difficulty"],"expected_answer"?: string | null,"explanation"?: string | null,"family_id"?: string | null,"grade"?: number,"id"?: string,"kind"?: Database["public"]['Enums']["question_kind"],"provenance"?: NonNullable<Json>,"scenario_code"?: string | null,"solution"?: string | null,"source_urls"?: (string)[],"stem"?: string,"subject"?: string,"times_asked"?: number,"topic"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_bank_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"reward_requests": {
                  Row: {
                    "child_id": string,"cost_snapshot": number,"decided_at": string | null,"decided_by": string | null,"delivered_at": string | null,"family_id": string,"goal_id": string | null,"id": string,"idempotency_key": string,"requested_at": string,"reward_id": string,"status": Database["public"]['Enums']["reward_request_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"cost_snapshot": number,"decided_at"?: string | null,"decided_by"?: string | null,"delivered_at"?: string | null,"family_id": string,"goal_id"?: string | null,"id"?: string,"idempotency_key": string,"requested_at"?: string,"reward_id": string,"status"?: Database["public"]['Enums']["reward_request_status"]
                  }
                  Update: {
                    "child_id"?: string,"cost_snapshot"?: number,"decided_at"?: string | null,"decided_by"?: string | null,"delivered_at"?: string | null,"family_id"?: string,"goal_id"?: string | null,"id"?: string,"idempotency_key"?: string,"requested_at"?: string,"reward_id"?: string,"status"?: Database["public"]['Enums']["reward_request_status"]
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
"status": Database["public"]['Enums']["reward_request_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "reward_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
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
"status": Database["public"]['Enums']["reward_request_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "reward_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
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
"status": Database["public"]['Enums']["reward_request_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "reward_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"finish_exam_attempt":
{ Args: { "p_attempt_id": string }; Returns: {
              "ai_feedback": Json | null,
"child_id": string,
"created_at": string,
"deadline_at": string | null,
"exam_id": string,
"family_id": string,
"finished_at": string | null,
"id": string,
"mc_correct": number | null,
"mc_total": number | null,
"started_at": string,
"status": Database["public"]['Enums']["attempt_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "exam_attempts"
        isOneToOne: true
        isSetofReturn: false
      } },
"get_attempt_questions":
{ Args: { "p_exam_id": string }; Returns: {
              "choices": Json,"difficulty": Database["public"]['Enums']["question_difficulty"],"id": string,"kind": Database["public"]['Enums']["question_kind"],"ord": number,"stem": string
            }[]
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
"status": Database["public"]['Enums']["reward_request_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "reward_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
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
"set_parent_pin":
{ Args: { "p_pin": string }; Returns: undefined
                           },
"set_room_preference":
{ Args: { "p_acting_child_id"?: string,"p_character": string,"p_theme"?: string }; Returns: undefined
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
"id": string,
"mc_correct": number | null,
"mc_total": number | null,
"started_at": string,
"status": Database["public"]['Enums']["attempt_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "exam_attempts"
        isOneToOne: true
        isSetofReturn: false
      } },
"submit_exam_answer":
{ Args: { "p_answer_key"?: string,"p_answer_text"?: string,"p_attempt_id": string,"p_question_id": string }; Returns: undefined
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
            "attempt_status": "in_progress"|"submitted"|"graded","billing_period": "monthly"|"yearly","child_goal_status": "active"|"reached"|"redeemed"|"cancelled","completion_status": "done"|"approved"|"returned","event_type": "school"|"activity"|"holiday"|"exam"|"family"|"doctor"|"birthday"|"other","exam_status": "draft"|"ready"|"assigned"|"completed","grade_kind": "exam"|"homework"|"project"|"oral"|"performance","member_role": "parent"|"guardian","note_visibility": "private"|"family"|"child"|"teacher","plan_code": "free"|"plus"|"pro","question_difficulty": "kolay"|"orta"|"orta_ustu"|"zor","question_kind": "multiple_choice"|"open_ended","reward_request_status": "requested"|"approved"|"declined"|"delivered"|"cancelled","store_platform": "apple"|"google","subscription_status": "active"|"grace"|"on_hold"|"expired"|"revoked","time_of_day": "morning"|"afternoon"|"evening"|"any"
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
            "attempt_status": ["in_progress", "submitted", "graded"],"billing_period": ["monthly", "yearly"],"child_goal_status": ["active", "reached", "redeemed", "cancelled"],"completion_status": ["done", "approved", "returned"],"event_type": ["school", "activity", "holiday", "exam", "family", "doctor", "birthday", "other"],"exam_status": ["draft", "ready", "assigned", "completed"],"grade_kind": ["exam", "homework", "project", "oral", "performance"],"member_role": ["parent", "guardian"],"note_visibility": ["private", "family", "child", "teacher"],"plan_code": ["free", "plus", "pro"],"question_difficulty": ["kolay", "orta", "orta_ustu", "zor"],"question_kind": ["multiple_choice", "open_ended"],"reward_request_status": ["requested", "approved", "declined", "delivered", "cancelled"],"store_platform": ["apple", "google"],"subscription_status": ["active", "grace", "on_hold", "expired", "revoked"],"time_of_day": ["morning", "afternoon", "evening", "any"]
          }
        }
} as const
