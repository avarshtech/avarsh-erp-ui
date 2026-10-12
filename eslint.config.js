import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// ── The UI standard's lint rules (production-readiness plan, Appendix A) ─────────────────────────
// Every rule below is an error. The violations that existed when a rule arrived are recorded in
// eslint-suppressions.json (`npx eslint . --suppress-rule <rule>`), so only new code has to
// comply. When you fix a suppressed one, run `npm run lint:prune` in the same commit.

// antd 6.2.2 props that are deprecated, one component-scoped selector each:
// [components, prop, replacement]. A component is `Name` or `Parent.Child`; aliases such as
// `const { TextArea } = Input` are listed by their local name. The list is the one in
// .claude/skills/erp-dev/references/antd6-deprecations.md plus the few that node_modules/antd/es
// warns about and that file misses (Input's addons, Tabs indicatorSize, Breadcrumb routes,
// ConfigProvider autoInsertSpaceInButton, Image preview class names). Re-derive both on every
// antd upgrade.
const SELECT_FAMILY = ['Select', 'TreeSelect', 'Cascader', 'AutoComplete']
const PICKERS = ['DatePicker', 'DatePicker.RangePicker', 'RangePicker', 'TimePicker', 'TimePicker.RangePicker']
const INPUTS = ['Input', 'Input.Password', 'Input.Search']
const TEXT_AREAS = ['Input.TextArea', 'TextArea']
const OVERLAYS = ['Tooltip', 'Popover', 'Popconfirm']

const ANTD_DEPRECATED_PROPS = [
  [['Alert'], 'message', 'title'],
  [['Alert'], 'closeText', 'closable={{ closeIcon }}'],
  [['Space', 'Space.Compact'], 'direction', 'orientation'],
  [['Space'], 'split', 'separator'],
  [['Steps'], 'direction', 'orientation'],
  [['Steps'], 'labelPlacement', 'titlePlacement'],
  [['Steps'], 'progressDot', 'type="dot"'],
  [['Timeline'], 'pending', 'a pending node in items'],
  [['Timeline'], 'pendingDot', 'a pending node in items'],
  [['Drawer'], 'width', 'size'],
  [['Drawer'], 'height', 'size'],
  [['Drawer'], 'destroyOnClose', 'destroyOnHidden'],
  [['Drawer'], 'destroyInactivePanel', 'destroyOnHidden'],
  [['Drawer'], 'headerStyle', 'styles={{ header }}'],
  [['Drawer'], 'bodyStyle', 'styles={{ body }}'],
  [['Drawer'], 'footerStyle', 'styles={{ footer }}'],
  [['Drawer'], 'contentWrapperStyle', 'styles={{ wrapper }}'],
  [['Drawer'], 'maskStyle', 'styles={{ mask }}'],
  [['Drawer'], 'drawerStyle', 'styles={{ section }}'],
  [['Modal'], 'destroyOnClose', 'destroyOnHidden'],
  [['Modal'], 'autoFocusButton', 'focusable={{ autoFocusButton }}'],
  [['Modal'], 'focusTriggerAfterClose', 'focusable={{ focusTriggerAfterClose }}'],
  [['Modal'], 'bodyStyle', 'styles={{ body }}'],
  [['Modal'], 'maskStyle', 'styles={{ mask }}'],
  [['Tabs'], 'tabPosition', 'tabPlacement'],
  [['Tabs'], 'destroyInactiveTabPane', 'destroyOnHidden'],
  [['Tabs'], 'popupClassName', 'classNames={{ popup }}'],
  [['Tabs'], 'indicatorSize', 'indicator={{ size }}'],
  [['Collapse'], 'destroyInactivePanel', 'destroyOnHidden'],
  [['Collapse'], 'expandIconPosition', 'expandIconPlacement'],
  [['Collapse.Panel'], 'disabled', 'collapsible="disabled"'],
  [['Button'], 'iconPosition', 'iconPlacement'],
  [['Divider'], 'type', 'orientation'],
  [['Divider'], 'orientationMargin', 'styles={{ content: { margin } }}'],
  [['Carousel'], 'dotPosition', 'dotPlacement'],
  [['Splitter'], 'layout', 'orientation'],
  [['FloatButton'], 'description', 'content'],
  [['Progress'], 'width', 'size'],
  [['Progress'], 'strokeWidth', 'size'],
  [['Progress'], 'trailColor', 'railColor'],
  [['Progress'], 'gapPosition', 'gapPlacement'],
  [['Card', 'Select', 'TreeSelect', 'Cascader'], 'bordered', 'variant'],
  [PICKERS, 'bordered', 'variant'],
  [['InputNumber', ...INPUTS, ...TEXT_AREAS], 'bordered', 'variant'],
  // antd 6.2.2 warns for these on Input as well as InputNumber (input/Input.js), although the
  // reference file calls Input's addons valid.
  [['InputNumber', ...INPUTS], 'addonBefore', 'prefix, or a Space.Compact group'],
  [['InputNumber', ...INPUTS], 'addonAfter', 'suffix, or a Space.Compact group'],
  [['TimePicker'], 'addon', 'renderExtraFooter'],
  [['Slider'], 'tipFormatter', 'tooltip={{ formatter }}'],
  [['Slider'], 'tooltipPlacement', 'tooltip={{ placement }}'],
  [['Slider'], 'tooltipVisible', 'tooltip={{ open }}'],
  [['Slider'], 'tooltipPrefixCls', 'tooltip={{ prefixCls }}'],
  [['Slider'], 'getTooltipPopupContainer', 'tooltip={{ getPopupContainer }}'],
  [['Avatar.Group'], 'maxCount', 'max={{ count }}'],
  [['Avatar.Group'], 'maxStyle', 'max={{ style }}'],
  [['Avatar.Group'], 'maxPopoverPlacement', 'max={{ popover }}'],
  [['Avatar.Group'], 'maxPopoverTrigger', 'max={{ popover }}'],
  [['Calendar'], 'dateCellRender', 'cellRender'],
  [['Calendar'], 'monthCellRender', 'cellRender'],
  [['Calendar'], 'dateFullCellRender', 'fullCellRender'],
  [['Calendar'], 'monthFullCellRender', 'fullCellRender'],
  [['Transfer'], 'operations', 'actions'],
  [['Transfer'], 'listStyle', 'styles={{ section }}'],
  [['Transfer'], 'operationStyle', 'styles={{ actions }}'],
  [['ConfigProvider'], 'dropdownMatchSelectWidth', 'popupMatchSelectWidth'],
  [['ConfigProvider'], 'autoInsertSpaceInButton', 'button={{ autoInsertSpace }}'],
  [['Breadcrumb'], 'routes', 'items'],
  [[...SELECT_FAMILY, 'Dropdown'], 'dropdownRender', 'popupRender'],
  [SELECT_FAMILY, 'onDropdownVisibleChange', 'onOpenChange'],
  [SELECT_FAMILY, 'onPopupVisibleChange', 'onOpenChange'],
  [['Select', 'TreeSelect', 'AutoComplete'], 'dropdownMatchSelectWidth', 'popupMatchSelectWidth'],
  [[...SELECT_FAMILY, ...PICKERS], 'dropdownClassName', 'classNames={{ popup: { root } }}'],
  [['Select', 'TreeSelect', 'AutoComplete', ...PICKERS], 'popupClassName', 'classNames={{ popup: { root } }}'],
  [SELECT_FAMILY, 'dropdownStyle', 'styles={{ popup: { root } }}'],
  [PICKERS, 'popupStyle', 'styles={{ popup: { root } }}'],
  [['Cascader'], 'dropdownMenuColumnStyle', 'popupMenuColumnStyle'],
  [['Select', 'TreeSelect', 'Cascader'], 'showArrow', 'suffixIcon={null} to hide the arrow'],
  [SELECT_FAMILY, 'clearIcon', 'allowClear={{ clearIcon }}'],
  [['AutoComplete'], 'dataSource', 'options'],
  [PICKERS, 'onSelect', 'onCalendarChange'],
  [['Statistic'], 'valueStyle', 'styles={{ content }}'],
  [['Descriptions'], 'labelStyle', 'styles={{ label }}'],
  [['Descriptions'], 'contentStyle', 'styles={{ content }}'],
  [['Card'], 'headStyle', 'styles={{ header }}'],
  [['Card'], 'bodyStyle', 'styles={{ body }}'],
  [OVERLAYS, 'overlayStyle', 'styles={{ root }}'],
  [OVERLAYS, 'overlayInnerStyle', 'styles={{ container }}'],
  [OVERLAYS, 'overlayClassName', 'classNames={{ root }}'],
  [OVERLAYS, 'destroyTooltipOnHide', 'destroyOnHidden'],
  [['Dropdown'], 'overlayStyle', 'styles={{ root }}'],
  [['Dropdown'], 'overlayClassName', 'classNames={{ root }}'],
  [['Dropdown'], 'destroyPopupOnHide', 'destroyOnHidden'],
  [['Empty'], 'imageStyle', 'styles={{ image }}'],
  [['Image'], 'wrapperStyle', 'styles={{ root }}'],
]

// The antd component a local alias stands for, e.g. `const { TextArea } = Input`.
const ALIAS_OF = { RangePicker: 'DatePicker.RangePicker', TextArea: 'Input.TextArea', TabPane: 'Tabs.TabPane' }
// `JSXOpeningElement` for any of the given components, only in files that import the component
// from antd: a local component that shares the name (GpoActionBar has its own small `List`) is
// not antd's.
const element = (names) => {
  const forms = names.map((name) => {
    const [object, property] = name.split('.')
    const tag = property ? `[name.object.name='${object}'][name.property.name='${property}']` : `[name.name='${object}']`
    const antdExport = (ALIAS_OF[name] ?? name).split('.')[0]
    return `Program:has(ImportDeclaration[source.value='antd'] ImportSpecifier[local.name='${antdExport}']) JSXOpeningElement${tag}`
  })
  return forms.length === 1 ? forms[0] : `:matches(${forms.join(', ')})`
}
// How a component list reads in a message, with each alias folded into the component it names.
const label = (names) => [...new Set(names.map((name) => ALIAS_OF[name] ?? name))].join(' / ')
const deprecated = (what, replacement) => `${what} is deprecated in antd 6: use ${replacement}.`
// A literal attribute value, written either as `prop="x"` or as `prop={'x'}`.
const valueMatches = (regex) => `:matches([value.value=${regex}], [value.expression.value=${regex}])`
// An object property inside an inline `prop={...}` value, e.g. one entry of `items={[...]}`.
const inlineProperty = (names, prop, key) =>
  `${element(names)} > JSXAttribute[name.name='${prop}'] ObjectExpression > Property[key.name='${key}']`

const ANTD_DEPRECATIONS = [
  ...ANTD_DEPRECATED_PROPS.map(([names, prop, replacement]) => ({
    selector: `${element(names)} > JSXAttribute[name.name='${prop}']`,
    message: deprecated(`${label(names)} \`${prop}\``, `\`${replacement}\``),
  })),
  // Values that warn
  {
    selector: `${element(['Tag'])} > JSXAttribute[name.name='bordered'][value.expression.value=false]`,
    message: deprecated('Tag `bordered={false}`', '`variant="filled"`'),
  },
  {
    selector: `${element(['Tag'])} > JSXAttribute[name.name='color']${valueMatches('/-inverse$/')}`,
    message: deprecated('Tag `color="*-inverse"`', '`variant="solid"` with the plain colour'),
  },
  {
    selector: `${element(['Timeline'])} > JSXAttribute[name.name='mode']${valueMatches('/^(left|right)$/')}`,
    message: deprecated('Timeline `mode="left|right"`', '`mode="start|end"`'),
  },
  {
    selector: `${element(['Divider'])} > JSXAttribute[name.name='orientation']${valueMatches('/^(left|right|center|start|end)$/')}`,
    message: 'In antd 6, Divider `orientation` means horizontal or vertical, and a placement value warns: use `titlePlacement="start|center|end"`.',
  },
  {
    selector: `${element(['Dropdown'])} > JSXAttribute[name.name='placement']${valueMatches('/Center$/')}`,
    message: deprecated('Dropdown `placement="…Center"`', 'the placement without `Center` (`bottom`, `top`)'),
  },
  // Keys inside items, preview, pagination, column and rowSelection objects
  { selector: inlineProperty(['Steps'], 'items', 'description'), message: deprecated('Steps `items[].description`', '`items[].content`') },
  { selector: inlineProperty(['Timeline'], 'items', 'label'), message: deprecated('Timeline `items[].label`', '`items[].title`') },
  { selector: inlineProperty(['Timeline'], 'items', 'children'), message: deprecated('Timeline `items[].children`', '`items[].content`') },
  { selector: inlineProperty(['Timeline'], 'items', 'dot'), message: deprecated('Timeline `items[].dot`', '`items[].icon`') },
  { selector: inlineProperty(['Timeline'], 'items', 'position'), message: deprecated('Timeline `items[].position`', '`items[].placement`') },
  { selector: inlineProperty(['Image', 'Image.PreviewGroup'], 'preview', 'visible'), message: deprecated('Image `preview.visible`', '`preview.open`') },
  { selector: inlineProperty(['Image', 'Image.PreviewGroup'], 'preview', 'onVisibleChange'), message: deprecated('Image `preview.onVisibleChange`', '`preview.onOpenChange`') },
  { selector: inlineProperty(['Image', 'Image.PreviewGroup'], 'preview', 'toolbarRender'), message: deprecated('Image `preview.toolbarRender`', '`preview.actionsRender`') },
  { selector: inlineProperty(['Image', 'Image.PreviewGroup'], 'preview', 'maskClassName'), message: deprecated('Image `preview.maskClassName`', '`preview.classNames.cover`') },
  { selector: inlineProperty(['Image', 'Image.PreviewGroup'], 'preview', 'rootClassName'), message: deprecated('Image `preview.rootClassName`', '`preview.classNames.root`') },
  { selector: inlineProperty(['Table'], 'pagination', 'position'), message: deprecated('Table `pagination.position`', '`pagination.placement`') },
  // Column and rowSelection objects are usually built outside the JSX; these keys are antd's own.
  { selector: "Property[key.name='filterDropdownOpen']", message: deprecated('Table column `filterDropdownOpen`', '`filterDropdownProps: { open }`') },
  { selector: "Property[key.name='onFilterDropdownOpenChange']", message: deprecated('Table column `onFilterDropdownOpenChange`', '`filterDropdownProps: { onOpenChange }`') },
  { selector: "Property[key.name=/^onSelect(All|Invert|None|Multiple)$/]", message: deprecated('Table `rowSelection.onSelectAll / onSelectInvert / onSelectNone / onSelectMultiple`', '`rowSelection.onChange`') },
  // notification.open / success / info / warning / error config
  {
    selector: "CallExpression[callee.object.name='notification'][callee.property.name=/^(open|success|info|warning|error)$/] > ObjectExpression > Property[key.name='message']",
    message: deprecated('notification `message`', '`title`'),
  },
  {
    selector: "CallExpression[callee.object.name='notification'][callee.property.name=/^(open|success|info|warning|error)$/] > ObjectExpression > Property[key.name='btn']",
    message: deprecated('notification `btn`', '`actions`'),
  },
  // Components replaced outright
  { selector: element(['Input.Group']), message: deprecated('`Input.Group`', '`Space.Compact`') },
  { selector: element(['Button.Group']), message: deprecated('`Button.Group`', '`Space.Compact`') },
  { selector: element(['Dropdown.Button']), message: deprecated('`Dropdown.Button`', '`Space.Compact` with a `Dropdown` and a `Button`') },
  { selector: element(['Statistic.Countdown']), message: deprecated('`Statistic.Countdown`', '`Statistic.Timer type="countdown"`') },
  { selector: element(['BackTop']), message: deprecated('`BackTop`', '`FloatButton.BackTop`') },
  { selector: element(['Tabs.TabPane', 'TabPane']), message: deprecated('`Tabs.TabPane`', 'the Tabs `items` prop') },
  { selector: element(['Timeline.Item']), message: deprecated('`Timeline.Item`', 'the Timeline `items` prop') },
  { selector: element(['Breadcrumb.Item', 'Breadcrumb.Separator']), message: deprecated('`Breadcrumb.Item`', 'the Breadcrumb `items` prop') },
  { selector: element(['Mentions.Option']), message: deprecated('`Mentions.Option`', 'the Mentions `options` prop') },
  { selector: element(['Anchor.Link']), message: deprecated('`Anchor.Link` children', 'the Anchor `items` prop') },
  { selector: element(['Menu.Item', 'Menu.SubMenu', 'Menu.ItemGroup', 'Menu.Divider']), message: deprecated('`Menu.Item` children', 'the Menu `items` prop') },
  { selector: element(['Descriptions.Item']), message: deprecated('`Descriptions.Item` children', 'the Descriptions `items` prop') },
  { selector: element(['Collapse.Panel']), message: deprecated('`Collapse.Panel` children', 'the Collapse `items` prop') },
  { selector: element(['Select.Option', 'Select.OptGroup']), message: deprecated('`Select.Option`', 'the Select `options` prop') },
  { selector: element(['List']), message: 'antd 6 deprecates `List` and will remove it: use plain `ul`/`li` markup or a `Table`.' },
]

// One selector per pattern so a file can be exempted from exactly one of them.
const DANGEROUS_HTML = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message: 'Raw HTML is rendered only by components/RichTextEditor.jsx, after utils/sanitizeRichText.js. Render text as children instead.',
}
const DOCUMENT_WRITE = {
  selector: "CallExpression[callee.property.name=/^write(ln)?$/]:matches([callee.object.name='document'], [callee.object.property.name='document'])",
  message: 'Print windows are written only by openPrintWindow in utils/printDoc.js; build the HTML with its esc()/escAttr() helpers.',
}
const DOM_QUERY = 'CallExpression[callee.property.name=/^(querySelector|querySelectorAll|closest|matches)$/]'
const ANT_CLASS_QUERY = "antd's internal .ant-* classes change between antd versions; do not query them. Use a ref, or a className of your own."
const RESTRICTED_SYNTAX = [
  DANGEROUS_HTML,
  DOCUMENT_WRITE,
  {
    selector: "CallExpression[callee.property.name=/^(slice|substring|substr)$/][callee.object.callee.property.name='toISOString'][arguments.0.value=0][arguments.1.value=10]",
    message: "toISOString() is UTC, so before 05:30 IST it gives yesterday's date. Use dayjs().format('YYYY-MM-DD') for today and for date-only values.",
  },
  {
    selector: "MemberExpression[computed=true][property.value=0][object.callee.property.name='split'][object.callee.object.callee.property.name='toISOString']",
    message: "toISOString() is UTC, so before 05:30 IST it gives yesterday's date. Use dayjs().format('YYYY-MM-DD') for today and for date-only values.",
  },
  {
    selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/][arguments.length=0]",
    message: 'Without a locale this follows the browser. Format numbers and money with utils/formatters.js (en-IN) and dates with dayjs.',
  },
  {
    selector: `${DOM_QUERY} > Literal[value=/\\.ant-/]`,
    message: ANT_CLASS_QUERY,
  },
  {
    selector: `${DOM_QUERY} > TemplateLiteral > TemplateElement[value.raw=/\\.ant-/]`,
    message: ANT_CLASS_QUERY,
  },
  ...ANTD_DEPRECATIONS,
]
const restrictedSyntaxWithout = (exempt) => ['error', ...RESTRICTED_SYNTAX.filter((entry) => entry !== exempt)]

export default defineConfig([
  // Build output, test reports, local tool state and the git-ignored docs folder. `.kilo` and
  // `.claude/worktrees` hold other sessions' worktrees (full copies of src), which `eslint .` would
  // otherwise lint again, without the src-scoped plugins, and fail.
  globalIgnores(['dist', 'coverage', 'e2e-report', 'test-results', 'playwright-report', 'blob-report', '.kilo', '.claude/worktrees', '.playwright-mcp', 'docs']),
  {
    // Build/tooling config runs in Node, not the browser
    files: ['vite.config.js', 'eslint.config.js', 'playwright.config.js', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: globals.node,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
  },
  {
    // Playwright specs and fixtures run in Node, and read process.env for
    // the base URL and credentials.
    files: ['e2e/**/*.{js,mjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
  },
  {
    // React's rules apply to the app only. In e2e/, Playwright fixtures receive a `use` callback,
    // which react-hooks' rules-of-hooks would read as a hook call.
    files: ['src/**/*.{js,jsx}'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        // Injected at build time by vite.config.js `define`
        __APP_VERSION__: 'readonly',
        __BUILD_ID__: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]',
        // `(_, index) => ...` and other placeholders that exist only to reach a later argument
        argsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        // `const { id, createdAt, ...rest } = dto` is how payloads are stripped here;
        // the named keys are meant to be dropped, not read.
        ignoreRestSiblings: true,
      }],
    },
  },
  {
    // Language rules for every JavaScript file (standard rules 29 and 36).
    files: ['**/*.{js,jsx,mjs}'],
    rules: {
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    // App rules (standard rules 7, 9, 24, 30, 31, 32 and 36).
    files: ['src/**/*.{js,jsx}'],
    rules: {
      'no-console': 'error',
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'antd',
          importNames: ['message', 'notification'],
          message: 'Use the hook: `const { message, notification } = App.useApp()`. The static functions ignore the theme and the app context.',
        }],
      }],
      'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX],
    },
  },
  {
    // The one place raw HTML is rendered, after sanitizeRichText.
    files: ['src/components/RichTextEditor.jsx'],
    rules: { 'no-restricted-syntax': restrictedSyntaxWithout(DANGEROUS_HTML) },
  },
  {
    // The one place a print window is written.
    files: ['src/utils/printDoc.js'],
    rules: { 'no-restricted-syntax': restrictedSyntaxWithout(DOCUMENT_WRITE) },
  },
  {
    // The planned logger (standard rule 30) is where console calls belong.
    files: ['src/utils/logger.js'],
    rules: { 'no-console': 'off' },
  },
])
