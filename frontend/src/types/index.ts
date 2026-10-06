export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  logs?: string[];
  shap?: Record<string, number>;
  lime?: Record<string, number>;
  fairness?: {
    gender: Record<string, number>;
    age: Record<string, number>;
    demographic_parity_gap_gender: number;
    demographic_parity_gap_age: number;
  };
  profile?: Record<string, number>;
  decision?: string;
  created_at?: string;
}

export interface AuthSnapshot {
  authHydrated: boolean;
  isAuthenticated: boolean;
  userRole: string | null;
  userFullName: string | null;
}

export type ActiveTab = "chat" | "docs" | "analytics";
