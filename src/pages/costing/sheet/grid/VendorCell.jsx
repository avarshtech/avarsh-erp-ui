import CreatableSelect from '../../../../components/quickcreate/CreatableSelect';
import { useQuickCreate } from '../../../../components/quickcreate/QuickCreateProvider';
import { useSheet } from '../CostingSheetContext';

/** The job-work vendor (or fabric supplier) for a row; a missing one is created in place. */
export default function VendorCell({ sectionKey, record }) {
  const { masters, dispatch } = useSheet();
  const { open } = useQuickCreate();
  const update = (patch) => dispatch({ type: 'UPDATE_ROW', section: sectionKey, key: record.key, patch });
  const options = record.vendorId && !masters.supplierOptions.some((o) => o.value === record.vendorId)
    ? [{ value: record.vendorId, label: record.vendorName || `#${record.vendorId}` }, ...masters.supplierOptions]
    : masters.supplierOptions;

  return (
    <CreatableSelect
      size="small" style={{ width: '100%' }} placeholder="Vendor" allowClear aria-label="Vendor"
      value={record.vendorId || undefined}
      options={options}
      createType="supplier"
      onChange={(value, option) => update({ vendorId: value || null, vendorName: option?.label || '' })}
      onCreate={(text) => open('supplier', {
        prefill: { text },
        onCreated: (supplier) => {
          masters.addSupplier(supplier);
          update({ vendorId: supplier.id, vendorName: supplier.name });
        },
      })}
    />
  );
}
