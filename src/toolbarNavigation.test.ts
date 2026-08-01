import { expect, it } from "vitest";
import { nextToolbarIndex } from "./toolbarNavigation";

it("wraps roving focus and supports Home and End", () => {
  expect(nextToolbarIndex(0, 5, "ArrowLeft")).toBe(4);
  expect(nextToolbarIndex(4, 5, "ArrowRight")).toBe(0);
  expect(nextToolbarIndex(2, 5, "Home")).toBe(0);
  expect(nextToolbarIndex(2, 5, "End")).toBe(4);
});

it("keeps an empty toolbar at its only safe index", () => {
  expect(nextToolbarIndex(3, 0, "ArrowRight")).toBe(0);
});
