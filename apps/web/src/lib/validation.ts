// Pure validation helpers shared by forms (unit-tested).
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegister(v: {
  email: string;
  password: string;
  ageConfirmed: boolean;
  termsAccepted: boolean;
}): FieldErrors<"email" | "password" | "age" | "terms"> {
  const e: FieldErrors<"email" | "password" | "age" | "terms"> = {};
  if (!EMAIL_RE.test(v.email.trim())) e.email = "email";
  if (v.password.length < 8) e.password = "passwordShort";
  if (!v.ageConfirmed) e.age = "age";
  if (!v.termsAccepted) e.terms = "terms";
  return e;
}

export function validateOnboarding(
  v: { levelCode: number | null; targetScore: string; examDate: string },
  today: string = new Date().toISOString().slice(0, 10),
): FieldErrors<"level" | "target" | "examDate"> {
  const e: FieldErrors<"level" | "target" | "examDate"> = {};
  if (!v.levelCode || v.levelCode < 1 || v.levelCode > 6) e.level = "level";
  const n = Number(v.targetScore);
  if (!/^\d+$/.test(v.targetScore) || n < 10 || n > 90) e.target = "target";
  if (v.examDate && v.examDate < today) e.examDate = "examDate";
  return e;
}

/** Only allow internal redirect targets (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
