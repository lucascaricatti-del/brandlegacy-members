export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================================
// Aliases de tipos de domínio
// ============================================================
export type ProfileRole = 'student' | 'admin' | 'cx' | 'financial' | 'mentor'
/** Roles que o admin de conteúdo pode definir via UI (intencional: restrito) */
export type AdminManagedRole = 'student' | 'admin'
export type AdminRole = 'admin' | 'mentor' | 'lideranca' | 'cx' | 'financeiro'
export type ContentType = 'course' | 'masterclass' | 'webinar'
export type ModuleCategory = 'mentoria' | 'masterclass' | 'free_class'
export type PlanType = 'free' | 'tracao' | 'club'
export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'collaborator' | 'viewer'
export type KanbanPriority = 'low' | 'medium' | 'high' | 'urgent'
export type CardLabel = { id: string; text: string; color: string }
export type CardAttachment = { id: string; title: string; url: string; created_at: string }
export type ContractStatus = 'active' | 'paused' | 'cancelled' | 'completed' | 'renewing'
export type FinancialStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'
export type DeliveryStatus = 'pending' | 'scheduled' | 'completed'
export type ContactType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'note'
export type SessionStatus = 'pending' | 'analyzing' | 'completed' | 'error'
export type IntegrationPlatform = 'meta_ads' | 'google_ads' | 'ga4' | 'shopify'
export type SessionTaskPriority = 'baixa' | 'media' | 'alta' | 'urgente'
export type TaskPriority = 'baixa' | 'media' | 'alta' | 'urgente'
export type TaskStatus = 'pendente' | 'em_andamento' | 'concluida'
export type FinancialInfoStatus = 'active' | 'inadimplente' | 'cancelled' | 'completed'
export type CrmLeadStatus = 'novo' | 'contatado' | 'qualificado' | 'fechado' | 'perdido'
export type CrmContactType = 'ligacao' | 'email' | 'whatsapp' | 'nota'

// ============================================================
// Database — tipo completo Supabase
// ============================================================
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          email: string
          role: ProfileRole
          admin_role: AdminRole
          avatar_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          email: string
          role?: ProfileRole
          admin_role?: AdminRole
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          role?: ProfileRole
          admin_role?: AdminRole
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          id: string
          title: string
          description: string | null
          thumbnail_url: string | null
          order_index: number
          is_published: boolean
          content_type: ContentType
          category: ModuleCategory
          min_plan: PlanType
          webinar_open_to_all: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          thumbnail_url?: string | null
          order_index?: number
          is_published?: boolean
          content_type?: ContentType
          category?: ModuleCategory
          min_plan?: PlanType
          webinar_open_to_all?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          thumbnail_url?: string | null
          order_index?: number
          is_published?: boolean
          content_type?: ContentType
          category?: ModuleCategory
          min_plan?: PlanType
          webinar_open_to_all?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          id: string
          module_id: string
          title: string
          description: string | null
          video_url: string | null
          video_type: 'youtube' | 'panda' | null
          duration_minutes: number
          order_index: number
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          module_id: string
          title: string
          description?: string | null
          video_url?: string | null
          video_type?: 'youtube' | 'panda' | null
          duration_minutes?: number
          order_index?: number
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          module_id?: string
          title?: string
          description?: string | null
          video_url?: string | null
          video_type?: 'youtube' | 'panda' | null
          duration_minutes?: number
          order_index?: number
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lessons_module_id_fkey'
            columns: ['module_id']
            isOneToOne: false
            referencedRelation: 'modules'
            referencedColumns: ['id']
          }
        ]
      }
      materials: {
        Row: {
          id: string
          lesson_id: string | null
          module_id: string | null
          title: string
          file_url: string
          file_size_kb: number | null
          created_at: string
        }
        Insert: {
          id?: string
          lesson_id?: string | null
          module_id?: string | null
          title: string
          file_url: string
          file_size_kb?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string | null
          module_id?: string | null
          title?: string
          file_url?: string
          file_size_kb?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'materials_lesson_id_fkey'
            columns: ['lesson_id']
            isOneToOne: false
            referencedRelation: 'lessons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'materials_module_id_fkey'
            columns: ['module_id']
            isOneToOne: false
            referencedRelation: 'modules'
            referencedColumns: ['id']
          }
        ]
      }
      lesson_progress: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          completed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lesson_id: string
          completed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lesson_id?: string
          completed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lesson_progress_lesson_id_fkey'
            columns: ['lesson_id']
            isOneToOne: false
            referencedRelation: 'lessons'
            referencedColumns: ['id']
          }
        ]
      }
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          plan_type: PlanType
          logo_url: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          plan_type?: PlanType
          logo_url?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          plan_type?: PlanType
          logo_url?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: WorkspaceRole
          is_active: boolean
          invited_by: string | null
          joined_at: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: WorkspaceRole
          is_active?: boolean
          invited_by?: string | null
          joined_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: WorkspaceRole
          is_active?: boolean
          invited_by?: string | null
          joined_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'workspace_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      content_access: {
        Row: {
          id: string
          workspace_id: string
          module_id: string
          granted_by: string
          granted_at: string
          revoked_at: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          module_id: string
          granted_by: string
          granted_at?: string
          revoked_at?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          module_id?: string
          granted_by?: string
          granted_at?: string
          revoked_at?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'content_access_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_access_module_id_fkey'
            columns: ['module_id']
            isOneToOne: false
            referencedRelation: 'modules'
            referencedColumns: ['id']
          }
        ]
      }
      mentoring_contracts: {
        Row: {
          id: string
          workspace_id: string
          plan_type: 'tracao' | 'club'
          contract_value_brl: number
          installments: number
          start_date: string
          duration_months: number
          renewal_date: string | null
          status: ContractStatus
          total_deliveries_promised: number
          deliveries_completed: number
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          plan_type: 'tracao' | 'club'
          contract_value_brl?: number
          installments?: number
          start_date: string
          duration_months?: number
          renewal_date?: string | null
          status?: ContractStatus
          total_deliveries_promised?: number
          deliveries_completed?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          plan_type?: 'tracao' | 'club'
          contract_value_brl?: number
          installments?: number
          start_date?: string
          duration_months?: number
          renewal_date?: string | null
          status?: ContractStatus
          total_deliveries_promised?: number
          deliveries_completed?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'mentoring_contracts_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      financial_records: {
        Row: {
          id: string
          workspace_id: string
          contract_id: string | null
          type: 'payment' | 'refund' | 'credit' | 'charge'
          amount_brl: number
          description: string | null
          due_date: string | null
          paid_at: string | null
          status: FinancialStatus
          payment_method: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          contract_id?: string | null
          type: 'payment' | 'refund' | 'credit' | 'charge'
          amount_brl: number
          description?: string | null
          due_date?: string | null
          paid_at?: string | null
          status?: FinancialStatus
          payment_method?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          contract_id?: string | null
          type?: 'payment' | 'refund' | 'credit' | 'charge'
          amount_brl?: number
          description?: string | null
          due_date?: string | null
          paid_at?: string | null
          status?: FinancialStatus
          payment_method?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'financial_records_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      deliveries: {
        Row: {
          id: string
          workspace_id: string
          contract_id: string | null
          title: string
          order_index: number
          status: DeliveryStatus
          scheduled_date: string | null
          completed_date: string | null
          notes: string | null
          link_call: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          contract_id?: string | null
          title: string
          order_index?: number
          status?: DeliveryStatus
          scheduled_date?: string | null
          completed_date?: string | null
          notes?: string | null
          link_call?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          contract_id?: string | null
          title?: string
          order_index?: number
          status?: DeliveryStatus
          scheduled_date?: string | null
          completed_date?: string | null
          notes?: string | null
          link_call?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'deliveries_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'deliveries_contract_id_fkey'
            columns: ['contract_id']
            isOneToOne: false
            referencedRelation: 'mentoring_contracts'
            referencedColumns: ['id']
          }
        ]
      }
      delivery_materials: {
        Row: {
          id: string
          delivery_id: string
          title: string
          type: 'video' | 'material'
          url: string | null
          file_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          delivery_id: string
          title: string
          type: 'video' | 'material'
          url?: string | null
          file_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          delivery_id?: string
          title?: string
          type?: 'video' | 'material'
          url?: string | null
          file_url?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'delivery_materials_delivery_id_fkey'
            columns: ['delivery_id']
            isOneToOne: false
            referencedRelation: 'deliveries'
            referencedColumns: ['id']
          }
        ]
      }
      kanban_boards: {
        Row: {
          id: string
          workspace_id: string
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          title?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'kanban_boards_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: true
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      kanban_columns: {
        Row: {
          id: string
          board_id: string
          title: string
          order_index: number
          color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          board_id: string
          title: string
          order_index?: number
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          title?: string
          order_index?: number
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'kanban_columns_board_id_fkey'
            columns: ['board_id']
            isOneToOne: false
            referencedRelation: 'kanban_boards'
            referencedColumns: ['id']
          }
        ]
      }
      kanban_cards: {
        Row: {
          id: string
          column_id: string
          title: string
          description: string | null
          assignee_id: string | null
          due_date: string | null
          priority: KanbanPriority
          order_index: number
          is_archived: boolean
          labels: Json
          attachments: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          column_id: string
          title: string
          description?: string | null
          assignee_id?: string | null
          due_date?: string | null
          priority?: KanbanPriority
          order_index?: number
          is_archived?: boolean
          labels?: Json
          attachments?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          column_id?: string
          title?: string
          description?: string | null
          assignee_id?: string | null
          due_date?: string | null
          priority?: KanbanPriority
          order_index?: number
          is_archived?: boolean
          labels?: Json
          attachments?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'kanban_cards_column_id_fkey'
            columns: ['column_id']
            isOneToOne: false
            referencedRelation: 'kanban_columns'
            referencedColumns: ['id']
          }
        ]
      }
      card_comments: {
        Row: {
          id: string
          card_id: string
          user_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          card_id: string
          user_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          card_id?: string
          user_id?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'card_comments_card_id_fkey'
            columns: ['card_id']
            isOneToOne: false
            referencedRelation: 'kanban_cards'
            referencedColumns: ['id']
          }
        ]
      }
      internal_contacts: {
        Row: {
          id: string
          workspace_id: string
          recorded_by: string
          contact_type: ContactType
          subject: string | null
          content: string
          contact_date: string
          next_action: string | null
          next_action_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          recorded_by: string
          contact_type: ContactType
          subject?: string | null
          content: string
          contact_date?: string
          next_action?: string | null
          next_action_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          recorded_by?: string
          contact_type?: ContactType
          subject?: string | null
          content?: string
          contact_date?: string
          next_action?: string | null
          next_action_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'internal_contacts_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      sessions: {
        Row: {
          id: string
          workspace_id: string
          title: string
          session_date: string | null
          transcript: string | null
          summary: string | null
          decisions: string | null
          risks: string | null
          status: string
          agent_type: string | null
          diagnosis_session_id: string | null
          result_json: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          title: string
          session_date?: string | null
          transcript?: string | null
          summary?: string | null
          decisions?: string | null
          risks?: string | null
          status?: string
          agent_type?: string | null
          diagnosis_session_id?: string | null
          result_json?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          session_date?: string | null
          transcript?: string | null
          summary?: string | null
          decisions?: string | null
          risks?: string | null
          status?: string
          agent_type?: string | null
          diagnosis_session_id?: string | null
          result_json?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sessions_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sessions_diagnosis_session_id_fkey'
            columns: ['diagnosis_session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          }
        ]
      }
      session_tasks: {
        Row: {
          id: string
          session_id: string
          workspace_id: string | null
          title: string
          responsible: string | null
          due_date: string | null
          priority: string
          kanban_card_id: string | null
          task_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          workspace_id?: string | null
          title: string
          responsible?: string | null
          due_date?: string | null
          priority?: string
          kanban_card_id?: string | null
          task_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          workspace_id?: string | null
          title?: string
          responsible?: string | null
          due_date?: string | null
          priority?: string
          kanban_card_id?: string | null
          task_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'session_tasks_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_tasks_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_tasks_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          }
        ]
      }
      agent_logs: {
        Row: {
          id: string
          workspace_id: string | null
          agent_type: string
          summary: string | null
          cards_found: number
          email_sent: boolean
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id?: string | null
          agent_type?: string
          summary?: string | null
          cards_found?: number
          email_sent?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string | null
          agent_type?: string
          summary?: string | null
          cards_found?: number
          email_sent?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'agent_logs_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      agent_configs: {
        Row: {
          id: string
          workspace_id: string
          agent_type: string
          system_prompt: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          agent_type: string
          system_prompt: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          agent_type?: string
          system_prompt?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'agent_configs_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      workspace_context: {
        Row: {
          id: string
          workspace_id: string
          business_type: string | null
          business_description: string | null
          monthly_revenue: string | null
          team_size: string | null
          main_goal: string | null
          main_challenge: string | null
          mentorship_stage: string | null
          extra_context: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          business_type?: string | null
          business_description?: string | null
          monthly_revenue?: string | null
          team_size?: string | null
          main_goal?: string | null
          main_challenge?: string | null
          mentorship_stage?: string | null
          extra_context?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          business_type?: string | null
          business_description?: string | null
          monthly_revenue?: string | null
          team_size?: string | null
          main_goal?: string | null
          main_challenge?: string | null
          mentorship_stage?: string | null
          extra_context?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_context_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: true
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      integrations: {
        Row: {
          id: string
          workspace_id: string
          platform: IntegrationPlatform
          access_token: string
          refresh_token: string | null
          account_id: string | null
          extra_config: Json
          is_active: boolean
          last_sync: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          platform: IntegrationPlatform
          access_token: string
          refresh_token?: string | null
          account_id?: string | null
          extra_config?: Json
          is_active?: boolean
          last_sync?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          platform?: IntegrationPlatform
          access_token?: string
          refresh_token?: string | null
          account_id?: string | null
          extra_config?: Json
          is_active?: boolean
          last_sync?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'integrations_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      integration_metrics: {
        Row: {
          id: string
          workspace_id: string
          platform: IntegrationPlatform
          metric_date: string
          data: Json
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          platform: IntegrationPlatform
          metric_date: string
          data: Json
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          platform?: IntegrationPlatform
          metric_date?: string
          data?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'integration_metrics_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      financial_info: {
        Row: {
          id: string
          workspace_id: string
          plan_name: string | null
          status: FinancialInfoStatus
          total_value: number | null
          installments: number | null
          entry_value: number | null
          installment_value: number | null
          first_payment_date: string | null
          start_date: string | null
          renewal_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          plan_name?: string | null
          status?: FinancialInfoStatus
          total_value?: number | null
          installments?: number | null
          entry_value?: number | null
          installment_value?: number | null
          first_payment_date?: string | null
          start_date?: string | null
          renewal_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          plan_name?: string | null
          status?: FinancialInfoStatus
          total_value?: number | null
          installments?: number | null
          entry_value?: number | null
          installment_value?: number | null
          first_payment_date?: string | null
          start_date?: string | null
          renewal_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'financial_info_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: true
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          workspace_id: string
          session_id: string | null
          title: string
          description: string | null
          responsible: string | null
          assignee_id: string | null
          due_date: string | null
          priority: TaskPriority
          status: TaskStatus
          is_archived: boolean
          completed_at: string | null
          created_by: string | null
          start_date: string | null
          tags: string[] | null
          order_index: number
          file_url: string | null
          file_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          session_id?: string | null
          title: string
          description?: string | null
          responsible?: string | null
          assignee_id?: string | null
          due_date?: string | null
          priority?: TaskPriority
          status?: TaskStatus
          is_archived?: boolean
          completed_at?: string | null
          created_by?: string | null
          start_date?: string | null
          tags?: string[] | null
          order_index?: number
          file_url?: string | null
          file_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          session_id?: string | null
          title?: string
          description?: string | null
          responsible?: string | null
          assignee_id?: string | null
          due_date?: string | null
          priority?: TaskPriority
          status?: TaskStatus
          is_archived?: boolean
          completed_at?: string | null
          created_by?: string | null
          start_date?: string | null
          tags?: string[] | null
          order_index?: number
          file_url?: string | null
          file_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_assignee_id_fkey'
            columns: ['assignee_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      task_checklist_items: {
        Row: {
          id: string
          task_id: string
          title: string
          is_done: boolean
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          title: string
          is_done?: boolean
          order_index?: number
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          title?: string
          is_done?: boolean
          order_index?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_checklist_items_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          }
        ]
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          body?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_comments_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_comments_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      leads: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          module_id: string | null
          utm_source: string | null
          utm_campaign: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone?: string | null
          module_id?: string | null
          utm_source?: string | null
          utm_campaign?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string | null
          module_id?: string | null
          utm_source?: string | null
          utm_campaign?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'leads_module_id_fkey'
            columns: ['module_id']
            isOneToOne: false
            referencedRelation: 'modules'
            referencedColumns: ['id']
          }
        ]
      }
      funnels: {
        Row: {
          id: string
          name: string
          slug: string
          product: string
          description: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          product: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          product?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          id: string
          funnel_id: string | null
          name: string
          email: string
          whatsapp: string | null
          revenue_range: string | null
          business_segment: string | null
          status: string
          assigned_to: string | null
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          funnel_id?: string | null
          name: string
          email: string
          whatsapp?: string | null
          revenue_range?: string | null
          business_segment?: string | null
          status?: string
          assigned_to?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          funnel_id?: string | null
          name?: string
          email?: string
          whatsapp?: string | null
          revenue_range?: string | null
          business_segment?: string | null
          status?: string
          assigned_to?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'crm_leads_funnel_id_fkey'
            columns: ['funnel_id']
            isOneToOne: false
            referencedRelation: 'funnels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'crm_leads_assigned_to_fkey'
            columns: ['assigned_to']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      media_plans: {
        Row: {
          id: string
          workspace_id: string
          year: number
          name: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          year: number
          name?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          year?: number
          name?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'media_plans_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_plans_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      media_plan_metrics: {
        Row: {
          id: string
          media_plan_id: string
          metric_key: string
          month: number
          value_numeric: number | null
          delta_pct: number | null
          input_mode: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          media_plan_id: string
          metric_key: string
          month: number
          value_numeric?: number | null
          delta_pct?: number | null
          input_mode?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          media_plan_id?: string
          metric_key?: string
          month?: number
          value_numeric?: number | null
          delta_pct?: number | null
          input_mode?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'media_plan_metrics_media_plan_id_fkey'
            columns: ['media_plan_id']
            isOneToOne: false
            referencedRelation: 'media_plans'
            referencedColumns: ['id']
          }
        ]
      }
      crm_notes: {
        Row: {
          id: string
          lead_id: string
          author_id: string | null
          content: string
          contact_type: string
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          author_id?: string | null
          content: string
          contact_type?: string
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          author_id?: string | null
          content?: string
          contact_type?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'crm_notes_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'crm_leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'crm_notes_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_internal_team: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      has_role: {
        Args: { check_role: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { ws_id: string }
        Returns: boolean
      }
      workspace_role_gte: {
        Args: { ws_id: string; min_role: string }
        Returns: boolean
      }
      user_can_access_module: {
        Args: { mod_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ============================================================
// Tipos convenientes (Row de cada tabela)
// ============================================================
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Module = Database['public']['Tables']['modules']['Row']
export type Lesson = Database['public']['Tables']['lessons']['Row']
export type Material = Database['public']['Tables']['materials']['Row']
export type LessonProgress = Database['public']['Tables']['lesson_progress']['Row']
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row']
export type ContentAccess = Database['public']['Tables']['content_access']['Row']
export type MentoringContract = Database['public']['Tables']['mentoring_contracts']['Row']
export type FinancialRecord = Database['public']['Tables']['financial_records']['Row']
export type KanbanBoard = Database['public']['Tables']['kanban_boards']['Row']
export type KanbanColumn = Database['public']['Tables']['kanban_columns']['Row']
export type KanbanCard = Database['public']['Tables']['kanban_cards']['Row']
export type CardComment = Database['public']['Tables']['card_comments']['Row']
export type InternalContact = Database['public']['Tables']['internal_contacts']['Row']
export type Delivery = Database['public']['Tables']['deliveries']['Row']
export type DeliveryMaterial = Database['public']['Tables']['delivery_materials']['Row']
export type Session = Database['public']['Tables']['sessions']['Row']
export type SessionTask = Database['public']['Tables']['session_tasks']['Row']
export type AgentLog = Database['public']['Tables']['agent_logs']['Row']
export type AgentConfig = Database['public']['Tables']['agent_configs']['Row']
export type WorkspaceContext = Database['public']['Tables']['workspace_context']['Row']
export type Integration = Database['public']['Tables']['integrations']['Row']
export type IntegrationMetric = Database['public']['Tables']['integration_metrics']['Row']
export type FinancialInfo = Database['public']['Tables']['financial_info']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type Lead = Database['public']['Tables']['leads']['Row']
export type Funnel = Database['public']['Tables']['funnels']['Row']
export type CrmLead = Database['public']['Tables']['crm_leads']['Row']
export type CrmNote = Database['public']['Tables']['crm_notes']['Row']
export type TaskChecklistItem = Database['public']['Tables']['task_checklist_items']['Row']
export type TaskComment = Database['public']['Tables']['task_comments']['Row']
export type MediaPlan = Database['public']['Tables']['media_plans']['Row']
export type MediaPlanMetric = Database['public']['Tables']['media_plan_metrics']['Row']

// ============================================================
// Tipos compostos para uso em componentes
// ============================================================
export type LessonWithProgress = Lesson & {
  completed: boolean
  materials: Material[]
}

export type ModuleWithLessons = Module & {
  lessons: LessonWithProgress[]
  total_lessons: number
  completed_lessons: number
}

export type WorkspaceWithDetails = Workspace & {
  workspace_members: (WorkspaceMember & { profiles: Pick<Profile, 'id' | 'name' | 'email' | 'avatar_url'> })[]
  mentoring_contracts: MentoringContract[]
  userRole?: WorkspaceRole
}

export type KanbanCardWithDetails = KanbanCard & {
  assignee: Pick<Profile, 'id' | 'name' | 'avatar_url'> | null
  card_comments: (CardComment & { profiles: Pick<Profile, 'id' | 'name' | 'avatar_url'> })[]
}

export type KanbanColumnWithCards = KanbanColumn & {
  kanban_cards: KanbanCardWithDetails[]
}

export type KanbanBoardFull = KanbanBoard & {
  kanban_columns: KanbanColumnWithCards[]
}

export type WorkspaceSummary = Workspace & {
  member_count: number
  active_contract: MentoringContract | null
  last_contact_date: string | null
}
