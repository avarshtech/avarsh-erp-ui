import { Drawer } from 'antd';
import { QUICK_CREATE_TYPES } from './quickCreateTypes';
import ItemVariantQuickForm from './forms/ItemVariantQuickForm';
import BuyerQuickForm from './forms/BuyerQuickForm';
import StyleQuickForm from './forms/StyleQuickForm';
import SupplierQuickForm from './forms/SupplierQuickForm';
import SizePresetQuickForm from './forms/SizePresetQuickForm';
import { OverheadQuickForm, ProcessQuickForm } from './forms/CostMasterQuickForms';

const FORMS = {
  item: ItemVariantQuickForm,
  buyer: BuyerQuickForm,
  style: StyleQuickForm,
  supplier: SupplierQuickForm,
  sizePreset: SizePresetQuickForm,
  process: ProcessQuickForm,
  overhead: OverheadQuickForm,
};

/**
 * One side drawer for every quick-create form. It opens over the sheet (and over the tech pack
 * review modal, hence the z-index) so the user never loses their place.
 */
export default function QuickCreateDrawer({ request, onClose, onDone }) {
  const type = request?.type;
  const Form = FORMS[type];
  const config = QUICK_CREATE_TYPES[type] || {};
  return (
    <Drawer
      open={!!request}
      title={config.title}
      size={config.size || 480}
      zIndex={1100}
      onClose={onClose}
      destroyOnHidden
    >
      {Form && (
        <Form key={request.id} prefill={request.prefill || {}} onDone={onDone} onCancel={onClose} />
      )}
    </Drawer>
  );
}
