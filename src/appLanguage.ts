export type AppLanguage = "en" | "ja";

export function resolveInitialAppLanguage(
  savedLanguage: string | null,
  systemLanguages: readonly string[],
): AppLanguage {
  if (savedLanguage === "en" || savedLanguage === "ja") {
    return savedLanguage;
  }

  return systemLanguages[0]?.toLowerCase().startsWith("ja")
    ? "ja"
    : "en";
}
