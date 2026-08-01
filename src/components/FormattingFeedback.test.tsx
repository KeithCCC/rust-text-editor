// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getFormattingUi } from "../formattingUi";
import {
  nextFormattingAnnouncement,
  type FormattingAnnouncement,
} from "../formattingGuidance";
import { FormattingFeedback } from "./FormattingFeedback";

let container: HTMLDivElement;
let root: Root;

function Harness() {
  const [announcement, setAnnouncement] = useState<FormattingAnnouncement>({ id: 0, message: "" });
  const messages = getFormattingUi("en").feedback;
  return (
    <>
      <button
        type="button"
        onClick={() => setAnnouncement((current) => nextFormattingAnnouncement(
          current,
          { feedback: "tableInserted" },
          messages,
        ))}
      >
        Announce table
      </button>
      <FormattingFeedback announcement={announcement} />
    </>
  );
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("FormattingFeedback", () => {
  it("replaces the live-region announcement node for repeated identical feedback", () => {
    act(() => root.render(<Harness />));
    const button = container.querySelector("button");
    if (!button) throw new Error("Announcement button not found");

    act(() => button.click());
    const first = container.querySelector<HTMLElement>("[data-formatting-announcement]");
    expect(first?.dataset.formattingAnnouncement).toBe("1");
    expect(first?.textContent).toBe("Table inserted. Edit the first column heading.");

    act(() => button.click());
    const second = container.querySelector<HTMLElement>("[data-formatting-announcement]");
    expect(second?.dataset.formattingAnnouncement).toBe("2");
    expect(second).not.toBe(first);
    expect(second?.textContent).toBe(first?.textContent);
  });
});
