# Wrap Up Skill — 移行ガイド

このフォルダには、Codex用の `wrap-up` スキルを別のPCへ移すためのZIPファイルが入っています。

## ファイル

- `wrap-up-skill.zip` — インストール用スキル一式
- `README.md` — この移行ガイド

ZIP内には次の構成が保存されています。

```text
wrap-up/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── scripts/
    └── wrap_up.py
```

## 必要なもの

- Codex
- Python 3
- Git（Gitプロジェクトでコミットとプッシュを行う場合）

## Windowsへのインストール

1. `wrap-up-skill.zip`を展開します。
2. 展開された`wrap-up`フォルダを、次の場所へコピーします。

```text
%USERPROFILE%\.codex\skills\wrap-up
```

最終的に、次のファイルが存在する状態にします。

```text
%USERPROFILE%\.codex\skills\wrap-up\SKILL.md
```

3. Codexを再起動するか、新しいタスクを開きます。
4. 利用可能なスキルに`wrap-up`が表示されることを確認します。

## macOS・Linuxへのインストール

ZIPを展開し、`wrap-up`フォルダを次の場所へコピーします。

```text
~/.codex/skills/wrap-up
```

## 使い方

プロジェクトを開いた状態で、Codexへ次のように依頼します。

```text
$wrap-up 今日の作業をまとめて
```

または、通常の文章で次のように依頼できます。

```text
今日の作業をwrap upして
```

スキルは通常、次の処理を行います。

1. `docs/work-log/YYYY-MM-DD.md`へ作業ログを作成または更新
2. 変更内容とテスト結果をログへ整理
3. Gitプロジェクトでは変更をステージ
4. コミットを作成
5. リモートへプッシュ

## 注意

- Gitプロジェクトでは`git add .`、コミット、プッシュまで実行する設計です。
- 関係のない変更や秘密情報が作業フォルダに入っていないか、実行前に確認してください。
- プッシュ先のGitリモートと認証設定は、移行先PCで別途準備してください。
- Pythonコマンドが`python3`のみの環境では、`SKILL.md`内の実行例を環境に合わせて読み替えてください。

## 手動確認

インストール後、スクリプト単体のヘルプを確認する場合は次を実行します。

```powershell
python "$env:USERPROFILE\.codex\skills\wrap-up\scripts\wrap_up.py" --help
```

実際に作業ログを生成するときは、対象プロジェクトのルートで実行します。

```powershell
python "$env:USERPROFILE\.codex\skills\wrap-up\scripts\wrap_up.py" --date 2026-07-17
```
