import {
  Card, Checkbox, InputNumber, Segmented, Space, Switch, Typography,
} from 'antd';
import { FormSelect } from '../../../../components/form';
import { integerInputProps } from '../../../../utils/inputHelpers';
import { PAPER, PAPER_LIST } from '../../../../utils/expDocConstants';
import { SCOPE } from './stickerWorkspaceModel';

const { Text } = Typography;
const HEADING = { display: 'block', marginBottom: 6 };
const NOTE = { fontSize: 12, display: 'block', marginTop: 4 };

/**
 * What to print: which cartons, on which paper, which of the layout's faces, and whether
 * its barcode lines print. Paper, faces and barcodes are the layout's own (useLayoutSettings).
 */
const StickerPrintControls = ({
  ctx, range, onRange, settings,
}) => {
  const faces = ctx.layout?.stickerLayout?.faces || [];
  const setRange = (patch) => onRange({ ...range, ...patch });

  return (
    <Card title="What to print" size="small">
      <Space orientation="vertical" size={14} style={{ width: '100%' }}>
        <div>
          <Text strong style={HEADING}>Scope</Text>
          <Segmented
            block
            name="sticker-scope"
            aria-label="Scope"
            options={[SCOPE.ALL, SCOPE.RANGE]}
            value={range.mode}
            onChange={(mode) => setRange({ mode })}
          />
          {range.mode === SCOPE.RANGE && (
            <Space style={{ marginTop: 8 }}>
              <InputNumber
                {...integerInputProps} min={1} id="sticker-from" name="sticker-from" aria-label="From carton"
                placeholder="From" value={range.from} onChange={(from) => setRange({ from })}
              />
              <Text type="secondary">to</Text>
              <InputNumber
                {...integerInputProps} min={1} id="sticker-to" name="sticker-to" aria-label="To carton"
                placeholder="To" value={range.to} onChange={(to) => setRange({ to })}
              />
            </Space>
          )}
          <Text type="secondary" style={{ ...NOTE, marginTop: 6 }}>
            {`Reprinting a range does not regenerate the rest. Cartons available: ${ctx.pl.cartonRangeLabel}.`}
          </Text>
        </div>

        <div>
          <Text strong style={HEADING}><label htmlFor="sticker-paper">Paper</label></Text>
          <FormSelect
            variant="default" allowClear={false} id="sticker-paper" style={{ width: '100%' }}
            options={PAPER_LIST} value={settings.paper} onChange={settings.setPaper}
          />
          {settings.paper === PAPER.THERMAL_4X6 && (
            <Text type="warning" style={NOTE}>
              Set the printer to 4×6 / Actual size / no margins — browsers other than Chrome and Edge ignore the page size.
            </Text>
          )}
        </div>

        {faces.length > 1 && (
          <div>
            <Text strong style={HEADING}>Faces</Text>
            <Checkbox.Group
              name="sticker-faces"
              role="group"
              aria-label="Faces"
              options={faces.map((f) => ({ label: f.title || f.key, value: f.key }))}
              value={settings.faceKeys}
              onChange={settings.setFaceKeys}
            />
          </div>
        )}

        {settings.barcodeLine && (
          <div>
            <Space>
              <Switch id="sticker-barcodes" checked={settings.printBarcodes} onChange={settings.setBarcodes} />
              <label htmlFor="sticker-barcodes">Print barcodes</label>
            </Space>
            <Text type="secondary" style={NOTE}>
              EAN-13, UPC-A and Code 128 print; ITF-14, GS1-128 and QR are not printed yet.
            </Text>
          </div>
        )}
      </Space>
    </Card>
  );
};

export default StickerPrintControls;
