# Koharu Direct Table Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. ユーザー承認を受けて実装中。以下のチェックリストは当初計画を保持し、実施結果と変更点は末尾の検証記録を正とする。

**Goal:** 既存 CodeMirror の本文中で Markdown テーブルを直接編集できるようにし、日本語入力・保存・Undo・文書切替まで一貫した動作を提供する。

**Architecture:** CodeMirror の文書を永続化対象の唯一の正本とし、表の範囲を StateField が提供する block replacement decoration と編集ウィジェットで表示する。既存の表モデルと操作を改修し、表専用 extension とセル編集状態を分離する。本文のソース編集と Edit / Split / Preview の画面構成は継続し、既存 Live Preview 全体の有効化は行わない。

**Tech Stack:** React 18 / TypeScript / CodeMirror 6 / Tauri 2 / Vitest / jsdom。大型の表・リッチテキストライブラリは追加しない。

**Spec:** 本文書の「採用する仕様」。ユーザーが選択した「既存 CodeMirror に表専用の編集機能を追加」を具体化した実装仕様案。

## Global Constraints

- 保存形式は通常の Markdown。独自 JSON、HTML テーブルへの変換、外部データファイルを導入しない。
- Edit と Split のエディター側で直接編集を既定にする。Preview は既存の閲覧表示を使う。
- 本文の見出し・リンク・リストを含む Live Preview 全体への切替をしない。
- 日本語と英語、明暗テーマ、キーボード操作を初回リリースの対象にする。
- CodeMirror の変更は既存 onChange → handleContentChange → latestDocumentRef / recovery / modified の経路に流す。
- readOnly および文書操作中の action gate を表 UI から迂回しない。
- 非編集部分のソースは維持する。セル単独編集で表全体を再整形しない。
- この計画作成ではコミット・プッシュ・アプリ実装は行わない。実装時は各タスクの検証後に小さなコミットを作る。

## 調査結果と修正が必要な点

基準: master `d75c8bc`。調査時の関連テスト18件は成功したが、既存の直接編集 UI の実ブラウザー検証は未実施。

| 箇所 | 現状・問題 | 対応タスク |
| --- | --- | --- |
| src/App.tsx | MarkdownEditor に mode="source" を固定指定。表ウィジェットは live 専用で到達しない | 2、6 |
| src/components/MarkdownEditor.tsx: readTableAt | 切り出した表に文書全体の from/to を渡して再度 slice する。見出し後の表で null を再現 | 1 |
| src/tableMarkdown.ts | 判定が複数列前提。1列の表を認識できないことを再現 | 1 |
| 同上 | バックスラッシュを一律に増やす書き戻し、列数不一致時の切り捨て、改行形式の正規化により内容が変わるおそれ | 1 |
| MarkdownEditor: TableWidget | input は高さ調整だけで、主に blur / Tab 時に本文へ確定。フォーカス中の保存・未保存確認との同期が不足 | 3、6 |
| 同上: focusCell | 文書全体を行・列だけで検索。複数表を区別しない | 2、4 |
| 同上: livePreviewExtension | 全トランザクションで全文を走査してウィジェットを再生成。フォーカス・IME・性能の検証が必要 | 2、3、7 |
| 同上 | セル textarea と行列ボタンに readOnly 制御がない | 3、6 |
| 同上 | テキストベースの表検出でコードフェンス等の構文を考慮していない | 1、2 |
| 同上 | 表ソースを CSS で隠す方式。本文選択・検索位置・表をまたぐ操作の整理が必要 | 2、6 |

## 採用する仕様

### 初回リリースの操作

1. 正しく解析できる表は罫線付きの表として本文中に表示する。クリックしたセルをその場で編集する。
2. セルはプレーンな Markdown 入力とし、`**太字**` 等のインライン記法は初回はセル内で見える。表のパイプと区切り行を利用者が操作する必要はない。`<br>` はセル内改行として扱う。
3. Tab / Shift+Tab は次／前セルへ移動。末尾の Tab は行を1つ追加してその先頭へ。先頭の Shift+Tab は表の前の本文へ出る。
4. Enter は同じ列の次行へ移動し、最終行では行を追加する。Shift+Enter はセル内改行。IME 変換中の Enter / Tab は表操作にしない。
5. Escape は確定済み入力を残して本文へ戻る。取り消しは Ctrl+Z。既存試作の「Escape で値を戻す」挙動は採用しない。
6. 行・列の追加／削除、列の左／中央／右配置を表の操作メニューで提供する。最後の1列は削除不可。本文行をすべて削除してもヘッダーと区切り行は残す。
7. 表単位の「ソースを編集」で生の Markdown を表示し、「表に戻す」で復帰する。不正な表になった場合はソースを表示し続け、内容を捨てない。
8. セルフォーカス中の Ctrl+S、保存メニュー、別名保存、文書切替、終了、復旧が最新入力を扱う。日本語変換中の保存・文書切替は compositionend 後に処理を再開する。タイマーで変換を強制確定しない。
9. セルの Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y は CodeMirror 履歴へ接続する。通常のセル編集と行列操作を意味のある単位で Undo できる。
10. セル中の太字／斜体ショートカットと書式ツールバーはそのセル選択に作用する。見出し・リスト等のブロック書式はセルフォーカス中は無効にし、本文の古い選択へ誤適用しない。
11. 検索で表内の文字へ移動する場合は対象表を一時的にソース表示にして一致範囲を可視化する。本文の選択が表をまたぐ場合も関連する表をソース表示し、コピー・削除対象を見えるようにする。
12. 解析できない記法はソース編集へ安全に戻す。初回の直接編集対象は文書直下の表。引用・リスト内の表はソースのまま扱う。

### 次段階へ分ける機能

- 非編集中セルの太字・リンク・コードの装飾表示。
- Excel / TSV からの複数セル貼り付け、範囲選択。
- 行列のドラッグ並べ替え、列幅の永続化。
- セル結合、数式、HTML テーブルは本計画の対象外。

通常の文字列貼り付けは初回に含める。タブ区切り貼り付けを自動で複数セルに分割しない。

## ファイル構成と責務

| ファイル | 種別 | 責務 |
| --- | --- | --- |
| src/tableMarkdown.ts / .test.ts | 改修 | 位置付き表モデル、解析、セル差分、行列操作、エスケープ保持 |
| src/editor/tableEditingState.ts / .test.ts | 新規 | 表 ID、位置マッピング、フォーカス・composition・ソース表示状態、履歴境界 |
| src/editor/tableEditingExtension.ts / .test.ts | 新規 | GFM 構文からの検出、StateField、block decorations、選択との連携 |
| src/editor/TableWidget.ts | 新規 | 表 DOM、セル入力、メニュー、キーボード、readOnly・ARIA |
| src/editor/tableEditingUi.ts / .test.ts | 新規 | 日本語・英語の表操作ラベル |
| src/components/MarkdownEditor.tsx | 改修 | 表 extension の接続、既存 TableWidget の移動、ハンドル連携 |
| src/components/MarkdownEditor.tableEditing.test.tsx | 新規 | 実 CodeMirror をマウントした表操作統合テスト |
| src/components/MarkdownEditorSafety.test.ts | 改修 | 表の読み取り専用動作 |
| src/components/MarkdownEditor.transactionSafety.test.tsx | 必要箇所改修 | 本文と表の履歴・選択の回帰確認 |
| src/App.tsx | 改修 | 言語、保存と文書遷移前の編集準備、書式コンテキスト |
| src/App.tableEditing.test.tsx | 新規 | 保存・別名保存・モード切替・未保存確認の統合 |
| src/App.documentSessionSafety.test.tsx | 改修 | composition 待機中の文書セッション安全性 |
| src/styles.css | 改修 | live モードに依存しない表 CSS、横スクロール、フォーカス |
| src/components/HelpDialog.tsx / .test.tsx | 改修 | 操作説明とソース表示の案内 |

既存の viewMode.ts の3種類は増やさない。Rust 側とファイル形式の変更は予定しない。

## 共通インターフェース案

実装時に以下を基準に型をそろえ、変更時は利用側とテストを同時に更新する。

```ts
// src/tableMarkdown.ts — from/to は常に文書全体の位置
export type TableCellRange = { from: number; to: number; raw: string };
// MarkdownTableCell に range?: TableCellRange を追加。新規セルは未採番可。
export type TableTextChange = { from: number; to: number; insert: string };
export function parseMarkdownTable(source: string, from: number, to: number): MarkdownTable | null;
export function createTableCellChange(
  source: string, table: MarkdownTable, row: number, column: number, text: string,
): TableTextChange | null;
export function setTableColumnAlignment(
  table: MarkdownTable, column: number, alignment: TableAlignment,
): MarkdownTable;

// src/editor/tableEditingState.ts
export type TableCellAddress = { tableId: string; row: number; column: number };
export type TableEditingContext = { activeCell: TableCellAddress | null; composing: boolean };
// src/editor/tableEditingExtension.ts
export function tableEditingExtension(options: {
  language: "ja" | "en";
  onContextChange: (context: TableEditingContext) => void;
}): Extension;
export function prepareTableEditing(view: EditorView): Promise<boolean>;
// 非変換中は直ちに true。変換中は確定と文書同期を待つ。
// view破棄・文書セッション失効時はfalseとして呼出元操作を中止する。
```

Table ID は位置そのものにせず extension 内で採番し、変更の ChangeDesc による位置マッピングと再解析で維持する。Undo 復活時に以前の ID の復元を必須とせず、フォーカス復元は更新後の表範囲を照合する。古い DOM のイベントは現行状態に対象表があることを確認してから処理する。

## Task 1: 表モデルと Markdown の往復保持を修正

**Files:** src/tableMarkdown.ts, src/tableMarkdown.test.ts

**Consumes:** 文書全体と表範囲。
**Produces:** 共通インターフェースの位置付きセルと createTableCellChange / setTableColumnAlignment。

- [ ] 次の回帰テストを追加し、`npx vitest run src/tableMarkdown.test.ts` で現行実装の失敗を確認する。

```ts
it("parses the user's one-column table after a heading", () => {
  const prefix = "# 計画\n\n";
  const raw = "| 方針 |\n| --- |\n| **既存 CodeMirror**<br><br>改修 |";
  const table = parseMarkdownTable(prefix + raw, prefix.length, prefix.length + raw.length);
  expect(table?.headers).toHaveLength(1);
  expect(table?.rows[0].cells[0].text).toBe("**既存 CodeMirror**\n\n改修");
});
```

- [ ] 表解析を全文座標へ統一し、ヘッダーと区切り行の列数一致、1列、空セル、ヘッダーだけの表を扱う。GFM の区切り行仕様は導入済みパーサーと合わせる。
- [ ] セルの raw / from / to を記録し、セル変更ではその範囲だけ置換する。CRLF の入出力は CodeMirror の lineSeparator と既存保存経路の方針を確認し、表独自に全文改行を変換しない。
- [ ] decode / encode を対で扱う。リテラルのバックスラッシュ、エスケープ済みパイプ、インラインコード、リンク、`<br>` を繰り返し編集しても増殖・欠落させない。未変更セルは raw を再利用する。
- [ ] 行列数が不一致で安全な再構成を保証できない表は null としてソース表示へ戻す。余剰セルを切り捨てない。
- [ ] 下記差分テストと、行列追加削除・配置変更の結果テストを通す。

```ts
const source = "| A | B |\n| --- | --- |\n| x | keep |";
const table = parseMarkdownTable(source, 0, source.length)!;
const change = createTableCellChange(source, table, 1, 0, "日本語")!;
expect(source.slice(0, change.from) + change.insert + source.slice(change.to))
  .toBe("| A | B |\n| --- | --- |\n| 日本語 | keep |");
```

- [ ] 関連テスト成功後に `fix: preserve markdown table content and ranges` をコミットする。

## Task 2: 表専用 extension と安定したウィジェットを構成

**Files:** src/editor/tableEditingState.ts, src/editor/tableEditingExtension.ts, src/editor/TableWidget.ts, 各テスト, src/components/MarkdownEditor.tsx

**Consumes:** Task 1 の表モデル。
**Produces:** tableEditingExtension、TableCellAddress、表単位のソース表示状態。

- [ ] 実 CodeMirror のテストで、先頭・見出し後・複数表・1列表が表として表示され、フェンス内の同じ文字列はソースのままであることを検証する。
- [ ] 導入済み @codemirror/lang-markdown の構文木に GFM Table が含まれるかローカルで確認する。不足時は対応する Markdown 構文拡張を明示し、直接 import する依存は package.json に明示する。バージョン互換性を確認する。
- [ ] 表専用 StateField を実装し、block decoration は field から直接提供する。表範囲を `Decoration.replace({widget, block: true})` で置き換える。CSS で本文行を隠す旧方式を表専用経路に持ち込まない。

```ts
// 表以外の sourceHeadingExtension はそのまま有効。
// mode="live" と二重登録しない。既存表処理は新extensionへ移動する。
const replacement = Decoration.replace({ widget, block: true }).range(table.from, table.to);
```

- [ ] 変更位置を map し、影響する表を再解析する。選択移動だけで全文再解析・全 DOM 作り直しをしない。WidgetType.eq / updateDOM で編集対象の textarea を保持する。
- [ ] 読み込み時に構文解析が未完了ならソース表示を維持し、構文木更新で表表示へ移る。巨大文書で全文同期解析を強制しない。
- [ ] 表 ID とローカル DOM 範囲でセルを特定し、他の表へ飛ばないテストを通す。
- [ ] `npx vitest run src/editor/tableEditingExtension.test.ts src/editor/tableEditingState.test.ts src/components/MarkdownEditor.tableEditing.test.tsx` を通し、`feat: add isolated table editing extension` をコミットする。

## Task 3: 入力・IME・Undo を文書状態へ接続

**Files:** src/editor/TableWidget.ts, src/editor/tableEditingState.ts, src/editor/tableEditingExtension.ts, src/components/MarkdownEditor.tableEditing.test.tsx, src/components/MarkdownEditorSafety.test.ts

**Consumes:** セル差分、表 ID、CodeMirror history。
**Produces:** 最新本文へ同期するセル編集と prepareTableEditing。

- [ ] フォーカスを外さず input を送った時点で onChange に最新セル文字列が出るテストを追加する。

```ts
textarea.value = "更新済み";
textarea.dispatchEvent(new Event("input", { bubbles: true }));
expect(view.state.doc.toString()).toContain("更新済み");
```

- [ ] 通常入力は createTableCellChange の差分を即 dispatch する。ウィジェット更新で textarea の選択位置を失わない。onChange が返す本文とセル値を同期する。
- [ ] compositionstart から compositionend までは同じ DOM に入力を保持し、表移動・行追加・再構成を抑制する。compositionend の値を本文に一度だけ同期する。input の前後順序差でも二重確定しない。
- [ ] prepareTableEditing は変換中のみ待機し、確定後に同期完了を返す。destroy 時に待機を false で解放する。readOnly 化する前に呼び出す。
- [ ] Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y を CodeMirror コマンドへ渡し、セル textarea のブラウザー履歴と二重適用しない。入力はセル編集単位でまとめ、行列操作は isolateHistory で前後と分離する。
- [ ] readOnly 時は textarea.readOnly、操作ボタン.disabled、イベントハンドラー内の state.readOnly チェックを併用する。
- [ ] composition、Undo/Redo、2表、外部本文更新、readOnly 化の統合テストを通し、`feat: synchronize table input and editor history` をコミットする。

## Task 4: セル移動・行列操作・書式連携

**Files:** src/editor/TableWidget.ts, src/editor/tableEditingState.ts, src/editor/tableEditingUi.ts, src/editor/tableEditingUi.test.ts, src/components/MarkdownEditor.tsx, src/components/MarkdownEditor.tableEditing.test.tsx

**Consumes:** TableCellAddress、表操作関数、履歴境界。
**Produces:** 採用仕様のキーボード・メニュー操作、セルの書式コンテキスト。

- [ ] Tab 往復、末尾 Tab、Enter、Shift+Enter、Escape、日本語変換中 Enter、最後の列削除禁止を各々テストにする。
- [ ] 移動時は最新状態の表 ID とセル位置から次の対象を計算する。表の前後が文書端の場合、必要な空行の挿入を1つの履歴操作に含める。Tab で表内に閉じ込めない。
- [ ] 行列変更は入力確定後の最新モデルへ適用し、一度の dispatch にする。blur 時の古いモデルで操作を上書きしない。削除後は存在する隣接セルへフォーカスを移す。
- [ ] 列の配置変更を `<th>/<td>` と区切り行へ反映する。メニューは実 button を使い、キーボードで到達・閉じる操作を提供する。
- [ ] MarkdownEditor の applyFormat / wrapSelection はアクティブセルを優先する。対応しないブロック書式は無効化する。App の書式コンテキストもセルフォーカスを反映する。
- [ ] 全ラベル・セルの読み上げ名を日本語／英語で提供する。ヘッダーは th、通常セルは td を使う。
- [ ] 対象テスト成功後に `feat: add table navigation and structural actions` をコミットする。

## Task 5: 表とソースの切替・レイアウト

**Files:** src/editor/TableWidget.ts, src/editor/tableEditingExtension.ts, src/styles.css, src/components/MarkdownEditor.tableEditing.test.tsx

**Consumes:** 表 ID、ソース表示状態。
**Produces:** 表単位のソース切替とテーマに適応する UI。

- [ ] ソースへ切り替えて戻しても Markdown が変わらないテストを追加する。ソースを壊した場合に内容を維持してソースのままになることも確認する。
- [ ] ソース編集中も「表に戻す」操作を表範囲に付け、解析成功時のみ再表示する。対象範囲を変更に追従させる。
- [ ] live モード限定の CSS を表専用クラスへ移し、source モードで正しく表示する。長文セルは自動高さ調整し、横長の表は表内スクロールにする。
- [ ] 明暗テーマ、200% 拡大、狭い Split、長い日本語、複数行セルで操作部が欠けないことをブラウザーで確認する。
- [ ] 対象テスト成功後に `feat: add table source toggle and accessible layout` をコミットする。

## Task 6: App の保存・検索・文書遷移に統合

**Files:** src/App.tsx, src/components/MarkdownEditor.tsx, src/App.tableEditing.test.tsx, src/App.documentSessionSafety.test.tsx, src/App.outlineNavigation.test.tsx

**Consumes:** prepareTableEditing、TableEditingContext。
**Produces:** Edit/Split での既定有効化、保存・安全制御・検索との整合。

- [ ] MarkdownEditorHandle に `preparePendingEdits: () => Promise<boolean>` を追加し、内部で prepareTableEditing を呼ぶ。言語 props と表編集有効フラグを接続する。
- [ ] 保存・別名保存・終了・新規・開く・履歴から開く・ドロップの入口を調べ、共通の文書遷移入口で入力を同期してから action gate を有効化する。保存する文書は await 後に latestDocumentRef から再取得する。

```ts
// 各非同期入口で保存対象セッションの変更も検査する。
if (!(await editorRef.current?.preparePendingEdits() ?? true)) return false;
const latestDocument = latestDocumentRef.current.get();
// 既存の保存/未保存確認の処理に進む。
```

- [ ] composition 確定待機中の重複操作をまとめ、待機対象文書が変わったら古い操作を中止する。Preview 切替やエディター破棄も同じ同期を経由する。
- [ ] 次の観測結果を App テストで確認する: blur なしの Ctrl+S で最新文字列を writeTextFile に渡す／別名保存ダイアログの前に同期／未保存確認キャンセルでセル入力を維持／変換確定前には書込・文書遷移せず確定後に1回だけ実行／復旧データに最新確定入力を含む。
- [ ] selectRange で表内または表をまたぐ選択が要求された場合、対象表をソース表示にして選択を可視化する。検索とアウトライン移動の既存挙動を確認する。
- [ ] 既存 Edit/Split/Preview のレイアウトを維持して表 extension を有効にする。表以外の本文編集が変わらない回帰テストを通す。
- [ ] 対象テスト成功後に `feat: integrate table editing with document lifecycle` をコミットする。

## Task 7: 実機検証・ヘルプ・完了判定

**Files:** src/components/HelpDialog.tsx, src/components/HelpDialog.test.tsx, 上記テスト、本文書末尾の検証記録

- [ ] 初回範囲の操作と、セル内では Markdown 記法を入力すること、表ソースへ戻せることをヘルプに追記する。
- [ ] `npm test` と `npm run build` を実行する。build が生成する build-info 等の差分を確認し、意図しない生成物を機能コミットへ含めない。
- [ ] 実ブラウザーと Windows の Tauri / WebView2 で下表を確認する。jsdom の合成 composition イベントだけで日本語 IME 対応を完了扱いにしない。
- [ ] 50表を含む文書と200行×10列の表で、入力中のフォーカス維持と反応を測る。基準 PC を記録し、IME を除く入力処理の p95 50ms 以下を初期目標とする。未達なら全文再解析と DOM 再生成を先に調べる。
- [ ] 機能差分をレビューし、保存欠落・誤った範囲更新・入力消失・readOnly 迂回が残っていれば完了にしない。結果を本文書へ記録し、`docs: document direct table editing and verification` をコミットする。

| 受け入れケース | 合格条件 |
| --- | --- |
| ユーザーの1列表、太字、br の連続 | 表として編集でき、内容が再保存・再読込で保たれる |
| 見出し後、2個以上の表 | 正しい表だけが更新され、移動先が別表にならない |
| フェンス内・引用内・リスト内の表らしい文字列 | 初回対象外の内容を変換・破損しない |
| 日本語変換→Enter→Ctrl+S | 変換確定と行追加が混ざらず、保存後の読込内容が一致 |
| セル編集→Undo→Redo→行列操作→Undo | 操作対象と履歴の単位が一貫する |
| 未保存で新規／終了、キャンセル | 最新入力を確認対象に含め、キャンセル後も維持する |
| セル中で Ctrl+B、本文に戻って Ctrl+B | 各々の選択に作用し、古い本文選択を誤編集しない |
| 読み取り専用と文書安全 UI | セル・行列操作から変更できない |
| ソース切替・検索・表をまたぐ選択 | 操作対象が見え、内容と選択が一致する |
| 再編集を10回繰り返す | パイプ・バックスラッシュ・br・リンクが増殖／欠落しない |
| 長文・横長・200%拡大・明暗 | セルと操作メニューが利用できる |

## 進め方と見積もり

依存順: **1 → 2 → 3 → 4 → 5 → 6 → 7**。3までで入力と文書同期の技術確認、6までで利用経路の完成、7でリリース可能性を判断する。

当初の **8〜13実働日** は人間1名が1日8時間作業する場合の工数目安（64〜104時間）であり、24時間×日数でも、Codex の実行時間の予測でもない。実装後は下記の実施結果と残作業で進捗を判断する。

最初の完成条件は「見た目が表になる」ではなく、**表を直接編集し、その内容を失わず保存・取り消し・文書切替できること**。非編集中セルの装飾表示と複数セル貼り付けは、この基盤の受け入れ後に別の計画で扱う。

## 計画セルフレビュー

- 位置不整合・1列対応・往復保持 → Task 1。
- 表だけの有効化・コード内誤認識・複数表・DOM 安定性 → Task 2。
- 最新入力・IME・Undo・readOnly → Task 3、6。
- セル移動・行列・配置・書式誤適用防止 → Task 4。
- ソースへ戻る操作・レイアウト → Task 5。
- 保存・復旧・文書遷移・検索 → Task 6。
- 実機と大きな表・ヘルプ・全体回帰 → Task 7。
- 初回の装飾表示を対象外として明記し、Obsidian と同等の全機能対応を約束していない。

## 検証記録

2026-09-10: 計画のみ作成。アプリケーション変更、計画記載の新規テスト実行、実機検証は実装フェーズで行う。既存コードの調査・再現検証の結果と、今後実装する仕様を上記で区別した。

### 承認後の実装記録（2026-09-10）

- [x] Task 1: 1列表、文書全体の範囲、CRLF、エスケープ、内容保持、古い範囲の拒否を実装。
- [x] Tasks 2〜5: 表専用 extension、安定したセル DOM、即時同期、変換中の確定待機、Undo/Redo、行列・配置操作、本文への移動、ソース切替と検索選択を実装。
- [x] Task 6: 保存・別名保存・文書遷移・表示切替・復旧との連携を実装。
- [x] Task 7 のヘルプ、ブラウザー操作、性能計測、コードレビューを実施。
- [ ] Windows Tauri / WebView2 の実際の日本語 IME で、変換→Enter→Ctrl+S と保存後の再読込を確認。合成 composition テストは実機確認の代用にしない。

実装上の変更: 密結合の extension/runtime/widget は一緒にコミットし、予定した一部のテストファイルは extension および App のテストに集約した。区切り線を持たない行の端セルを空にするときは、表を壊さないため外側のパイプを補う。セル内容の太字などは今回も Markdown 記法で入力する。

実 Chromium で1列・複数表の表示と入力、Tab、明暗テーマ、200%拡大時のセルと操作メニューを確認。基準 PC は AMD Ryzen 7 8845HS / Windows。200行×10列（見出しを加えて2010セル）で30回入力した際の p95 は22ms、50表の文書では3.6ms。どちらも本文の更新と同じセルへのフォーカス維持を確認した。50表のうち測定時に DOM に存在したのは表示範囲の5表。数値は当該環境・入力条件での観測値であり、実機 IME の性能保証ではない。

レビューではソース境界のマッピング、端の空セル、キーボードによる操作メニューへの到達、行追加を Undo した際のフォーカスを修正し、回帰テストを追加した。ブラウザー検証の画像は作業ツリーの `output/playwright/` に保存。

最終検証: `npm test` は48ファイル・360テスト成功。`npm run build`（TypeScript と Vite）成功。Vite の大きなチャンクに関する警告は残る。生成された `src/buildInfo.ts` は復元し、機能差分から除外した。文書を開いた直後の遅延 autofocus がセルを離れてしまう問題も修正し、遅延後のセル内 Bold と本文に戻った後の書式操作を App テストで確認した。実装・自動検証は終了、リリース判断に必要な実機 IME 検証は上記のとおり未完了。
