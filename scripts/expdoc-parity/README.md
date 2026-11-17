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

| Dump | Fixture | Java test |
| --- | --- | --- |
| `calc.dump.js` | `expDocCalc.json` | `CartonCalcParityTest` |
| `poKeys.dump.js` | `expDocPoKeys.json` | `PoKeysParityTest` |
| `numbering.dump.js` | `expDocPlNumbering.json` | `PlNumberingParityTest` |
| `planMatch.dump.js` | `expDocPlanMatch.json` | `PlanMatchParityTest` |
| `localeCompare.dump.js` | `jsLocaleCompare.json` | `JsCollationParityTest` |
| `localeCompareNumeric.dump.js` | `jsLocaleCompareNumeric.json` | `JsCollationParityTest` |
| `invoiceCalc.dump.js` | `expDocInvoiceCalc.json` | `InvoiceCalcParityTest` |
| `invoiceTerms.dump.js` | `expDocInvoiceTerms.json` | `InvoiceTermsParityTest` |

Writing cases:

- `fn` is the imported function itself; pass `{ api, notPorted }` so a new export
  without a case fails the dump. `notPorted` names an export the server does not
  take over, with the reason (`{ invoiceFxStatus: 'screen wording …' }`).
- Outputs are plain JSON: `undefined`, `NaN` and `±Infinity` are written as `null`.
- Use `argsJson` (JSON text, written verbatim) when the key order of the input
  matters: the browser re-orders integer-like keys (`"104"`) to the front when it
  parses JSON; the server's Jackson keeps the text's order.
- A case that should throw says `throws: true`.
- An argument left off is the browser's default parameter, and the Java test calls
  the overload without it; an argument given as `null` stays `null` (a default does
  not apply), so a case can pin what the browser does with a `null`.
- Keep the data fixed (no `dayjs()`, no fiscal-year labels): a fixture must not
  change when nothing in the rules did.

## Functions, Maps and constants: named adapters

A fixture is JSON, so it cannot hold a function or a Map, and a constant is not a
call. The dump declares a **named adapter** instead: a function with the export's
own name that takes plain data, builds the real argument, and calls the real
export. It is swapped into the `api` object the dump passes to `writeFixtures`
(`const API = { ...module, printedRows }`), so the fixture records the export's
name, the coverage check still sees every export, and `api[name] === fn` holds.
The Java test builds the same argument from the same data before calling the port.
Say in the dump's header, and in the Java test's Javadoc, what each name means.

- **A Map argument** is written as an object and made a Map again:
  `numbering.dump.js` turns `plans` back into `new Map(Object.entries(plans))`;
  `invoiceTerms.dump.js` passes the order terms to `hsCodeOfOrder` and makes its
  Map with the real `termsByOrder`, because the Map's keys are numbers.
- **A function argument** is named, and the adapter builds it: `planMatch.dump.js`
  passes an id prefix and builds the counter; `invoiceCalc.dump.js` names colour
  matchers (`'default'`, `'colourKey'`) and the line callbacks
  (`rateFor: { breakdown, options }`, `hsCodeFor: { orderTerms }`,
  `garmentNameFor: 'row'`, …). An option left out stays out, so the browser's
  default applies.
- **A function result** is called in the adapter: `makeRateResolver` returns a
  resolver, so its adapter takes the groups to resolve as one more argument and
  records what the resolver and its `rateOnly` answer for each.
- **A constant** (`DEFAULT_GROUP_BY`, `GROUPABLE_KEYS`, `CUSTOMS_RATE_STALE_DAYS`)
  is recorded by an adapter of its name that returns it (a Set as an array).
- **A browser built-in** the rules lean on gets an adapter of its own and a fixture
  without `api`: `localeCompareRows` and `localeCompareNumericRows` compare every
  string of a family with every other.

## What JSON cannot carry to the server

The server reads the same JSON with Jackson, which cannot tell some things apart
that JavaScript can. Leave such inputs out of the cases, and say so where it
matters:

- `undefined` and `null`: a key left out and a key set to `null` both arrive as
  `null` (`Number(undefined)` is `NaN` but `Number(null)` is `0`).
- A number typed as text: Jackson reads `"1042"` as `1042`, so the arithmetic and
  the keying agree, but where the browser **echoes** the value it gives back
  `"1042"` and the server `1042` (an invoice atom's carton numbers, a terms row).
- The empty string read as a number: Jackson gives `null`, the browser `Number('')`,
  which is `0`.
