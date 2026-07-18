import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { DecisionDialog } from "./DecisionDialog";

describe("DecisionDialog", () => {
  test("renders a named modal and explicit decisions", () => {
    const html = renderToStaticMarkup(
      <DecisionDialog
        title="Save changes?"
        message="notes.md has unsaved changes."
        actions={[
          { id: "save", label: "Save", emphasis: "primary" },
          { id: "discard", label: "Don't Save", emphasis: "danger" },
          { id: "cancel", label: "Cancel" },
        ]}
        cancelId="cancel"
        onDecision={() => undefined}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Save changes?");
    expect(html).toContain("Don&#x27;t Save");
  });
});
