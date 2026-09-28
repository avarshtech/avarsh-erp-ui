import {
  Card, Col, Input, InputNumber, Row, Space, Switch, Typography,
} from 'antd';
import { FormSelect } from '../../../../components/form';
import { integerInputProps } from '../../../../utils/inputHelpers';

const { Text } = Typography;

/** Mandatory fields for submission and document generation, and typography. */
const TabRules = ({ tpl, patch, locked }) => {
  const formatting = tpl.formatting || {};
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card size="small" title="Mandatory fields">
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Text type="secondary">Required before submission (V-12)</Text>
              <FormSelect
                variant="tags"
                style={{ width: '100%' }}
                disabled={locked}
                value={tpl.mandatoryForSubmit || []}
                onChange={(v) => patch({ mandatoryForSubmit: v })}
                placeholder="e.g. row.netWeightKg, invoice.consignee"
              />
            </div>
            <div>
              <Text type="secondary">Required before a document or sticker is generated (V-08)</Text>
              <FormSelect
                variant="tags"
                style={{ width: '100%' }}
                disabled={locked}
                value={tpl.mandatoryForDocGen || []}
                onChange={(v) => patch({ mandatoryForDocGen: v })}
                placeholder="e.g. carton.netWeightKg"
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                A carton missing one of these blocks its own sticker, and names itself in the error.
              </Text>
            </div>
            <Space>
              <Switch checked={tpl.printWeights !== false} disabled={locked} onChange={(v) => patch({ printWeights: v })} />
              <Text>Print weights</Text>
            </Space>
            <Space>
              <Switch checked={tpl.printDimensions !== false} disabled={locked} onChange={(v) => patch({ printDimensions: v })} />
              <Text>Print dimensions and CBM</Text>
            </Space>
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card size="small" title="Formatting">
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Text type="secondary">Font</Text>
              <FormSelect
                variant="default"
                allowClear={false}
                style={{ width: '100%' }}
                disabled={locked}
                value={formatting.font || 'Arial'}
                onChange={(v) => patch({ formatting: { ...formatting, font: v } })}
                options={['Arial', 'Helvetica', 'Courier New', 'Times New Roman'].map((f) => ({ value: f, label: f }))}
              />
            </div>
            <div>
              <Text type="secondary">Base font size (pt)</Text>
              <InputNumber
                {...integerInputProps}
                min={6}
                max={14}
                style={{ width: '100%' }}
                disabled={locked}
                value={formatting.baseFontPt}
                onChange={(v) => patch({ formatting: { ...formatting, baseFontPt: v } })}
              />
            </div>
            <div>
              <Text type="secondary">Date format</Text>
              <Input
                disabled={locked}
                value={formatting.dateFormat || ''}
                placeholder="DD-MMM-YYYY"
                onChange={(e) => patch({ formatting: { ...formatting, dateFormat: e.target.value } })}
              />
            </div>
          </Space>
        </Card>
      </Col>
    </Row>
  );
};

export default TabRules;
