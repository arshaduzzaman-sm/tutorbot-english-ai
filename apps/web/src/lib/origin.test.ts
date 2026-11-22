import { describe, expect, it } from "vitest";
import { publicOrigin } from "./origin";

describe("publicOrigin", () => {
  it("uses the browser's Host header", () => {
    expect(publicOrigin(new Headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
  });
  it("never redirects to the Docker bind address or a malformed host", () => {
    expect(publicOrigin(new Headers({ host: "0.0.0.0:3000" }))).toBe("http://localhost:3000");
    expect(publicOrigin(new Headers({ host: "evil.com/path" }))).toBe("http://localhost:3000");
  });
});
