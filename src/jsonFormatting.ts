export type JsonFormattingResult =
  | { ok: true; content: string }
  | { ok: false; message: string };

export function formatJsonContent(content: string): JsonFormattingResult {
  try {
    return {
      ok: true,
      content: JSON.stringify(JSON.parse(content), null, 2),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
