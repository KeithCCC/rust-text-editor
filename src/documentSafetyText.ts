export type DocumentSafetyLanguage = "en" | "ja";

export function getDocumentSafetyText(
  language: DocumentSafetyLanguage,
  fileName: string,
) {
  if (language === "ja") {
    return {
      unsavedTitle: "変更を保存しますか？",
      unsavedMessage: `${fileName} には保存されていない変更があります。`,
      save: "保存",
      dontSave: "保存しない",
      cancel: "キャンセル",
      recoveryTitle: "未保存の文書を復元しますか？",
      recoveryMessage: "前回のセッションで保存されなかった変更が見つかりました。",
      recover: "復元",
      discardRecovery: "破棄",
      recoveryFailed: "復元データの処理に失敗しました",
    } as const;
  }

  return {
    unsavedTitle: "Save changes?",
    unsavedMessage: `${fileName} has unsaved changes.`,
    save: "Save",
    dontSave: "Don't Save",
    cancel: "Cancel",
    recoveryTitle: "Recover unsaved document?",
    recoveryMessage: "Koharu found changes that were not saved in the previous session.",
    recover: "Recover",
    discardRecovery: "Discard",
    recoveryFailed: "Recovery data could not be processed",
  } as const;
}
