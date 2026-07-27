import { describe, expect, test } from "vitest";
import { resolveInitialAppLanguage } from "./appLanguage";

describe("resolveInitialAppLanguage", () => {
  test("uses a saved language preference before the system language", () => {
    expect(resolveInitialAppLanguage("en", ["ja-JP"])).toBe("en");
    expect(resolveInitialAppLanguage("ja", ["en-US"])).toBe("ja");
  });

  test("uses Japanese for a Japanese system language when no preference is saved", () => {
    expect(resolveInitialAppLanguage(null, ["ja-JP", "en-US"])).toBe("ja");
  });

  test("uses English for other or unavailable system languages", () => {
    expect(resolveInitialAppLanguage(null, ["en-US"])).toBe("en");
    expect(resolveInitialAppLanguage(null, ["en-US", "ja-JP"])).toBe("en");
    expect(resolveInitialAppLanguage(null, ["fr-FR"])).toBe("en");
    expect(resolveInitialAppLanguage(null, [])).toBe("en");
  });
});
