import { describe, expect, it } from "vitest";
import capability from "../src-tauri/capabilities/default.json";

describe("native window permissions", () => {
  it("allows the document title to be synchronized to the native window", () => {
    expect(capability.permissions).toContain("core:window:allow-set-title");
  });
});
