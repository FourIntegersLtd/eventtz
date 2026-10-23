# Design diff: building a screen from the canvas, and proving it

The approved screens live in the Design canvas (artifact `6YVz7xAD3JNDTevF7S1SZT`) and are
checked in as plain files under `web/design/canvas/project/`: one `.dc.html` per artboard and
`eventtz.css`, the stylesheet every artboard shares. `app/globals.css` imports that stylesheet,
so every `ez-` class and `--ez-` token the artboards use already exists in the app.

A screen is therefore a transcription, not an interpretation.

## Building a screen

1. Open the artboard file, for example `design/canvas/project/P01-Login.dc.html`. The markup
   inside `<x-dc>` is the screen. The `Design notes` callout at the bottom is the spec (other
   states, components used); it is never built.
2. Copy the markup into the page or feature component keeping every `ez-` class and every
   inline `style` as written. Replace sample copy with props and data; replace `/_blob/<id>`
   images with files in `public/` (and map the id in `screens.json` under `assets`).
3. Do not restyle with Tailwind utilities, do not "improve" spacing, do not rewrite copy.
   If a class is missing from `eventtz.css`, the canvas is wrong: fix it there first.
4. Add the screen to `screens.json`: its artboard, route, size (`$preview` in the artboard),
   any `setup` steps the live page needs to reach the drawn state, elements to strip from
   either side (`artboardRemove`, `pageRemove`), and `probes` pairing artboard and page
   selectors for the elements that matter.
5. Run the diff (below) and paste its output in the report. A screen is done when it prints
   `PASS`. "Looks right" is not a result.

## Running the diff

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
cd api && make db-up && make migrate && make dev   # :8001
cd web && npm run dev                              # leave running on :3001
```

Vendor screens re-seed the compose DB before each run (see
``api/scripts/seed_design_diff_vendor.py`` and ``vendor-fixture.json``). Sign-in uses
``design-diff-vendor@example.com`` / ``Design-Diff-Passw0rd!`` from ``screens.json``.

If sign-in fails with “Too many attempts”, flush compose Redis: ``docker exec eventtz-api-redis-1 redis-cli FLUSHDB``.

```bash
npm run design:diff -- P01-Login         # one screen
npm run design:diff -- V06-StepPortfolio
npm run design:diff -- --all             # every screen in screens.json
```

Output for each screen, in `design/diff-output/` (git-ignored):

- `<id>.artboard.png`, `<id>.page.png`, `<id>.diff.png`: the two renders and the diff image.
- `<id>.json`: mismatch ratio, the most mismatched regions as bounding boxes, and every
  geometry probe that differs (position, size, font, colour, padding, radius).

Exit code is 1 when a screen is over its pixel budget or a **layout** probe fails.

| Screen kind | Pixel budget | Geometry |
|-------------|--------------|----------|
| Auth/marketing (`P*`, etc.) | 0.5% | All probe properties within 2px |
| Vendor (`V*`, `auth: vendor`) | **2.5%** | Missing elements, or box **x/y** off by more than **32px** (not height/width) |

Vendor screens are checked for **visual** match (same structure, copy, and controls), not
identical padding, font stack, or anti-aliasing. Cosmetic probe deltas are listed in
`geometryCosmetic` in the JSON report but do not fail the run.

Override per screen with `maxDiffRatio` or `geometryLayoutOnly: false` in `screens.json`.

## Reading a failure

- A **geometry** finding (not cosmetic) names a missing element or a badly misplaced block: fix that first.
- A region at the bottom of the page with nothing else usually means the page is a different
  height (an extra block, a missing block, or a different `min-height`).
- Uniform low-level noise across text with no geometry findings is font anti-aliasing;
  that is what the budget is for. Do not chase it.
- `unmapped assets` means an uploaded image in the artboard has no local file yet.
