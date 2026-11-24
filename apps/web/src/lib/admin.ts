/** Admin API shapes (apps/api/app/services/admin.py) and small fetch helpers. */

export type QuestionRow = {
  id: string; external_id: string; category: string; difficulty: string; status: string; origin: "human" | "ai";
  version: number; updated_at: string; instructions: string; open_reports: number;
};
export type QuestionDetail = QuestionRow & {
  content: Record<string, unknown>; answer: Record<string, unknown>; explanation: string; learning_objective: string;
  options: { label: string; body: string; is_correct: boolean }[];
  reviews: { version: number; decision: "approve" | "request_changes"; note: string; created_at: string; by_author: boolean }[];
  reports: { id: string; reason: string; message: string; status: string; created_at: string }[];
};
export type Overview = {
  content: Record<string, number>;
  ai_waiting_review: number;
  open_reports: number;
  usage?: {
    users: number; active_7d: number; failed_7d: number;
    ai_7d: { feature: string; provider: string; count: number }[];
    evaluation_queue: Record<string, number>;
  };
};
export type ReportRow = {
  id: string; question_id: string; external_id: string; category: string; reason: string; message: string;
  status: string; created_at: string;
};
export type UserRow = {
  id: string; email: string | null; created_at: string; last_sign_in_at: string | null; display_name: string | null;
  roles: string[]; attempts: number;
};
export type BlueprintRow = {
  code: string; version: string; name: string; kind: string; status: string; verified: boolean; items: number;
  shortages: { type: string; needed: number; published: number }[];
};
export type Calibration = {
  samples: { evaluation_id: string; task_type: string; response: string; ai_bands: Record<string, string>;
    human_bands: Record<string, string> | null; created_at: string }[];
  report: { task_type: string; ratings: number; exact: number; adjacent: number; meets_minimum: boolean;
    numeric_estimates_enabled: boolean }[];
};

export const STAFF_ROLES = ["admin", "content_editor"];
export const isStaff = (roles: string[]) => roles.some((r) => STAFF_ROLES.includes(r));

export class AdminError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function adminFetch<T>(baseUrl: string, token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl}/api/v1/admin${path}`, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    throw new AdminError(res.status, body.error?.code ?? "error", body.error?.message ?? res.statusText);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
