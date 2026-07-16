# Koharu Help Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Koharuのメニューバーから、初心者向けの基本操作・Markdown例・ショートカットを日英で確認できるアプリ内ヘルプを開けるようにする。

**Architecture:** ヘルプ本文とダイアログ操作を独立した `HelpDialog` コンポーネントに置き、`App` は表示状態とメニュー導線だけを管理する。固定コンテンツのみを使用し、ファイル状態やネットワークには触れない。

**Tech Stack:** React 18、TypeScript、Vitest、React DOM server rendering、既存CSS。

## Global Constraints

- 日本語UIでは日本語、英語UIでは英語を表示する。
- Wikiリンク、コマンドパレット、Vault、Mermaid、Excalidraw、相対Markdownリンクは案内しない。
- 編集内容、現在のファイル、未保存状態、プレビュー状態を変更しない。
- 右上ボタン、下部ボタン、`Escape`キーで閉じられるようにする。
- 新しい外部依存関係やネットワーク通信を追加しない。

---

### Task 1: HelpDialogの表示内容と操作

**Files:**
- Create: `src/components/HelpDialog.tsx`
- Create: `src/components/HelpDialog.test.tsx`

**Interfaces:**
- Consumes: `language: "en" | "ja"`、`onClose: () => void`
- Produces: `HelpDialog(props)`、`handleHelpDialogKeyDown(event, onClose): void`

- [ ] **Step 1: 日本語・英語表示とEscape操作の失敗テストを書く**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HelpDialog, handleHelpDialogKeyDown } from "./HelpDialog";

describe("HelpDialog", () => {
  it("renders beginner help in Japanese", () => {
    const html = renderToStaticMarkup(<HelpDialog language="ja" onClose={() => undefined} />);
    expect(html).toContain("Koharuの使い方");
    expect(html).toContain("ファイルを作る・開く・保存する");
    expect(html).toContain("Markdownの書き方");
    expect(html).toContain("Ctrl+S");
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it("renders beginner help in English", () => {
    const html = renderToStaticMarkup(<HelpDialog language="en" onClose={() => undefined} />);
    expect(html).toContain("How to use Koharu");
    expect(html).toContain("Create, open, and save files");
    expect(html).toContain("Markdown basics");
    expect(html).toContain("Ctrl+F");
  });

  it("closes only for Escape", () => {
    const onClose = vi.fn();
    handleHelpDialogKeyDown({ key: "Enter" }, onClose);
    expect(onClose).not.toHaveBeenCalled();
    handleHelpDialogKeyDown({ key: "Escape" }, onClose);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: テストを実行し、コンポーネント未作成で失敗することを確認する**

Run: `npm test -- src/components/HelpDialog.test.tsx`

Expected: FAIL because `./HelpDialog` does not exist.

- [ ] **Step 3: 最小のHelpDialogを実装する**

`HelpDialog.tsx` に日英の見出し、基本操作、Markdown例、ショートカット表を固定データとして定義する。ルート要素は `className="modal-backdrop help-dialog-backdrop"`、その内側は `role="dialog" aria-modal="true" aria-labelledby="help-dialog-title"` とし、右上と下部のボタンはどちらも `onClose` を呼ぶ。`useEffect` で `keydown` を購読し、`handleHelpDialogKeyDown` に渡す。

```tsx
export type HelpLanguage = "en" | "ja";

export function handleHelpDialogKeyDown(
  event: Pick<KeyboardEvent, "key">,
  onClose: () => void,
) {
  if (event.key === "Escape") onClose();
}

export function HelpDialog({ language, onClose }: HelpDialogProps) {
  const content = HELP_CONTENT[language];
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleHelpDialogKeyDown(event, onClose);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);

  return (
    <section className="modal-backdrop help-dialog-backdrop">
      <div className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-dialog-title">
        <header className="modal-toolbar">
          <strong id="help-dialog-title">{content.title}</strong>
          <button type="button" aria-label={content.closeLabel} onClick={onClose}>×</button>
        </header>
        <div className="help-dialog-body">
          <p>{content.introduction}</p>
          <div className="help-sections">{content.sections.map(renderHelpSection)}</div>
          <table className="help-shortcuts"><tbody>{content.shortcuts.map(renderShortcut)}</tbody></table>
        </div>
        <footer className="help-dialog-footer">
          <button type="button" onClick={onClose}>{content.close}</button>
        </footer>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: コンポーネントテストが成功することを確認する**

Run: `npm test -- src/components/HelpDialog.test.tsx`

Expected: 3 tests PASS.

- [ ] **Step 5: Task 1をコミットする**

```powershell
git add src/components/HelpDialog.tsx src/components/HelpDialog.test.tsx
git commit -m "feat: add beginner help dialog"
```

### Task 2: ヘルプメニューとダイアログの統合

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `HelpDialog({ language, onClose })`
- Produces: `MenuId` の `help`、`isHelpOpen` 表示状態、日英の `help` と `howToUseKoharu` ラベル

- [ ] **Step 1: メニュー統合後に必要な静的表示をTask 1のテストへ追加して失敗を確認する**

```tsx
expect(html).toContain('aria-label="Koharuの使い方を閉じる"');
expect(html).toContain("プレビューを切り替える");
expect(html).toContain("Ctrl+Shift+V");
expect(html).toContain("Close How to use Koharu");
```

Run: `npm test -- src/components/HelpDialog.test.tsx`

Expected: FAIL because the additional labels and preview shortcut row are not yet rendered.

- [ ] **Step 2: Appへヘルプメニューと表示状態を追加する**

`src/App.tsx` で `HelpDialog` をimportし、次の変更を行う。

```tsx
type MenuId = "file" | "view" | "settings" | "search" | "format" | "help";

// UI_TEXT.en
help: "Help",
howToUseKoharu: "How to use Koharu",

// UI_TEXT.ja
help: "ヘルプ",
howToUseKoharu: "Koharuの使い方",

const [isHelpOpen, setIsHelpOpen] = useState(false);
```

「書式」の後、右端Previewボタンの前に既存パターンと同じ `menu-root` を追加する。「Koharuの使い方」の選択では `runMenuAction(() => setIsHelpOpen(true))` を呼ぶ。モーダル領域に次を追加する。

```tsx
{isHelpOpen && (
  <HelpDialog language={appLanguage} onClose={() => setIsHelpOpen(false)} />
)}
```

- [ ] **Step 3: ヘルプ用CSSを追加する**

`src/styles.css` に、最大幅880px、最大高760px、3行グリッド、スクロール本文、2列セクション、読みやすいコード例とショートカット表、狭い画面で1列になるスタイルを追加する。

```css
.help-dialog { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; width: min(880px, 100%); max-height: min(760px, 100%); overflow: hidden; }
.help-dialog-body { overflow-y: auto; padding: 20px; }
.help-sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.help-dialog-footer { display: flex; justify-content: flex-end; padding: 12px; border-top: 1px solid var(--border); }
@media (max-width: 700px) { .help-sections { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: 対象テストと全フロントエンドテストを実行する**

Run: `npm test -- src/components/HelpDialog.test.tsx`

Expected: all HelpDialog tests PASS.

Run: `npm test`

Expected: all test files PASS.

- [ ] **Step 5: Task 2をコミットする**

```powershell
git add src/App.tsx src/styles.css src/components/HelpDialog.test.tsx
git commit -m "feat: open help from the menu bar"
```

### Task 3: 最終検証と配布準備

**Files:**
- Modify: `src/buildInfo.ts`（ビルドスクリプトによる更新のみ）

**Interfaces:**
- Consumes: 完成したヘルプ機能
- Produces: テスト済みのWeb/Tauriビルド

- [ ] **Step 1: 仕様外の語句がヘルプに含まれていないことを検索する**

Run: `rg -n "Wiki|Vault|Command Palette|Mermaid|Excalidraw|相対Markdown" src/components/HelpDialog.tsx`

Expected: no matches.

- [ ] **Step 2: 型検査とVite本番ビルドを実行する**

Run: `npm run build`

Expected: exit code 0. Large Mermaid/Excalidraw chunk warnings are accepted as existing warnings.

- [ ] **Step 3: Rust/Tauri側を確認する**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: exit code 0.

- [ ] **Step 4: 差分と作業ツリーを確認する**

Run: `git diff --check` and `git status --short`

Expected: no whitespace errors; only intended build stamp changes may remain.

- [ ] **Step 5: 検証結果をコミットする**

```powershell
git add src/buildInfo.ts
git commit -m "chore: update Koharu build stamp"
```
