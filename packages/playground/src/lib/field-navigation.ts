import type { FieldNode, Output } from "@schema-ts/core";

/** First human-readable message from a validation output tree. */
export function firstErrorMessage(output?: Output): string | undefined {
  if (!output || output.valid) return undefined;
  if (output.errors && output.errors.length > 0) {
    return firstErrorMessage(output.errors[0]);
  }
  return output.error;
}

/** Number of nodes in the subtree that currently hold a validation error. */
export function countErrors(node: FieldNode): number {
  let count = node.error && !node.error.valid ? 1 : 0;
  for (const child of node.children ?? []) {
    count += countErrors(child);
  }
  return count;
}

/** Instance path of the first (deepest-first) field with a validation error. */
export function findFirstErrorPath(node: FieldNode): string | undefined {
  for (const child of node.children ?? []) {
    const path = findFirstErrorPath(child);
    if (path) return path;
  }
  return node.error && !node.error.valid ? node.instanceLocation : undefined;
}

/** Briefly highlight a field, e.g. after scrolling to an error. */
export function flashElement(element: HTMLElement) {
  element.classList.remove("field-flash");
  // Force a reflow so the animation restarts when triggered repeatedly.
  void element.offsetWidth;
  element.classList.add("field-flash");
  window.setTimeout(() => element.classList.remove("field-flash"), 1200);
}

/**
 * Scroll to the field registered for an instance path (widgets expose
 * `data-field-path`) and highlight it. Returns false when the field is not
 * mounted so callers can fall back to the form handle.
 */
export function scrollToFieldPath(path: string): boolean {
  const escaped =
    typeof CSS !== "undefined" && CSS.escape ? CSS.escape(path) : path;
  const element = document.querySelector<HTMLElement>(
    `[data-field-path="${escaped}"]`,
  );
  if (!element) return false;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  flashElement(element);
  element
    .querySelector<HTMLElement>("input, textarea, select, button")
    ?.focus({ preventScroll: true });
  return true;
}
