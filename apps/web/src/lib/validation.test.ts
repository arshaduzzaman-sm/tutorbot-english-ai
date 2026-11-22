import { describe, expect, it } from "vitest";
import { safeNext, validateOnboarding, validateRegister } from "./validation";

describe("validateRegister", () => {
  it("accepts a valid form", () => {
    expect(validateRegister({ email: "a@b.co", password: "12345678", ageConfirmed: true, termsAccepted: true })).toEqual({});
  });
  it("requires 16+ confirmation, terms, a real email and 8+ characters", () => {
    expect(validateRegister({ email: "nope", password: "short", ageConfirmed: false, termsAccepted: false })).toEqual({
      email: "email",
      password: "passwordShort",
      age: "age",
      terms: "terms",
    });
  });
});

describe("validateOnboarding", () => {
  const today = "2026-11-22";
  it("accepts level 1-6 and target 10-90", () => {
    expect(validateOnboarding({ levelCode: 4, targetScore: "79", examDate: "2026-12-01" }, today)).toEqual({});
  });
  it.each([
    [{ levelCode: null, targetScore: "50", examDate: "" }, "level"],
    [{ levelCode: 7, targetScore: "50", examDate: "" }, "level"],
    [{ levelCode: 1, targetScore: "9", examDate: "" }, "target"],
    [{ levelCode: 1, targetScore: "91", examDate: "" }, "target"],
    [{ levelCode: 1, targetScore: "7x", examDate: "" }, "target"],
    [{ levelCode: 1, targetScore: "50", examDate: "2026-11-21" }, "examDate"],
  ])("rejects %o", (input, key) => {
    expect(Object.keys(validateOnboarding(input, today))).toEqual([key]);
  });
});

describe("safeNext", () => {
  it("only allows internal paths", () => {
    expect(safeNext("/profile")).toBe("/profile");
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("/\\evil")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
  });
});
