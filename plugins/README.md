# MarkupEditor Plugins

This document describes what a MarkupEditor plugin is and how to create one. The document is intended for developers and references the foundational libraries the MarkupEditor is built on. 

A plugin is a JavaScript module that the MarkupEditor loads when it opens. Every plugin has a string `name` and `type`. The `type` can either be “exporter” or “codeview”:

* An **Exporter** can be invoked from the File->Export menu and let you transform the document into a form other than Markdown.

  * The editor supports HTML and PDF export at installation.

* A **CodeView** displays the contents of a code block based on the language in that code block.

  * The editor supports Mermaid diagrams at installation.

## Plugin API

Besides its name and type properties, a plugin exposes its run method that can be invoked from Swift using MU.runPlugin(name).

## Reference Plugins

The DocX Exporter and the Mermaid diagram CodeView are provided as fully supported examples you can use to model your own plugins on.

DocX Exporter

Mermaid Diagrams

## Testing

A plugin's test suite lives entirely inside its own directory and runs via `npm test`
(vitest) — no Xcode, no changes to MarkupEditorApp. `markupeditor-exporter-docx` establishes
the pattern in three tiers; only the third reaches outside the plugin's own directory.

**1. Converter unit tests.** Hand-crafted HTML snippets fed directly into your own
HTML-to-format conversion function, decoded with your own format's decode helper, asserted
structurally. No mocking needed. See `markupeditor-exporter-docx/test/htmlToDocx.test.js`.

**2. Full-pipeline test.** Mock the base package so `run()` can be called standalone:

```js
vi.mock('markupeditor', () => ({
  MU: { getHTML: (...args) => getHTML(...args), registerPlugin: (...args) => registerPlugin(...args) },
}))
```

Call your plugin's exported `run()`, decode the result, assert. See
`markupeditor-exporter-docx/test/docxexporter.test.js`.

**3. Real-document fidelity test (optional).** Drives `run()` from HTML produced by the real
markdown-import pipeline (`markupeditor-app`'s `importMarkdown`) instead of a hand-authored
snippet, so the test proves your exporter matches what the real app actually produces. See
`markupeditor-exporter-docx/test/test-exporter-fidelity.test.js` and its
`test/helpers/renderTestDocument.js` harness.

For tier 3:

* Alias the `markupeditor` specifier (`resolve.alias` in `vitest.config.js`) to
  `MarkupEditor/Resources/markup-editor.js` — the exact bundle the real app loads at runtime —
  rather than letting it resolve to whichever package's own `node_modules/markupeditor` copy
  happens to be installed nearby, which can drift out of sync with what's actually shipped. The
  alias applies across the whole module graph, so your `import { MU } from 'markupeditor'` and
  `markupeditor-app/src/markdown.js`'s own `import { MU } from "markupeditor"` resolve to the
  SAME module instance — stubbing `MU.activeView()` (so `importMarkdown` can run without a live
  editor view) actually takes effect on the copy `importMarkdown` reads from. See
  `markupeditor-exporter-docx/vitest.config.js`.
* Don't `vi.mock('markupeditor', ...)` in a test file that also uses this alias-backed `MU` —
  Vitest mocks by resolved path, so a mock would replace the module for the whole graph
  reachable from that test file, including `markdown.js`'s own import, losing `MU.schema`. If
  your plugin's own `run()` also needs `MU` (e.g. `MU.getHTML()`), monkey-patch that property
  directly on the same real `MU` object instead — see
  `markupeditor-exporter-docx/test/test-exporter-fidelity.test.js`.
* Loading the real `markupeditor` bundle needs a real DOM (`jsdom`) plus two small shims for
  gaps in `jsdom`'s own CSSOM support (`CSSStyleSheet.replaceSync`, `CSSStyleSheet.media`). See
  `markupeditor-exporter-docx/test/vitest.setup.js`.
* Real image loading (`Image`/`canvas`) hangs indefinitely in this environment — mock
  `resolveImages` (or your format's equivalent) wholesale rather than trying to make it work;
  image-loading fidelity itself is out of scope for this kind of test and is verified manually.

## package.json Metadata

Every plugin's `package.json` must include a `markupeditor` object describing it for discovery:

```json
{
  "name": "markupeditor-codeview-mermaid",
  "main": "dist/markupeditor-codeview-mermaid.js",
  "description": "MarkupEditor codeview plugin for Mermaid diagrams.",
  "author": "Your Name <you@example.com>",
  "version": "1.0.0",
  "markupeditor": {
    "name": "Mermaid",
    "type": "codeview"
  }
}
```

Fields:

* `name` — the plugin's display name. Must match the `name` passed to `MU.registerPlugin(...)` in the plugin's source exactly. That call is the runtime source of truth; `package.json` only mirrors it, and nothing checks the two stay in sync automatically, so keep them matching by hand.
* `type` — `"exporter"` or `"codeview"`. Must also match the `type` passed to `MU.registerPlugin(...)`.
* `ext` — required for `type: "exporter"` only, omitted for `"codeview"`. The file extension the exporter produces, bare with no leading dot (`"docx"`, not `".docx"`).

An exporter's `markupeditor` object also needs `ext`:

```json
"markupeditor": {
  "name": "DocX",
  "type": "exporter",
  "ext": "docx"
}
```

The top-level `package.json` fields `main`, `description`, `author`, and `version` are also required as plain strings.

The directory the plugin lives in under `plugins/` must equal `package.json`'s top-level `name` field. A mismatch fails the generator described below.

## Publishing plugins.json

After merging a plugin PR, the maintainer regenerates the discovery manifest and commits it:

```bash
node plugins/generate-plugins-json.mjs
git add plugins/plugins.json
git commit -m "Update plugins.json"
```

The generator reads every `plugins/<dir>/package.json`, validates each one against the rules above, and writes `plugins/plugins.json`. It fails loudly — refusing to write anything — if any plugin's metadata is missing or malformed, naming the offending directory.