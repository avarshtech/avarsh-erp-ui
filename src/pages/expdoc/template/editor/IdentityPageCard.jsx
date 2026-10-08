import {
  Card, Col, Input, Row, Space, Typography,
} from 'antd';
import { FormSelect } from '../../../../components/form';
import { LabeledSwitch } from './EditorParts';

const { Text } = Typography;

const PAPERS = [{ value: 'A4', label: 'A4' }, { value: 'A3', label: 'A3' }, { value: 'LETTER', label: 'Letter' }];
const ORIENTATIONS = [{ value: 'PORTRAIT', label: 'Portrait' }, { value: 'LANDSCAPE', label: 'Landscape' }];

/**
 * A document's printed title, logo and page. A carton sticker prints no title and takes its
 * paper from its own layout, so it shows only the logo — which a sticker prints only when it
 * is switched on, and a packing list or invoice unless it is switched off.
 */
const IdentityPageCard = ({ tpl, patch, locked, isSticker }) => {
  const identity = tpl.identity || {};
  const set = (changes) => patch({ identity: { ...identity, ...changes } });
  return (
    <Card size="small" title={isSticker ? 'Logo' : 'Page and title'}>
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {!isSticker && (
          <div>
            <Text type="secondary">Printed title</Text>
            <Input
              name="titleText" value={identity.titleText || ''} disabled={locked} placeholder="e.g. PACKING LIST"
              onChange={(e) => set({ titleText: e.target.value })}
            />
          </div>
        )}
        <LabeledSwitch
          label="Show the exporter logo" disabled={locked} onChange={(showLogo) => set({ showLogo })}
          checked={isSticker ? identity.showLogo === true : identity.showLogo !== false}
        />
        {isSticker ? (
          <Text type="secondary" style={{ fontSize: 11 }}>
            Each face prints it only while its own Exporter logo switch is on. The paper is set on the Sticker faces tab.
          </Text>
        ) : (
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
        )}
      </Space>
    </Card>
  );
};

export default IdentityPageCard;
