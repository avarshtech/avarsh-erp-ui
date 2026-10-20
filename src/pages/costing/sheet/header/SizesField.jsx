import { Button, Divider, Form, Select, Tooltip } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuickCreate } from '../../../../components/quickcreate/QuickCreateProvider';
import { canQuickCreate, quickCreateHint } from '../../../../components/quickcreate/quickCreateTypes';
import { useSheet } from '../CostingSheetContext';

/**
 * Sizes are picked from the Size Presets master only (free-typed sizes drifted from the presets
 * the order matrix is built on). A missing run of sizes is created as a preset right here.
 */
export default function SizesField() {
  const { form, masters, dispatch } = useSheet();
  const { open } = useQuickCreate();
  const allowed = canQuickCreate('sizePreset');

  const createPreset = () => open('sizePreset', {
    prefill: {},
    onCreated: (preset) => {
      masters.addSizePreset(preset);
      form.setFieldValue('sizes', (preset.sizes || []).map((s) => String(s).trim().toUpperCase()));
      dispatch({ type: 'MARK_DIRTY' });
    },
  });

  return (
    <Form.Item label="Sizes" name="sizes" rules={[{ required: true, message: 'At least one size is required' }]}>
      <Select
        mode="multiple"
        showSearch
        placeholder={masters.sizeGroups.length ? 'Select sizes from a size preset' : 'No size presets yet — create one'}
        options={masters.sizeGroups}
        popupRender={(menu) => (
          <>
            {menu}
            <Divider style={{ margin: '4px 0' }} />
            <Tooltip title={allowed ? undefined : quickCreateHint('sizePreset')}>
              <Button type="link" icon={<PlusOutlined />} disabled={!allowed} onClick={createPreset} style={{ width: '100%', textAlign: 'left' }}>
                New size preset
              </Button>
            </Tooltip>
          </>
        )}
      />
    </Form.Item>
  );
}
