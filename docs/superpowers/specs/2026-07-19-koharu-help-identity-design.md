# Koharu Help Identity Design

**Date:** 2026-07-19

## Goal

Make Koharu visually recognizable inside the Help dialog by presenting the release flower artwork as a large, centered identity hero before the instructional content.

## Asset

- Use `asset/releaseicon.png` as the canonical source artwork.
- Copy the artwork into `public/` under a stable, product-specific filename so Vite serves it in development and includes it in packaged builds.
- Do not alter, crop, recolor, or regenerate the source artwork.

## Help Dialog Layout

Add an identity hero directly below the Help dialog toolbar and above the existing help sections.

The hero contains, in order:

1. The Koharu flower artwork, centered.
2. A visible `Koharu` identity heading.
3. The existing localized Help introduction.

The artwork is 160 by 160 pixels on normal desktop layouts and 120 by 120 pixels when the viewport is at most 700 pixels wide. It uses `object-fit: contain` so the full square artwork remains visible. The hero must not change the order or wording of the existing help sections, Markdown examples, shortcuts, or close controls.

## Responsive Behavior

- Center the hero at all supported widths.
- Reduce the artwork to 120 by 120 pixels when the viewport is at most 700 pixels wide.
- Allow the Help body to retain its existing scrolling behavior when vertical space is limited.
- Do not introduce horizontal scrolling.

## Accessibility and Localization

- Provide localized alternative text: `Koharu flower icon` in English and `Koharuの花のアイコン` in Japanese.
- Keep `Koharu` visible as text so product identity does not depend on recognizing the image.
- Preserve the dialog's existing labelled-dialog semantics and keyboard behavior.

## Testing

Extend the Help dialog rendering tests to verify that both languages render:

- the stable public image path;
- the localized alternative text;
- the visible `Koharu` identity heading;
- the existing Help content and dialog semantics.

Run the focused Help dialog tests, the complete test suite, and the frontend production build. A packaged Tauri build is outside this change unless separately requested.

## Scope

This change affects only the Help dialog identity presentation and its bundled image asset. It does not redesign the app icon, toolbar, About dialog, splash screen, or other application surfaces.
