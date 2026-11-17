# Export documents: browser ⇄ server parity harness

The export-document rules (`src/utils/expDoc*.js`) are being ported to the API
(`erp-purchase`, package `com.avarsh.erp.exportdoc.rules`). The port must answer
exactly as the browser does, so the browser is the reference:

1. A `*.dump.js` file here lists calls of one module — `{ id, fn, args }` — and
   `writeFixtures.js` runs them and writes `{ id, fn, args, output }` (or
   `throws`) to `erp-purchase/src/test/resources/expdoc-parity/<module>.json`.
2. The API's `*ParityTest` classes replay every case against the Java port and
   compare the result with `output`.

Regenerate the fixtures (the API repo must be checked out beside this one):

```
npx vitest run --config scripts/expdoc-parity/vitest.config.js
```

The fixtures are committed in the **API** repo, next to the tests that read them.
Regenerate them whenever a ported module changes, and commit both repos together.

Writing cases:

- `fn` is the imported function itself; pass `{ api, notPorted }` so a new export
  without a case fails the dump.
- Outputs are plain JSON: `undefined`, `NaN` and `±Infinity` are written as `null`.
- Use `argsJson` (JSON text, written verbatim) when the key order of the input
  matters: the browser re-orders integer-like keys (`"104"`) to the front when it
  parses JSON; the server's Jackson keeps the text's order.
- A case that should throw says `throws: true`.
- Keep the data fixed (no `dayjs()`, no fiscal-year labels): a fixture must not
  change when nothing in the rules did.
