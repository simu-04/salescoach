// ─── Core Domain Types ────────────────────────────────────────────────────────

export type CallStatus = 'processing' | 'complete' | 'failed'
export type Verdict    = 'won' | 'at_risk' | 'lost'
export type UserRole   = 'admin' | 'rep' | 'pending'

export interface TalkRatio {
  rep: number       // 0–100
  prospect: number  // 0–100
}

// ─── Auth / Org Types ─────────────────────────────────────────────────────────

export interface Organization {
  id:         string
  name:       string
  slug:       string
  created_at: string
}

export interface Profile {
  id:         string
  org_id:     string | null
  role:       UserRole
  full_name:  string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface ProfileWithOrg extends Profile {
  organizations: Organization | null
}

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface CallRow {
  id:               string
  created_at:       string
  updated_at:       string
  file_name:        string
  file_url:         string | null
  storage_path:     string | null
  file_size:        number | null
  duration_seconds: number | null
  status:           CallStatus
  error_message:    string | null
  // Denormalized from insights for fast dashboard rendering
  verdict:          Verdict | null
  verdict_reason:   string | null
  summary:          string | null
  // Auth / org ownership
  user_id:          string | null
  org_id:           string | null
  rep_name:         string | null
}

export interface InsightRow {
  id:                   string
  call_id:              string
  created_at:           string
  transcript:           string | null
  summary:              string
  verdict:              Verdict
  verdict_reason:       string
  objections:           string[]
  risk_signals:         string[]
  competitor_mentions:  string[]
  talk_ratio:           TalkRatio
  top_recommendation:   string
}

// ─── Enriched Types (for UI) ──────────────────────────────────────────────────

export interface CallWithInsights extends CallRow {
  insights?: InsightRow
}

// ─── API Request / Response Types ────────────────────────────────────────────

export interface ProcessCallRequest {
  storage_path: string
  file_name:    string
  file_size:    number
}

export interface ProcessCallResponse {
  success:  boolean
  call_id?: string
  error?:   string
}

export interface ApiError {
  error:    string
  details?: string
}

// ─── Insight Engine (Claude output schema) ────────────────────────────────────

export type NextStepClarity  = 'clear' | 'vague' | 'none'
export type EngagementArc    = 'rising' | 'flat' | 'declining' | 'mixed'

export interface CoachingPoints {
  did_well:        string
  fix_immediately: string
}

export interface InsightEngineOutput {
  summary:              string
  verdict:              Verdict
  verdict_reason:       string
  objections:           string[]
  risk_signals:         string[]
  buying_signals:       string[]          // v2 — positive moments
  competitor_mentions:  string[]
  talk_ratio:           TalkRatio
  top_recommendation:   string
  coaching:             CoachingPoints | null   // v2 — rep-specific coaching
  next_step_clarity:    NextStepClarity         // v2
  engagement_arc:       EngagementArc           // v2
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_calls:        number
  complete_calls:     number
  win_rate:           number  // 0–100
  at_risk_count:      number
  lost_count:         number
  avg_rep_talk_ratio: number  // 0–100
}
