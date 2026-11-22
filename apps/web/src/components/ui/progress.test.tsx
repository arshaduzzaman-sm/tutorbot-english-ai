import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "./progress";

describe("Progress", () => {
  it("clamps and exposes an accessible value", () => {
    render(<Progress value={1.7} label="Reading" />);
    expect(screen.getByRole("progressbar", { name: "Reading" })).toHaveAttribute("aria-valuenow", "100");
  });
});
