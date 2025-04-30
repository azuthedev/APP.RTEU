export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          user_role: string | null
          password_hash: string
          created_at: string | null
          is_suspended: boolean | null
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone?: string | null
          user_role?: string | null
          password_hash: string
          created_at?: string | null
          is_suspended?: boolean | null
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string | null
          user_role?: string | null
          password_hash?: string
          created_at?: string | null
          is_suspended?: boolean | null
        }
      }
      email_verifications: {
        Row: {
          id: string
          user_id: string | null
          token: string
          created_at: string | null
          expires_at: string
          verified: boolean | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          token: string
          created_at?: string | null
          expires_at: string
          verified?: boolean | null
        }
        Update: {
          id?: string
          user_id?: string | null
          token?: string
          created_at?: string | null
          expires_at?: string
          verified?: boolean | null
        }
      }
    }
    Enums: {
      user_role: "admin" | "customer" | "partner" | "support"
      booking_status: "booked" | "completed" | "cancelled"
      payment_status: "pending" | "completed" | "failed"
      payment_method: "credit_card" | "paypal" | "cash"
      ticket_status: "open" | "closed" | "in_progress"
      trip_status: "pending" | "accepted" | "in_progress" | "completed" | "cancelled"
      document_type: "license" | "insurance" | "registration" | "other"
      discount_type: "percent" | "fixed"
    }
  }
}