# Koharu and Hotaru

Koharu is the recommended app for regular users. It is a focused, single-file Markdown editor built as a Tauri desktop application with a React and TypeScript frontend.

Koharu is the application being prepared for Microsoft Store publication under the Daily AI Lab brand.

Hotaru is the more experimental line of this project. It explores vault-style note management, backlinks, tags, wiki links, and other knowledge-base workflows. Some Hotaru-era backend code and naming still exists in the repository, but the current packaged app is Koharu.

## Which One Should I Use?

Use **Koharu** if you want a reliable everyday Markdown editor for opening, editing, previewing, and saving normal text files.

Use **Hotaru** if you are interested in experimental notebook or vault workflows and are comfortable with features that may change, move, or live outside the main Koharu release.

## Koharu Features

- Single-file Markdown editing with CodeMirror.
- Open, save, Save As, drag-and-drop open, and startup file support.
- Edit, Split, and Preview view modes for writing and checking the rendered result.
- GitHub-flavored Markdown preview support.
- Mermaid diagram rendering in preview and exported HTML.
- `.excalidraw` image links that can open an Excalidraw editor.
- Wiki-link style `[[note]]` rendering in preview.
- In-editor search with keyboard shortcuts.
- A formatting toolbar for text, block, and insert actions, including tables and Mermaid diagrams.
- Remembered formatting-toolbar visibility and the current file path in the bottom status bar.
- Light, dark, and system themes.
- English and Japanese UI switching.
- File properties dialog.
- Standalone HTML export.
- Desktop packaging through Tauri.

## Basic Usage

1. Choose **File > New** to create a document, or **File > Open** to open an existing Markdown or text file.
2. Use **Edit** for writing, **Split** to see the editor and rendered result together, or **Preview** to see only the rendered result.
3. Use the control in the editor header to show or hide the formatting toolbar. Koharu remembers this choice. The current file path is shown in the bottom status bar; hover it to see the full path when it is truncated.
4. Choose **Search > Find** or press `Ctrl+F` to search the document. If you start from Preview, Koharu automatically switches to Split and focuses the visible search field.

## Hotaru Direction

Hotaru is intended for broader Markdown knowledge-work experiments, including:

- Vault folders.
- Note creation, duplication, rename, and delete flows.
- Tags from frontmatter and inline `#tags`.
- Wiki links and backlinks.
- Vault-wide Markdown search.
- More opinionated notebook behavior.

These ideas are useful, but they make the product more complex. That is why Koharu is recommended for regular users and Hotaru is treated as experimental.

## Development

Install dependencies:

```bash
npm install
```

Run the frontend development server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Build the frontend:

```bash
npm run build
```

Build the desktop app with Tauri:

```bash
npm run tauri -- build
```

## Project Structure

- `src/` - React and TypeScript frontend.
- `src/components/` - Editor, preview, command palette, Mermaid, Excalidraw, and JSON UI components.
- `src-tauri/` - Tauri and Rust desktop backend.
- `asset/` - Source artwork for Koharu and Hotaru.
- `docs/work-log.md` - Development history and validation notes.
- `scripts/` - Build helper scripts.

## Notes

The repository has moved from the original Hotaru direction toward Koharu as the stable everyday editor. Hotaru remains an important experimental sibling, but users who simply want to write and edit Markdown should start with Koharu.

---

# Koharu と Hotaru

Koharu は、一般ユーザーにおすすめするアプリです。Tauri デスクトップアプリとして作られた、単一ファイル向けのシンプルな Markdown エディタです。フロントエンドには React と TypeScript を使っています。

Hotaru は、このプロジェクトのより実験的なラインです。Vault 形式のノート管理、バックリンク、タグ、Wiki リンクなど、ナレッジベース寄りのワークフローを試すためのものです。リポジトリ内には Hotaru 時代のバックエンドコードや名前が一部残っていますが、現在のパッケージ対象アプリは Koharu です。

## どちらを使うべき？

通常のテキストファイルや Markdown ファイルを開き、編集し、プレビューし、保存したい場合は **Koharu** を使ってください。

Vault やノートブック的な使い方、実験的なナレッジ管理機能に興味があり、機能変更や移動があっても問題ない場合は **Hotaru** を試す選択肢があります。

## Koharu の機能

- CodeMirror による単一ファイル Markdown 編集。
- 開く、保存、名前を付けて保存、ドラッグ＆ドロップで開く、起動時ファイル指定に対応。
- 編集・分割・プレビューの3つの表示モード。
- GitHub Flavored Markdown のプレビュー対応。
- プレビューと HTML エクスポートでの Mermaid 図表表示。
- `.excalidraw` 画像リンクから Excalidraw エディタを開く機能。
- `[[note]]` 形式の Wiki リンク表示。
- キーボードショートカット付きのエディタ内検索。
- 文字・ブロック・挿入の操作をまとめた書式ツールバー。表やMermaid図にも対応。
- 記憶される書式ツールバーの表示設定と、画面下部のステータスバーに表示されるファイルパス。
- ライト、ダーク、システムテーマ。
- 英語 UI と日本語 UI の切り替え。
- ファイル情報ダイアログ。
- 単体で開ける HTML エクスポート。
- Tauri によるデスクトップアプリのパッケージング。

## 基本的な使い方

1. **「ファイル」→「新規」**で文書を作るか、**「ファイル」→「開く」**で既存のMarkdownファイルまたはテキストファイルを開きます。
2. 文章を書くときは**編集**、編集画面と仕上がりを並べるときは**分割**、仕上がりだけを見るときは**プレビュー**を選びます。
3. エディターヘッダーのボタンで書式ツールバーの表示・非表示を切り替えられます。この設定は次回も引き継がれます。現在のファイルパスは画面下部のステータスバーに表示され、省略されている場合はマウスを重ねると完全なパスを確認できます。
4. **「検索」→「検索」**を選ぶか`Ctrl+F`を押すと、文書内を検索できます。プレビューから検索した場合は自動的に分割表示へ切り替わり、見える検索欄にフォーカスします。

## Hotaru の方向性

Hotaru は、より広い Markdown ナレッジワークの実験を目的としています。

- Vault フォルダ。
- ノート作成、複製、リネーム、削除。
- frontmatter と本文中の `#tags` からのタグ抽出。
- Wiki リンクとバックリンク。
- Vault 全体の Markdown 検索。
- よりノートブック寄りの動作。

これらのアイデアは便利ですが、プロダクトを複雑にします。そのため、通常利用には Koharu をおすすめし、Hotaru は実験的な位置づけにしています。

## 開発

依存関係をインストール:

```bash
npm install
```

フロントエンド開発サーバーを起動:

```bash
npm run dev
```

テストを実行:

```bash
npm test
```

フロントエンドをビルド:

```bash
npm run build
```

Tauri でデスクトップアプリをビルド:

```bash
npm run tauri -- build
```

## プロジェクト構成

- `src/` - React と TypeScript のフロントエンド。
- `src/components/` - エディタ、プレビュー、コマンドパレット、Mermaid、Excalidraw、JSON 表示コンポーネント。
- `src-tauri/` - Tauri と Rust のデスクトップバックエンド。
- `asset/` - Koharu と Hotaru の元アートワーク。
- `docs/work-log.md` - 開発履歴と検証メモ。
- `scripts/` - ビルド補助スクリプト。

## メモ

このリポジトリは、もともとの Hotaru の方向性から、安定した日常用エディタである Koharu へ軸足を移しています。Hotaru は重要な実験的兄弟プロジェクトとして残りますが、単に Markdown を書いて編集したいユーザーは Koharu から始めるのがおすすめです。
