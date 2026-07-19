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
    expect(html).toContain("Ctrl+S");
    expect(html).toContain("プレビューを切り替える");
    expect(html).toContain("Ctrl+Shift+V");
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
    expect(html).toContain("Ctrl+F");
    expect(html).toContain("Toggle preview");
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
