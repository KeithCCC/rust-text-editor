# Drive Drop Skill

`drive-drop` は、指定したローカルファイルを Google Drive の固定フォルダー `0.Drop` へコピーする Codex スキルです。

## 内容

- `drive-drop/` — インストールするスキル本体
- `drive-drop-skill.zip` — 別のPCへ持っていくためのZIP

## インストール

ZIPを展開し、`drive-drop` フォルダーを次の場所へコピーします。

- Windows: `%USERPROFILE%\.codex\skills\drive-drop`
- macOS / Linux: `~/.codex/skills/drive-drop`

コピー後、Codexを再起動するか新しいタスクを開いてください。

## 必要な準備

Google Drive プラグインをインストールし、対象のGoogleアカウントへ接続しておきます。

固定の保存先:

- フォルダー名: `0.Drop`
- URL: <https://drive.google.com/drive/folders/1SXLAoogVFkayYuzCeVibuL4YjyGu6Z2D>

## 使い方

Codexで次のように依頼します。

```text
$drive-drop C:\Users\me\Desktop\report.pdf をコピーして
```

複数ファイルも指定できます。

```text
$drive-drop report.pdf と notes.md を 0.Drop にコピーして
```

## 動作

- 同名ファイルがない場合は新しくアップロードします。
- 同名ファイルが1件ある場合は、リンクとファイルIDを維持したまま内容を更新します。
- 同名ファイルが複数ある場合は自動変更せず、どれを更新するか確認します。
- 元のファイル形式を維持し、Googleドキュメント形式へ変換しません。
- 削除、共有設定の変更、別フォルダーへの移動は行いません。
