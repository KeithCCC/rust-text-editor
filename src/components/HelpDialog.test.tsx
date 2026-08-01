import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HelpDialog, handleHelpDialogKeyDown } from "./HelpDialog";

describe("HelpDialog", () => {
  it("renders beginner help in Japanese", () => {
    const html = renderToStaticMarkup(
      <HelpDialog language="ja" onClose={() => undefined} />,
    );

    expect(html).toContain('class="help-identity"');
    expect(html).toContain('src="/koharu-release-icon.png"');
    expect(html).toContain('alt="Koharuの花のアイコン"');
    expect(html).toContain('<strong class="help-identity-name">Koharu</strong>');
    expect(html).toContain(
      '<p class="help-identity-introduction">Markdown文書を書いて保存するための、基本的な使い方です。</p>',
    );

    expect(html).toContain("Koharuの使い方");
    expect(html).toContain("ファイルを作る・開く・保存する");
    expect(html).toContain("Markdownの書き方");
    expect(html).toContain("文字");
    expect(html).toContain("ブロック");
    expect(html).toContain("挿入");
    expect(html).toContain("文中コード");
    expect(html).toContain("コードブロック");
    expect(html).toContain("チェックリスト");
    expect(html).toContain("表");
    expect(html).toContain("図（Mermaid）");
    expect(html).toContain("**太字**");
    expect(html).toContain("`コード`");
    expect(html).toContain("- [ ] タスク");
    expect(html).toContain("```javascript\nconsole.log(&quot;こんにちは&quot;);\n```");
    expect(html).toContain("| 見出し 1 | 見出し 2 |");
    expect(html).toContain('class="help-code-example"');
    expect(html).toContain("```mermaid\nflowchart LR\n  A[Start] --&gt; B[Finish]\n```");
    expect(html).toContain("Ctrl+S");
    expect(html).toContain("プレビューを切り替える");
    expect(html).toContain("Ctrl/Cmd+Alt+M");
    expect(html).not.toContain("Ctrl+Shift+V");
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Koharuの使い方を閉じる"');
  });

  it("renders beginner help in English", () => {
    const html = renderToStaticMarkup(
      <HelpDialog language="en" onClose={() => undefined} />,
    );

    expect(html).toContain('class="help-identity"');
    expect(html).toContain('src="/koharu-release-icon.png"');
    expect(html).toContain('alt="Koharu flower icon"');
    expect(html).toContain('<strong class="help-identity-name">Koharu</strong>');
    expect(html).toContain(
      '<p class="help-identity-introduction">The essentials for writing and saving a Markdown document.</p>',
    );

    expect(html).toContain("How to use Koharu");
    expect(html).toContain("Create, open, and save files");
    expect(html).toContain("Markdown basics");
    expect(html).toContain("Text");
    expect(html).toContain("Block");
    expect(html).toContain("Insert");
    expect(html).toContain("Inline code");
    expect(html).toContain("Code block");
    expect(html).toContain("Task list");
    expect(html).toContain("Table");
    expect(html).toContain("Mermaid diagram");
    expect(html).toContain("**Bold**");
    expect(html).toContain("`code`");
    expect(html).toContain("- [ ] Task");
    expect(html).toContain("```javascript\nconsole.log(&quot;Hello&quot;);\n```");
    expect(html).toContain("| Heading 1 | Heading 2 |");
    expect(html).toContain('class="help-code-example"');
    expect(html).toContain("```mermaid\nflowchart LR\n  A[Start] --&gt; B[Finish]\n```");
    expect(html).toContain("Ctrl+F");
    expect(html).toContain("Cycle Edit, Split, and Preview");
    expect(html).toContain("Ctrl/Cmd+Alt+M");
    expect(html).not.toContain("Ctrl+Shift+V");
    expect(html).toContain("Close How to use Koharu");
  });

  it("closes only for Escape", () => {
    const onClose = vi.fn();

    handleHelpDialogKeyDown({ key: "Enter" }, onClose);
    expect(onClose).not.toHaveBeenCalled();

    handleHelpDialogKeyDown({ key: "Escape" }, onClose);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
