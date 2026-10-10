import {
  Card, Col, Input, Row, Space, Typography,
} from 'antd';
import { FormSelect } from '../../../../components/form';
import { LabeledSwitch } from './EditorParts';

const { Text } = Typography;

const PAPERS = [{ value: 'A4', label: 'A4' }, { value: 'A3', label: 'A3' }, { value: 'LETTER', label: 'Letter' }];
const ORIENTATIONS = [{ value: 'PORTRAIT', label: 'Portrait' }, { value: 'LANDSCAPE', label: 'Landscape' }];

/**
 * A packing list's or invoice's printed title, logo and page; the logo prints unless it
 * is switched off. A carton sticker has none of these: it prints no title, takes its paper
 * from its own layout and never carries the exporter's logo.
 */
const IdentityPageCard = ({ tpl, patch, locked }) => {
  const identity = tpl.identity || {};
  const set = (changes) => patch({ identity: { ...identity, ...changes } });
  return (
    <Card size="small" title="Page and title">
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Text type="secondary">Printed title</Text>
          <Input
            name="titleText" value={identity.titleText || ''} disabled={locked} placeholder="e.g. PACKING LIST"
            onChange={(e) => set({ titleText: e.target.value })}
          />
        </div>
        <LabeledSwitch
          label="Show the exporter logo" disabled={locked} onChange={(showLogo) => set({ showLogo })}
          checked={identity.showLogo !== false}
        />
        <Row gutter={8}>
          <Col span={12}>
            <Text type="secondary">Paper</Text>
            <FormSelect
              id="identityPaper" aria-label="Paper" variant="default" allowClear={false} style={{ width: '100%' }}
              disabled={locked} value={identity.paper || 'A4'} onChange={(paper) => set({ paper })} options={PAPERS}
            />
          </Col>
          <Col span={12}>
            <Text type="secondary">Orientation</Text>
            <FormSelect
              id="identityOrientation" aria-label="Orientation" variant="default" allowClear={false} style={{ width: '100%' }}
              disabled={locked} value={identity.orientation || 'PORTRAIT'} onChange={(orientation) => set({ orientation })}
              options={ORIENTATIONS}
            />
          </Col>
        </Row>
      </Space>
    </Card>
  );
};

export default IdentityPageCard;
