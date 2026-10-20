import { useState } from 'react';
import {
  Alert, Button, Drawer, Space, Typography,
} from 'antd';
import CartonGroupEditor from '../../production/packing/CartonGroupEditor';
import { SECTION_KEY, SECTION_TITLES } from '../../../utils/expDocConstants';

const { Text } = Typography;

/**
 * The buyer's plan for one order (owner, 2026-10-09): the carton ranges the buyer's packing
 * list fixes, typed in the buyer's own carton numbers and PO, in the grid Carton Packing
 * uses. Saved with the list; Carton Packing then packs "as per packing list".
 */
const PlPlanDrawer = ({
  open, block, sizes, rows, saving, onSave, onClose,
}) => {
  const [draft, setDraft] = useState(rows);
  const [dirty, setDirty] = useState(false);
  const poOptions = (block?.pos || []).filter((p) => p.key != null && p.onShipment)
    .map((p) => ({ buyerPoNo: p.buyerPoNo, destination: p.destination, dispatchDate: p.dispatchDate }));
  const change = (next) => { setDraft(next); setDirty(true); };

  return (
    <Drawer
      open={open}
      size={1100}
      title={`Buyer's plan — ${[block?.orderNo, block?.styleNo].filter(Boolean).join(' · ')}`}
      onClose={onClose}
      destroyOnHidden
      extra={(
        <Space>
          <Button onClick={onClose}>{dirty ? 'Discard' : 'Close'}</Button>
          <Button type="primary" loading={saving} disabled={!dirty} onClick={() => onSave(draft)}>Save plan</Button>
        </Space>
      )}
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          title="Type the cartons as the buyer's packing list numbers them"
          description="Each range names its buyer PO. The packing list prints these numbers, and Carton Packing offers them to pack as per this list."
        />
        {!sizes.length && (
          <Text type="warning">This order&apos;s sizes could not be read, so the size columns are empty.</Text>
        )}
        {[SECTION_KEY.MAIN, SECTION_KEY.EXTRA].map((key) => (
          <div key={key}>
            <Text strong style={{ display: 'block', margin: '8px 0' }}>{SECTION_TITLES[key]}</Text>
            <CartonGroupEditor
              sizes={sizes}
              groups={draft}
              sectionKey={key}
              styleNo={block?.styleNo}
              buyerPoNo={null}
              poOptions={poOptions}
              onChange={change}
            />
          </div>
        ))}
      </Space>
    </Drawer>
  );
};

export default PlPlanDrawer;
