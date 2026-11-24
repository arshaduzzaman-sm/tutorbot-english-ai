"use client";

import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import type { components } from "@/api/schema";

export type EvaluationOut = components["schemas"]["EvaluationOut"];
export type Band = "needs_work" | "developing" | "good" | "strong";
export type EvalResult = {
  task_type: string;
  criteria: { name: string; band: Band; explanation: string; signals: Record<string, unknown> }[];
  errors: { type: string; text: string; correction: string; explanation: string; position: number | null }[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  flags: string[];
  feedback: string;
  provider: "local" | "mock";
  disclaimer: string;
};

async function token(): Promise<string | null> {
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}

/** Sends the recording as the raw request body (the API stores it on this computer only). */
export async function uploadRecording(
  questionId: string, blob: Blob, seconds: number, mode: string, testSessionId?: string,
): Promise<{ id: string } | { error: string; code?: string }> {
  const t = await token();
  if (!t) return { error: "Please log in again." };
  const qs = new URLSearchParams({ duration_seconds: seconds.toFixed(1), mode });
  if (testSessionId) qs.set("test_session_id", testSessionId);
  const res = await fetch(`${publicEnv.apiUrl}/api/v1/speaking/questions/${questionId}/recording?${qs}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": blob.type || "audio/webm" },
    body: blob,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: body?.error?.message ?? "Upload failed.", code: body?.error?.code };
  return { id: body.id as string };
}

/** Polls until the evaluation is done or failed (about 2 minutes at most). */
export async function waitForEvaluation(id: string, onTick?: (e: EvaluationOut) => void): Promise<EvaluationOut | null> {
  const t = await token();
  if (!t) return null;
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`${publicEnv.apiUrl}/api/v1/evaluations/${id}`, { headers: { Authorization: `Bearer ${t}` } });
    if (res.ok) {
      const e = (await res.json()) as EvaluationOut;
      onTick?.(e);
      if (e.status === "done" || e.status === "failed") return e;
    }
    await new Promise((r) => setTimeout(r, i < 10 ? 500 : 1500));
  }
  return null;
}

export async function recordingUrl(recordingId: string): Promise<string | null> {
  const t = await token();
  if (!t) return null;
  const res = await fetch(`${publicEnv.apiUrl}/api/v1/recordings/${recordingId}`, { headers: { Authorization: `Bearer ${t}` } });
  return res.ok ? URL.createObjectURL(await res.blob()) : null;
}
