import CreatableSelect from '../../../../components/quickcreate/CreatableSelect';
import { useQuickCreate } from '../../../../components/quickcreate/QuickCreateProvider';
import { useSheet } from '../CostingSheetContext';
import { SECTION_CONFIG } from '../model/sectionConfig';
import { masterRecordPatch, variantPatch } from '../model/rowFactory';

// Search the variant name and its code.
const variantFilter = (input, option) => {
  const needle = String(input).toLowerCase();
  return String(option?.label ?? '').toLowerCase().includes(needle)
    || String(option?.variantCode ?? '').toLowerCase().includes(needle);
};

// A saved row's variant may lie outside the preloaded 50 — keep it selectable under its own name.
const withCurrent = (options, value, label) =>
  (value && !options.some((o) => o.value === value) ? [{ value, label: label || `#${value}` }, ...options] : options);

/**
 * The row's master: a fabric / trim variant, a process or an overhead. Anything missing is
 * created in place — `+ Create "<typed>"` opens the quick-create drawer and the new record
 * fills the row as soon as it is saved.
 */
export default function MasterCell({ sectionKey, record }) {
  const { variants, masters, dispatch } = useSheet();
  const { open } = useQuickCreate();
  const config = SECTION_CONFIG[sectionKey].master;
  const update = (patch) => dispatch({ type: 'UPDATE_ROW', section: sectionKey, key: record.key, patch });
  const common = { size: 'small', style: { width: '100%' }, 'aria-label': config.title, popupMatchSelectWidth: 320 };

  if (config.kind === 'variant') {
    const source = variants[sectionKey];
    const pick = (variant) => {
      if (!variant) return;
      source.register(variant);
      update(variantPatch(sectionKey, variant, record));
    };
    return (
      <CreatableSelect
        {...common}
        placeholder="Type to search or create"
        value={record.variantId || undefined}
        options={withCurrent(source.options, record.variantId, record[config.nameField])}
        filterOption={variantFilter}
        onSearch={source.search}
        createType="item"
        onChange={(id) => pick(source.get(id))}
        onCreate={(text) => open('item', { prefill: { text, category: source.category }, onCreated: pick })}
      />
    );
  }

  const isProcess = config.kind === 'process';
  const idField = isProcess ? 'processId' : 'overheadId';
  const nameField = isProcess ? 'process' : 'description';
  const pickOption = (option) => update(masterRecordPatch(sectionKey, option, record));
  return (
    <CreatableSelect
      {...common}
      placeholder={isProcess ? 'Select process' : 'Select overhead'}
      value={record[idField] || undefined}
      options={withCurrent(isProcess ? masters.processOptions : masters.overheadOptions, record[idField], record[nameField])}
      createType={isProcess ? 'process' : 'overhead'}
      onChange={(_, option) => pickOption(option)}
      onCreate={(text) => open(isProcess ? 'process' : 'overhead', {
        prefill: { text },
        onCreated: (option) => {
          (isProcess ? masters.addProcess : masters.addOverhead)(option);
          pickOption(option);
        },
      })}
    />
  );
}
