# Compact Header Build Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** メニューバー下の情報帯を削除し、Build番号だけを下部ステータスバー右端へ移す。

**Architecture:** Build表示形式は純粋関数へ分離して単体テストし、`App`はその結果を下部ステータスバーへ表示する。上部情報帯のJSXと専用CSSを削除し、ヘッダーを1段構成にする。

**Tech Stack:** React 18、TypeScript、Vitest、既存CSS。

## Global Constraints

- Windows標準タイトルバーは変更しない。
- 更新日時と「単一ファイルテキストエディタ」は画面から削除する。
- ファイルパス、保存状態、プレビュー状態、行数、文字数は維持する。
- Build番号は下部ステータスバーの一番右に `build <buildNumber>` 形式で表示する。
- 新しい外部依存関係を追加しない。

---

### Task 1: Build表示形式

**Files:**
- Create: `src/buildLabel.ts`
- Create: `src/buildLabel.test.ts`

**Interfaces:**
- Consumes: `buildNumber: string`
- Produces: `formatBuildLabel(buildNumber: string): string`

- [ ] **Step 1: 失敗テストを書く**

```ts
import { describe, expect, it } from "vitest";
import { formatBuildLabel } from "./buildLabel";

describe("formatBuildLabel", () => {
  it("formats the build number for the status bar", () => {
    expect(formatBuildLabel("20260716.234245")).toBe("build 20260716.234245");
  });
});
```

- [ ] **Step 2: 未実装で失敗することを確認する**

Run: `npm test -- src/buildLabel.test.ts`

Expected: FAIL because `./buildLabel` does not exist.

- [ ] **Step 3: 最小実装を追加する**

```ts
export function formatBuildLabel(buildNumber: string) {
  return `build ${buildNumber}`;
}
```

- [ ] **Step 4: 対象テストが成功することを確認する**

Run: `npm test -- src/buildLabel.test.ts`

Expected: 1 test PASS.

### Task 2: 上部情報帯の削除と下部表示

**Files:**
- Modify: `src/App.tsx:13,956-961,1094-1100`
- Modify: `src/styles.css:172-179,358-393,1091-1108,1431-1435`

**Interfaces:**
- Consumes: `formatBuildLabel(BUILD_INFO.buildNumber)`
- Produces: 下部右端の `.statusbar-build` 表示

- [ ] **Step 1: Appの上部情報帯を削除する**

`src/App.tsx` から次の要素を削除する。

```tsx
<div className="window-caption">
  <strong>Koharu</strong>
  <span className="build-badge">build {BUILD_INFO.buildNumber}</span>
  <span className="build-updated">updated {BUILD_INFO.updatedAt}</span>
  <span>{text.singleFileCaption}</span>
</div>
```

同時に、日英の `UI_TEXT` から画面で使わなくなる `singleFileCaption` を削除する。

- [ ] **Step 2: Build番号を下部へ追加する**

`formatBuildLabel` をimportし、既存の文字数表示の後ろへ追加する。

```tsx
<span>{text.chars} {stats.chars}</span>
<span className="statusbar-build">{formatBuildLabel(BUILD_INFO.buildNumber)}</span>
```

- [ ] **Step 3: ヘッダーとステータスバーCSSを整理する**

`app-header` の `grid-template-rows: 32px auto` を削除し、`window-caption`、`build-badge`、`build-updated` とモバイル用 `window-caption` 規則を削除する。共通の文字色指定は次の形にする。

```css
.pane-header small,
.statusbar,
.excalidraw-card small {
  color: var(--muted);
  font-size: 12px;
}

.statusbar-build {
  flex: 0 0 auto;
  white-space: nowrap;
}
```

- [ ] **Step 4: 全フロントエンドテストを実行する**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 5: 変更をコミットする**

```powershell
git add src/buildLabel.ts src/buildLabel.test.ts src/App.tsx src/styles.css docs/superpowers/plans/2026-07-16-compact-header-build-status.md
git commit -m "feat: move build number to status bar"
```

### Task 3: 最終検証

**Files:**
- Modify: `src/buildInfo.ts`（ビルドスクリプトによる更新のみ）

**Interfaces:**
- Consumes: 完成した1段ヘッダーと下部Build表示
- Produces: 検証済みのWeb/Tauriコード

- [ ] **Step 1: 削除対象のCSS識別子が残っていないことを確認する**

Run: `rg -n "window-caption|build-badge|build-updated" src`

Expected: no matches.

- [ ] **Step 2: 本番ビルドを実行する**

Run: `npm run build`

Expected: exit code 0. Existing large chunk warnings are accepted.

- [ ] **Step 3: Rust側を確認する**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: exit code 0.

- [ ] **Step 4: 差分を確認してビルド番号を記録する**

Run: `git diff --check` and `git status --short`

Expected: whitespace errorsなし。`src/buildInfo.ts`のみがビルド時更新として残る。

- [ ] **Step 5: ビルド番号をコミットする**

```powershell
git add src/buildInfo.ts
git commit -m "chore: update Koharu build stamp"
```
