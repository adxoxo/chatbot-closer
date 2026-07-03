export type LeadState =
  | "GREETING"
  | "QUALIFYING"
  | "CLOSING"
  | "NURTURING"
  | "PARKING";

export type Priority = "hot" | "warm" | "cold";

export interface Signals {
  business_legitimacy: number;
  buyable_signal: number;
  pain_clarity: number;
  urgency: number;
  decision_authority: number;
}

export interface ChatResponse {
  conversation_id: string;
  reply: string;
  state: LeadState;
  score: number;
  signals: Signals;
  calendly_url: string | null;
  capture_email: boolean;
}

export interface Branding {
  primary_color: string;
  bot_name: string;
  logo_url: string;
  welcome_message: string;
}

export interface PublicTenant {
  id: string;
  name: string;
  is_active: boolean;
  branding: Branding;
}

export interface ScoringWeights {
  weight_bl: number;
  weight_bs: number;
  weight_pc: number;
  weight_u: number;
  weight_da: number;
}

export interface Tenant {
  id: string;
  name: string;
  system_prompt: string;
  knowledge_base: string;
  calendly_url: string;
  scoring_weights: ScoringWeights;
  hot_threshold: number;
  warm_threshold: number;
  branding: Branding;
  notification_email: string;
  n8n_webhook_url: string;
  is_active: boolean;
  created_at?: string;
}

export interface Lead {
  id: string;
  conversation_id: string;
  tenant_id: string;
  tenant_name?: string;
  email: string | null;
  score: number;
  state: LeadState;
  signals: Signals;
  priority: Priority;
  notified: boolean;
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

export const SIGNAL_LABELS: Record<keyof Signals, string> = {
  business_legitimacy: "Business Legitimacy",
  buyable_signal: "Buyable Signal",
  pain_clarity: "Pain Clarity",
  urgency: "Urgency",
  decision_authority: "Decision Authority",
};
