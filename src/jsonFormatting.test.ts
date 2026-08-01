import { describe, expect, it } from "vitest";
import { formatJsonContent } from "./jsonFormatting";

describe("formatJsonContent", () => {
  it("pretty-prints valid JSON with two-space indentation", () => {
    expect(formatJsonContent('{"name":"Koharu","ready":true}')).toEqual({
      ok: true,
      content: '{\n  "name": "Koharu",\n  "ready": true\n}',
    });
  });

  it("preserves the parser error for App error reporting", () => {
    const result = formatJsonContent("{not json}");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});
