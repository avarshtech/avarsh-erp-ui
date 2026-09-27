import { Alert, Button, Checkbox, Flex, Tag, Tooltip, Typography } from 'antd';
import CreatableSelect from '../../../../components/quickcreate/CreatableSelect';
import { useQuickCreate } from '../../../../components/quickcreate/QuickCreateProvider';
import { useSheet } from '../CostingSheetContext';
import { canQuickCreate } from '../../../../components/quickcreate/quickCreateTypes';
import {
  SECTION_OF, canInclude, costMasterType, isComplete, isMaterial, needsNewClassifiers, proposalBlocker, proposalLabel, rowState,
} from './draftModel';

const { Text } = Typography;
const NEW = '__proposal__';
const CONFIDENCE = { HIGH: 'green', MEDIUM: 'gold', LOW: 'red' };

const variantOption = (v, score) => ({
  value: v.id, variantCode: v.variantCode,
  label: `${v.variantName || v.variantCode}${v.variantCode ? ` (${v.variantCode})` : ''}${score != null ? ` · ${Math.round(score * 100)}%` : ''}`,
});

/** Suggestions first (with their match score), then the section's own variants; a complete proposal on top. */
function materialOptions(row, choice, source) {
  const seen = new Set();
  const list = [];
  const add = (option) => { if (!seen.has(option.value)) { seen.add(option.value); list.push(option); } };
  if (isComplete(row.proposedItem) && !proposalBlocker(row.proposedItem)) add({ value: NEW, label: `New: ${row.proposedItem.variantName}` });
  if (choice.variant) add(variantOption(choice.variant));
  (row.suggestions || []).forEach((s) => add(variantOption(s.variant, s.score)));
  source.options.forEach(add);
  return list;
}

function MaterialPicker({ row, choice, onChange }) {
  const { variants } = useSheet();
  const { open } = useQuickCreate();
  const source = variants[SECTION_OF[row.section]];
  const linked = (variant) => { source.register(variant); onChange({ variant, create: false, include: true }); };
  const openCreate = (text, proposal) => open('item', { prefill: { text, category: source.category, proposal }, onCreated: linked });
  const state = rowState(row, choice);

  return (
    <Flex vertical gap={4}>
      <CreatableSelect
        size="small" style={{ width: '100%' }} aria-label={`Material for ${row.name}`} placeholder="Pick or create the material"
        value={choice.variant?.id ?? (choice.create ? NEW : null)}
        options={materialOptions(row, choice, source)}
        onSearch={source.search} createType="item"
        onChange={(value) => {
          if (value === NEW) { onChange({ variant: null, create: true, include: true }); return; }
          const variant = row.suggestions?.find((s) => s.variant.id === value)?.variant || source.get(value);
          if (variant) linked(variant);
        }}
        onCreate={(text) => openCreate(text, text === row.name ? row.proposedItem : undefined)}
      />
      {state === 'create' && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          <Tag color="blue">New</Tag>{proposalLabel(row.proposedItem)}
          {row.proposedItem.existingItemCode && ` — added to ${row.proposedItem.existingItemCode}`}
          {needsNewClassifiers(row.proposedItem) && ' — created with it'}
          <Button type="link" size="small" onClick={() => openCreate(row.name, row.proposedItem)}>Edit</Button>
        </Text>
      )}
      {state === 'incomplete' && (
        <Text type="warning" style={{ fontSize: 12 }}>
          {isComplete(row.proposedItem)
            ? `${proposalLabel(row.proposedItem)} — ${proposalBlocker(row.proposedItem)}`
            : `Not in the master yet — needs ${row.proposedItem.missing.join(', ')}.`}
          <Button type="link" size="small" onClick={() => openCreate(row.name, row.proposedItem)}>Complete details…</Button>
        </Text>
      )}
    </Flex>
  );
}

function CostMasterPicker({ row, choice, onChange }) {
  const { masters } = useSheet();
  const { open } = useQuickCreate();
  const type = costMasterType(row);
  const isProcess = type === 'process';
  const pick = (option) => onChange({ masterId: option.value, masterName: option.label, masterCost: option.defaultCost, createMaster: false, include: true });
  const options = [
    ...(canQuickCreate(type) ? [{ value: NEW, label: `New: ${row.name}` }] : []),
    ...(isProcess ? masters.processOptions : masters.overheadOptions),
  ];
  return (
    <Flex vertical gap={4}>
      <CreatableSelect
        size="small" style={{ width: '100%' }} aria-label={`${isProcess ? 'Process' : 'Overhead'} for ${row.name}`}
        placeholder={isProcess ? 'Pick or create the process' : 'Pick or create the overhead'}
        value={choice.masterId ?? (choice.createMaster ? NEW : null)}
        options={options} createType={type}
        onChange={(value, option) => {
          if (value === NEW) { onChange({ masterId: null, createMaster: true, include: true }); return; }
          if (option) pick(option);
        }}
        onCreate={(text) => open(type, {
          prefill: { text },
          onCreated: (option) => { (isProcess ? masters.addProcess : masters.addOverhead)(option); pick(option); },
        })}
      />
      {!choice.masterId && choice.createMaster && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          <Tag color="blue">New</Tag>{isProcess ? 'Process' : 'Overhead'} “{row.name}” is created
          {row.rate != null ? ` with a default cost of ${row.rate}${row.rateCurrency ? ` ${row.rateCurrency}` : ''}` : ''}.
        </Text>
      )}
    </Flex>
  );
}

const figures = (row) => [
  row.quantity != null && `${row.quantity}${row.uom ? ` ${row.uom}` : ''}`,
  row.rate != null && `@ ${row.rate}${row.rateCurrency ? ` ${row.rateCurrency}` : ''}`,
  row.allowancePct != null && `allowance ${row.allowancePct}%`,
  row.wastagePct != null && `wastage ${row.wastagePct}%`,
].filter(Boolean).join(' · ');

/** One line the AI found: what it heard, the master it links to, and whether it goes on the sheet. */
export default function DraftRowItem({ row, choice, onChange, error }) {
  const includable = canInclude(row, choice);
  return (
    <div className="ai-draft-row" data-draft-ref={row.ref}>
      <Flex gap={8} align="start">
        <Checkbox
          checked={!!choice.include && includable} disabled={!includable} aria-label={`Include ${row.name}`}
          onChange={(e) => onChange({ include: e.target.checked })} style={{ marginTop: 2 }}
        />
        <Flex vertical gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Flex justify="space-between" gap={8} wrap>
            <Text strong>{row.name}</Text>
            <span>
              <Tooltip title="How sure the AI is that it read this line right">
                <Tag color={CONFIDENCE[row.confidence]}>{row.confidence}</Tag>
              </Tooltip>
              {row.sourceRef && <Text type="secondary" style={{ fontSize: 12 }}>{row.sourceRef}</Text>}
            </span>
          </Flex>
          {row.heardAs && row.heardAs !== row.name && <Text type="secondary" italic style={{ fontSize: 12 }}>“{row.heardAs}”</Text>}
          {isMaterial(row)
            ? <MaterialPicker row={row} choice={choice} onChange={onChange} />
            : <CostMasterPicker row={row} choice={choice} onChange={onChange} />}
          {(figures(row) || row.details) && (
            <Text style={{ fontSize: 12 }}>{[figures(row), row.details].filter(Boolean).join(' — ')}</Text>
          )}
          {error && <Alert type="error" showIcon title={error} />}
        </Flex>
      </Flex>
    </div>
  );
}
