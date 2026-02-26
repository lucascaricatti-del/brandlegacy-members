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
export type ContentType = 'course' | 'masterclass' | 'webinar'
export type PlanType = 'free' | 'tracao' | 'club'
export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'collaborator' | 'viewer'
export type KanbanPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ContractStatus = 'active' | 'paused' | 'cancelled' | 'completed' | 'renewing'
export type FinancialStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'
export type ContactType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'note'

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
