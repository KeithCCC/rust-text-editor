# drive-drop Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ローカルファイルをGoogle Driveの固定「0.Drop」フォルダーへ新規アップロードまたは同名更新できる、移行可能な `drive-drop` スキルを作成する。

**Architecture:** スキル本体はGoogle Driveプラグインのフォルダー一覧、アップロード、更新、メタデータ取得を順番に呼ぶ手順だけを保持し、外部スクリプトを持たない。ソース一式はプロジェクトの `exports/drive-drop-skill-transfer/drive-drop` で作成・検証し、持ち運び用ZIPを生成した後、ユーザーのCodexスキル領域へ同じ構造で配置する。

**Tech Stack:** Codex Skills、Google Driveプラグイン、Markdown、YAML、ZIP。

## Global Constraints

- ユーザー向けスキル名と表示名は `drive-drop` / `Drive Drop` とする。
- コピー先はフォルダーID `1SXLAoogVFkayYuzCeVibuL4YjyGu6Z2D` の `0.Drop` に固定する。
- 元ファイルをGoogle Workspace形式へ変換しない。
- 同名なしは新規アップロード、同名1件は同じDrive IDの内容更新、同名複数はユーザー確認とする。
- 削除、共有設定変更、別名ファイル変更、親フォルダー変更を行わない。
- 書き込み後は必ずDriveメタデータを読み戻して検証する。

---

### Task 1: スキル作成ルールと名前の検証

**Files:**
- Read: `C:/Users/chien/.codex/skills/.system/skill-creator/SKILL.md`
- Read: `C:/Users/chien/.codex/plugins/cache/openai-curated-remote/superpowers/6.1.1/skills/writing-skills/SKILL.md`

**Interfaces:**
- Consumes: 設計上の名前 `drive-drop`
- Produces: Codexが受け付けるスキル名、必須ファイル、検証コマンド

- [ ] **Step 1: skill-creatorを最後まで読む**

Run: `Get-Content -LiteralPath 'C:\Users\chien\.codex\skills\.system\skill-creator\SKILL.md' -Raw`

Expected: skill naming, scaffold, validation, packaging instructions are available.

- [ ] **Step 2: writing-skillsを最後まで読む**

Run: `Get-Content -LiteralPath 'C:\Users\chien\.codex\plugins\cache\openai-curated-remote\superpowers\6.1.1\skills\writing-skills\SKILL.md' -Raw`

Expected: test-first and skill-quality requirements are available.

- [ ] **Step 3: `drive-drop`が名前規則に合うことを確認する**

小文字とハイフンだけで構成された `drive-drop` が命名規則に合うことを確認し、Task 2へ進む。

### Task 2: スキル本体と表示設定

**Files:**
- Create: `exports/drive-drop-skill-transfer/drive-drop/SKILL.md`
- Create: `exports/drive-drop-skill-transfer/drive-drop/agents/openai.yaml`

**Interfaces:**
- Consumes: ローカルファイルの絶対パス1件以上、Google Driveプラグイン
- Produces: 新規アップロードまたは同名Driveファイル更新、検証済みリンク一覧

- [ ] **Step 1: 失敗ケースを先に確認する**

検証ツールを未作成パスへ実行し、スキルが存在しないため失敗することを確認する。

Run: `python C:/Users/chien/.codex/skills/.system/skill-creator/scripts/quick_validate.py exports/drive-drop-skill-transfer/drive-drop`

Expected: FAIL because the skill directory does not exist.

- [ ] **Step 2: SKILL.mdを作成する**

フロントマターに正規名と、ローカルファイルを固定の0.Dropへコピーする時に発火するdescriptionを記載する。本文には次を明記する。

```text
1. Google Driveスキルを読み、Google Driveプラグインだけを使用する。
2. 入力されたローカルパスの存在を確認する。
3. 固定URLのフォルダーをlist_folderで読み、アクセスとフォルダー名を確認する。
4. フォルダー直下で完全一致するファイル名を数える。
5. 0件はupload_file、1件はupdate_file(file_uri=...)、複数件は停止して確認する。
6. get_file_metadataでid,name,mimeType,size,parents,webViewLink,modifiedTimeを読み戻す。
7. 新規・更新、ファイル名、サイズ、リンクを報告する。
```

- [ ] **Step 3: agents/openai.yamlを作成する**

```yaml
interface:
  display_name: "Drive Drop"
  short_description: "Copy files to Google Drive 0.Drop safely"
  default_prompt: "Use $drive-drop to copy the specified local files to my Google Drive 0.Drop folder."
```

- [ ] **Step 4: スキル構造を検証する**

Run: `python C:/Users/chien/.codex/skills/.system/skill-creator/scripts/quick_validate.py exports/drive-drop-skill-transfer/drive-drop`

Expected: PASS.

### Task 3: READMEと持ち運び用ZIP

**Files:**
- Create: `exports/drive-drop-skill-transfer/README.md`
- Create: `exports/drive-drop-skill-transfer/drive-drop-skill.zip`

**Interfaces:**
- Consumes: 検証済み `drive-drop` フォルダー
- Produces: 別PCへ配置できるZIPとインストール説明

- [ ] **Step 1: README.mdを作成する**

READMEにはファイル構成、Google Driveプラグイン要件、Windowsの `%USERPROFILE%\.codex\skills\drive-drop`、macOS/Linuxの `~/.codex/skills/drive-drop`、`$drive-drop`呼び出し例、固定0.Dropフォルダー、同名更新ルールを記載する。

- [ ] **Step 2: ZIPを作成する**

Run: `tar.exe -a -c -f exports/drive-drop-skill-transfer/drive-drop-skill.zip -C exports/drive-drop-skill-transfer drive-drop`

Expected: ZIP root contains `drive-drop/`.

- [ ] **Step 3: ZIP内容を確認する**

Run: `tar.exe -t -f exports/drive-drop-skill-transfer/drive-drop-skill.zip`

Expected entries:

```text
drive-drop/
drive-drop/SKILL.md
drive-drop/agents/openai.yaml
```

### Task 4: ローカルインストールと最終確認

**Files:**
- Create: `C:/Users/chien/.codex/skills/drive-drop/SKILL.md`
- Create: `C:/Users/chien/.codex/skills/drive-drop/agents/openai.yaml`

**Interfaces:**
- Consumes: 検証済みエクスポート版
- Produces: 次回タスクから利用可能なローカルスキル

- [ ] **Step 1: エクスポート版をスキル領域へコピーする**

Run: `Copy-Item -LiteralPath 'exports\drive-drop-skill-transfer\drive-drop' -Destination 'C:\Users\chien\.codex\skills\drive-drop' -Recurse`

Expected: destination contains `SKILL.md` and `agents/openai.yaml`.

- [ ] **Step 2: インストール済みスキルを再検証する**

Run: `python C:/Users/chien/.codex/skills/.system/skill-creator/scripts/quick_validate.py C:/Users/chien/.codex/skills/drive-drop`

Expected: PASS.

- [ ] **Step 3: 固定ID、更新ルール、ZIPハッシュを確認する**

Run: `rg -n "1SXLAoogVFkayYuzCeVibuL4YjyGu6Z2D|update_file|multiple|複数" exports/drive-drop-skill-transfer/drive-drop/SKILL.md`

Run: `Get-FileHash -LiteralPath 'exports\drive-drop-skill-transfer\drive-drop-skill.zip' -Algorithm SHA256`

Expected: fixed ID and duplicate handling are present; SHA-256 is returned.

- [ ] **Step 4: プロジェクト内の設計・計画だけをコミットする**

生成した個人用スキルと配布物は `exports/` に置き、既存のwrap-up配布物とともに未追跡のまま維持する。計画書のみをGitへ記録する。

```powershell
git add docs/superpowers/plans/2026-07-17-drive-drop-skill.md
git commit -m "docs: plan drive drop skill implementation"
```
