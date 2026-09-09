# Ant Design 6 deprecations — the list that actually warns

Transcribed from the `warning.deprecated(...)` calls in `node_modules/antd/es/**`
at antd **6.2.2**, not from the docs, which lag behind and in places contradict
the runtime. Verified against the installed package on 2026-09-09, when a repo
sweep found 303 warning-emitting usages and cleared all of them.

## How to re-derive this list after an antd upgrade

The runtime is the source of truth. Do not trust `@deprecated` JSDoc alone — the
tags include props that never warn (`Input`'s `addonAfter`, `Modal`'s
`afterClose`), and a JSDoc block containing a code example will fool a naive
"comment above declaration" parser.

```bash
grep -rn --include=*.js "\.deprecated(" node_modules/antd/es/ | sed "s|^.*es/||"
```

Then read the array literal a few lines above each hit — most are of the form
`[['oldProp', 'newProp'], ...].forEach(...)`. Component-scope the result: `bordered`
warns on Card and Select but is perfectly valid on Table and Descriptions, and
`direction` warns on Space but not on ConfigProvider.

A component-scoped scanner and a codemod live in the audit scratchpad pattern:
parse JSX opening tags with brace/quote depth tracking so a `width` inside a
nested `style={{ }}` is never mistaken for a top-level prop.

## Traps this list exists to prevent

- **`popupClassName` is itself deprecated.** Older guidance said
  `dropdownClassName` → `popupClassName`. In 6.2.2 both warn; the target is
  `classNames.popup.root`.
- **`Drawer` `width` and `height` → `size`.** Easy to miss because `width={720}`
  looks entirely modern. `size` accepts the same number, so it is a drop-in.
- **`Space` `direction` → `orientation`.** Same values, so it is a pure rename —
  but `direction` is still correct on ConfigProvider, so rename by component.
- **`Alert` `message` → `title`.** The single largest category in this codebase.
- **`InputNumber` addons.** antd points at `Space.Compact`, which is a structural
  rewrite. `suffix` / `prefix` are supported, warning-free, and already the
  convention here — prefer them for units (`%`, `PCS`, `MTR`).
- **Inline style props fold into `styles`**, not into `style`.

## Pure renames

| Component | Old | New |
|---|---|---|
| Alert | `message` | `title` |
| Alert | `closeText` | `closable.closeIcon` |
| Space, Space.Compact | `direction` | `orientation` |
| Space | `split` | `separator` |
| Steps | `direction` | `orientation` |
| Steps | `labelPlacement` | `titlePlacement` |
| Steps | `progressDot` | `type="dot"` |
| Drawer | `width`, `height` | `size` |
| Modal | `destroyOnClose` | `destroyOnHidden` |
| Modal | `autoFocusButton` | `focusable.autoFocusButton` |
| Modal | `focusTriggerAfterClose` | `focusable.focusTriggerAfterClose` |
| Tabs | `tabPosition` | `tabPlacement` |
| Tabs | `destroyInactiveTabPane` | `destroyOnHidden` |
| Tabs | `popupClassName` | `classNames.popup` |
| Collapse | `destroyInactivePanel` | `destroyOnHidden` |
| Collapse | `expandIconPosition` | `expandIconPlacement` |
| Collapse.Panel | `disabled` | `collapsible="disabled"` |
| Button | `iconPosition` | `iconPlacement` |
| Divider | `type` | `orientation` |
| Carousel | `dotPosition` | `dotPlacement` |
| Splitter | `layout` | `orientation` |
| FloatButton | `description` | `content` |
| Progress | `width` | `size` |
| Progress | `trailColor` | `railColor` |
| Progress | `gapPosition` | `gapPlacement` |
| Progress.Line | `strokeWidth` | `size` |
| Card, Cascader, DatePicker, Input, InputNumber, Select, TreeSelect | `bordered` | `variant` |
| Tag | `bordered={false}` | `variant="filled"` |
| Tag | `color="*-inverse"` | `variant="solid"` |
| TimePicker | `addon` | `renderExtraFooter` |
| Slider | `tipFormatter`, `tooltipPlacement`, `tooltipVisible`, `tooltipPrefixCls`, `getTooltipPopupContainer` | `tooltip.*` |
| Avatar.Group | `maxCount`, `maxStyle`, `maxPopoverPlacement`, `maxPopoverTrigger` | `max={{ ... }}` |
| Calendar | `dateCellRender`, `monthCellRender` | `cellRender` |
| Calendar | `dateFullCellRender`, `monthFullCellRender` | `fullCellRender` |
| Table (column) | `filterDropdownOpen` | `filterDropdownProps.open` |
| Table (column) | `onFilterDropdownOpenChange` | `filterDropdownProps.onOpenChange` |
| Table | `pagination.position` | `pagination.placement` |
| Table | `onSelectInvert`, `onSelectAll`, `onSelectNone`, `onSelectMultiple` | `onChange` |
| Transfer | `operations` | `actions` |
| Image (preview) | `visible` / `onVisibleChange` | `open` / `onOpenChange` |
| Image (preview) | `toolbarRender` | `actionsRender` |
| ConfigProvider | `dropdownMatchSelectWidth` | `popupMatchSelectWidth` |

## Select-family (Select, TreeSelect, Cascader, AutoComplete, DatePicker)

| Old | New |
|---|---|
| `dropdownRender` | `popupRender` |
| `onDropdownVisibleChange`, `onPopupVisibleChange` | `onOpenChange` |
| `dropdownMatchSelectWidth` | `popupMatchSelectWidth` |
| `dropdownClassName`, `popupClassName` | `classNames.popup.root` |
| `dropdownStyle`, `popupStyle` | `styles.popup.root` |
| `dropdownMenuColumnStyle` (Cascader) | `popupMenuColumnStyle` |
| `bordered` | `variant` |
| `showArrow` | `suffixIcon={null}` to hide |
| `clearIcon` | `allowClear={{ clearIcon }}` |
| `dataSource` (AutoComplete) | `options` |
| `onSelect` (DatePicker) | `onCalendarChange` |

## Inline style props → the semantic `styles` object

| Component | Old | New |
|---|---|---|
| Statistic | `valueStyle` | `styles.content` |
| Descriptions | `labelStyle` / `contentStyle` | `styles.label` / `styles.content` |
| Card | `headStyle` / `bodyStyle` | `styles.header` / `styles.body` |
| Modal | `bodyStyle` / `maskStyle` | `styles.body` / `styles.mask` |
| Drawer | `headerStyle`, `bodyStyle`, `footerStyle`, `contentWrapperStyle`, `maskStyle`, `drawerStyle` | `styles.header`, `.body`, `.footer`, `.wrapper`, `.mask`, `.section` |
| Tooltip, Popover, Popconfirm | `overlayStyle` / `overlayInnerStyle` / `overlayClassName` | `styles.root` / `styles.container` / `classNames.root` |
| Tooltip | `destroyTooltipOnHide` | `destroyOnHidden` |
| Dropdown | `overlayStyle` / `overlayClassName` | `styles.root` / `classNames.root` |
| Dropdown | `destroyPopupOnHide` | `destroyOnHidden` |
| Empty | `imageStyle` | `styles.image` |
| Image | `wrapperStyle` | `styles.root` |
| Transfer | `listStyle` / `operationStyle` | `styles.section` / `styles.actions` |
| Divider | `orientationMargin` | `styles.content.margin` |

Merge into one object when a component needs several:
`styles={{ label: {...}, content: {...} }}`.

## Components replaced outright

| Gone | Use |
|---|---|
| `Input.Group`, `Button.Group`, `Dropdown.Button` | `Space.Compact` |
| `Statistic.Countdown` | `Statistic.Timer type="countdown"` |
| `BackTop` | `FloatButton.BackTop` |
| `Tabs.TabPane`, `Timeline.Item`, `Breadcrumb.Item`, `Mentions.Option` | the parent's `items` prop |
| `Anchor`/`Menu`/`Descriptions`/`Collapse` children | `items` |
| `Select.Option` / `Select.OptGroup` | `options` |
| `Dropdown placement="bottomCenter"` etc. | drop the `Center` suffix |

## Still valid — do not "fix" these

`bordered` on **Table** and **Descriptions**; `size="default"` on **Skeleton**;
`afterClose` on **Modal** (only Alert's is deprecated); `addonAfter`/`addonBefore`
on **Input** (only InputNumber's warns); `getPopupContainer` everywhere.
