import { useState } from 'react';
import { Tabs } from 'antd';
import { DOC_TYPE } from '../../../../utils/expDocConstants';
import TabIdentity from './TabIdentity';
import TabHeader from './TabHeader';
import TabColumns from './TabColumns';
import TabInvoice from './TabInvoice';
import TabTextBlocks from './TabTextBlocks';
import TabSticker from './TabSticker';
import TabRules from './TabRules';

/**
 * Which tabs a document type actually has — an invoice has no carton columns, and a
 * sticker no document rules: printing reads only its own layout's mandatory fields.
 */
const TABS_FOR = {
  [DOC_TYPE.PACKING_LIST]: ['identity', 'header', 'columns', 'text', 'rules'],
  [DOC_TYPE.INVOICE]: ['identity', 'header', 'invoice', 'text', 'rules'],
  [DOC_TYPE.STICKER]: ['identity', 'sticker'],
};

const TAB_LABELS = {
  identity: 'Identity',
  header: 'Header & parties',
  columns: 'Columns & sheets',
  invoice: 'Goods lines, charges & declarations',
  text: 'Fixed text',
  sticker: 'Sticker faces',
  rules: 'Rules & formatting',
};

/**
 * The template editor, shared by the builder (a saved template) and the upload review
 * (a template read from a document, not yet saved). Controlled: it edits `tpl` through
 * `patch` and holds nothing but which tab is open.
 *
 * Tabs rather than steps, because configuring a layout is not a linear task. `meta`
 * is what the AI reader found for each row (cell or page, confidence, found in the
 * document); `onEvidence` shows a row's place in the uploaded document. `defaultTab`
 * opens it where a problem is fixed.
 */
const TemplateEditor = ({
  tpl, patch, locked, meta, onEvidence, buyers, codeEditable = false, defaultTab,
}) => {
  const tabs = TABS_FOR[tpl.docType] || TABS_FOR[DOC_TYPE.PACKING_LIST];
  const [tab, setTab] = useState(defaultTab || tabs[0]);
  const active = tabs.includes(tab) ? tab : tabs[0];
  const props = { tpl, patch, locked, meta, onEvidence };

  const bodies = {
    identity: <TabIdentity tpl={tpl} patch={patch} locked={locked} buyers={buyers} codeEditable={codeEditable} />,
    header: <TabHeader {...props} />,
    columns: <TabColumns {...props} />,
    invoice: <TabInvoice {...props} />,
    text: <TabTextBlocks {...props} />,
    sticker: <TabSticker tpl={tpl} patch={patch} locked={locked} />,
    rules: <TabRules tpl={tpl} patch={patch} locked={locked} />,
  };

  return (
    <Tabs
      activeKey={active}
      onChange={setTab}
      items={tabs.map((k) => ({ key: k, label: TAB_LABELS[k], children: bodies[k] }))}
    />
  );
};

export default TemplateEditor;
