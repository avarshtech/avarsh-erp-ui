import CreatableSelect from '../../../../components/quickcreate/CreatableSelect';
import { useQuickCreate } from '../../../../components/quickcreate/QuickCreateProvider';
import { useSheet } from '../CostingSheetContext';

/**
 * Where a row's party comes from (the column's `source`): a fabric row names its supplier, a
 * manufacturing row its job worker or CMT vendor. Both keep vendorId / vendorName on the row.
 */
const SOURCES = {
  supplier: { options: 'supplierOptions', add: 'addSupplier', createType: 'supplier', label: 'Supplier' },
  vendor: { options: 'vendorOptions', add: 'addVendor', createType: 'vendor', label: 'Vendor' },
};

/** A row's supplier or vendor; a missing one is created in place. */
export default function VendorCell({ sectionKey, spec, record }) {
  const { masters, dispatch } = useSheet();
  const { open } = useQuickCreate();
  const source = SOURCES[spec?.source] ?? SOURCES.vendor;
  const list = masters[source.options] || [];
  const update = (patch) => dispatch({ type: 'UPDATE_ROW', section: sectionKey, key: record.key, patch });
  // A party no longer offered (inactive, or created elsewhere) still shows by the name the row keeps
  const options = record.vendorId && !list.some((o) => o.value === record.vendorId)
    ? [{ value: record.vendorId, label: record.vendorName || `#${record.vendorId}` }, ...list]
    : list;

  return (
    <CreatableSelect
      size="small" style={{ width: '100%' }} placeholder={source.label} allowClear aria-label={source.label}
      value={record.vendorId || undefined}
      options={options}
      createType={source.createType}
      onChange={(value, option) => update({ vendorId: value || null, vendorName: option?.label || '' })}
      onCreate={(text) => open(source.createType, {
        // A new vendor starts with the row's process, which it must have at least one of
        prefill: { text, processId: record.processId ?? null },
        onCreated: (party) => {
          masters[source.add](party);
          update({ vendorId: party.id, vendorName: party.name });
        },
      })}
    />
  );
}
