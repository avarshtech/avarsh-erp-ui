# Export documents: browser ⇄ server parity harness

The export-document rules (`src/utils/expDoc*.js`) are being ported to the API
(`erp-purchase`, package `com.avarsh.erp.exportdoc.rules`), and so is the
packing-list assembly (`src/services/expdoc/expDocPl{Blocks,Plan,Assemble}.js`,
`src/utils/orderSizes.js`, the standard layouts of `src/utils/expDocSystemTemplates.js`;
package `com.avarsh.erp.exportdoc.packinglist`). The port must answer exactly as the
browser does, so the browser is the reference:

1. A `*.dump.js` file here lists calls of one module — `{ id, fn, args }` — and
   `writeFixtures.js` runs them and writes `{ id, fn, args, output }` (or
   `throws`) to `erp-purchase/src/test/resources/expdoc-parity/<module>.json`.
2. The API's `*ParityTest` classes replay every case against the Java port and
   compare the result with `output` (`ParityFixtures` holds the rules).

Regenerate the fixtures (the API repo must be checked out beside this one):

```
npx vitest run --config scripts/expdoc-parity/vitest.config.js
```

The fixtures are committed in the **API** repo, next to the tests that read them.

## Keeping the fixtures current

Nothing reruns the dumps on its own, so a change to a rule would leave the Java
tests passing on fixtures the browser no longer agrees with. **After any change
to `src/utils/expDoc*.js`, `src/utils/orderSizes.js`,
`src/services/expdoc/expDocPl*.js` or to a dump here**, run:

```
npm run parity:check
```

It writes every fixture again into a temporary directory (`PARITY_OUT`) and
compares each with the API repo's copy, ignoring line endings (git on Windows
checks them out with CRLF). It exits 0 when they all match and otherwise lists
each file that differs, that no dump writes any more, or that the API repo lacks,
and exits 1; it also fails, saying so, when the API repo is not beside this one
or a dump fails. When it differs:

1. regenerate: `npx vitest run --config scripts/expdoc-parity/vitest.config.js`;
2. in `erp-purchase`, re-run the parity tests:
   `./gradlew test --rerun --tests "*ParityTest"`, and fix the port where the
   browser's new answers show it diverges;
3. commit both repos together.

`PARITY_OUT=<dir>` in the environment sends the dumps' files to that directory
instead of the API repo, for any run.

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
| `hashes.dump.js` | `expDocHashes.json` | `ContentHashesParityTest` |
| `validation.dump.js` | `expDocValidation.json` | `ValidationParityTest` |
| `plBlocks.dump.js` | `expDocPlBlocks.json` | step 3 (pending) |
| `orderSizes.dump.js` | `orderSizes.json` | step 3 (pending) |
| `systemTemplates.dump.js` | `expDocSystemTemplates.json` | step 3 (pending) |

Writing cases:

- `fn` is the imported function itself; pass `{ api, notPorted }` so a new export
  without a case fails the dump. `notPorted` names an export the server does not
  take over, with the reason (`{ invoiceFxStatus: 'screen wording …' }`).
- Args and outputs are JSON. What JSON cannot hold is written as a **sentinel**,
  an object whose only key is `$js`: `{"$js":"undefined"}`, `{"$js":"NaN"}`,
  `{"$js":"Infinity"}`, `{"$js":"-Infinity"}`, wherever the value sits (an
  object's undefined key stays visible). Data with a `$js` key of its own fails
  the dump, so nothing real reads as a sentinel. `-0` is written as `0`
  (`JSON.stringify(-0)` is `"0"`), so the Java test treats `-0` and `0` as equal.
  The browser runs on the args decoded from the very JSON the fixture holds.
- Use `argsJson` (JSON text, written verbatim) when the key order of the input
  matters: the browser re-orders integer-like keys (`"104"`) to the front when it
  parses JSON; the server's Jackson keeps the text's order.
- A case that should throw says `throws: true`; the fixture records the error as
  `"<name>: <message>"`. An error of JavaScript's own types (`TypeError`,
  `RangeError` …) carries the engine's wording, so the Java port only has to
  throw. A rule that rejects input on purpose throws `new Error(text)`, and the
  port must throw with that text as its message, word for word.
- An argument left off is the browser's default parameter, and the Java test calls
  the overload without it; an argument given as `null` stays `null` (a default does
  not apply), so a case can pin what the browser does with a `null`.
- Keep the data fixed (no `dayjs()`, no fiscal-year labels): a fixture must not
  change when nothing in the rules did.

## How the Java side compares

`ParityFixtures` binds each case's arguments to the port's parameter types
**before** it calls the port: a case whose arguments do not bind fails, also when
the browser throws, so only the port can answer a `throws` case. Then:

- Numbers must be the same double — no tolerance. The port performs the
  browser's IEEE 754 operations in the browser's order, so the results are bit
  for bit the browser's; only `-0` and `0` count as equal.
- `NaN`, `Infinity` and `-Infinity` are matched only by that double; JavaScript
  `null` only by Java `null`.
- JavaScript `undefined` (the sentinel, or a key the browser's object lacks) is
  matched by Java `null` or by no value at all (an absent key, a missing JSON
  node): a typed record holds `null` for both, and the JSON-tree ports read
  undefined as a missing node. In the arguments, an undefined key is left out of
  its object, an undefined list element is `null` and an undefined argument is a
  missing node.
- A value the port gives differently **on purpose** is pinned in its Java test as
  a `KnownDivergence`: the case, the places in the output, the browser's value,
  the port's, and why. Nothing else is excused, and a pin either side stops
  matching fails. There is one: against a buyer plan with no usable range the
  browser numbers the cartons from `-Infinity`; the port leaves them without a
  number (`null`), as a carton number is an integer there and the browser's own
  save writes `null` (`PlNumberingParityTest`).

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
- **A Symbol** is written as a marker no real value can be: `plBlocks.dump.js`
  writes `ELSEWHERE` (a range's PO is not on this shipment) as `{"elsewhere": true}`
  where a function returns it or takes it, because a PO key is text or null.
- **A Map whose keys may be null, or whose order counts,** is written as its
  entries in order (`unitsOfEntry` gives `[{ key, groups }]`): an object would make
  a null key the text `"null"`, and the Java side compares objects in any key order.
  A Map keyed by text alone is written as an object (`takenBy`, `planRangesOf`).
- **A function that writes onto its argument** and returns it records what it
  writes: the `assemble` adapter returns the list's `blockOrder`, `sections`,
  `orderNos` and `sizes`. Where the argument holds nothing else, the export is
  called as it is (`applyPlan` is given a list of `plans` only).
- **A dependency no recorded function calls** may be stubbed to keep a slow import
  chain out of the run, saying so in the dump: `plBlocks.dump.js` stubs the packing
  mirror (`vi.mock`), whose axios and antd imports take some 25 s; `blocksOf`, the
  one export that reads it, is `notPorted`.

## What JSON cannot carry to the server

The server reads request JSON with Jackson into typed records, which cannot tell
some things apart that JavaScript can. Leave such inputs out of the cases, and say
so where it matters:

- `undefined` and `null`: a key left out and a key set to `null` both bind to
  `null` in a typed record (`Number(undefined)` is `NaN` but `Number(null)` is
  `0`). Only a part the server keeps as JSON (a template, a namespace) sees the
  difference, as a missing key.
- A number typed as text: Jackson reads `"1042"` as `1042`, so the arithmetic and
  the keying agree, but where the browser **echoes** the value it gives back
  `"1042"` and the server `1042` (an invoice atom's carton numbers, a terms row).
- The empty string read as a number: Jackson gives `null`, the browser `Number('')`,
  which is `0`.
