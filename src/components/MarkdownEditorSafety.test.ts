import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { expect, test } from "vitest";
import { editorEditableExtension } from "./MarkdownEditor";

test("editorEditableExtension makes the editor non-editable while safety UI is active", () => {
  const state = EditorState.create({
    extensions: [editorEditableExtension(true)],
  });

  expect(state.facet(EditorView.editable)).toBe(false);
});
