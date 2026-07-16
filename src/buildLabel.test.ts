import { describe, expect, it } from "vitest";
import { formatBuildLabel } from "./buildLabel";

describe("formatBuildLabel", () => {
  it("formats the build number for the status bar", () => {
    expect(formatBuildLabel("20260716.234245")).toBe("build 20260716.234245");
  });
});
