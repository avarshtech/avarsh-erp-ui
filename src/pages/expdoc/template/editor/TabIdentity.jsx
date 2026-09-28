import { useMemo } from 'react';
import {
  Alert, AutoComplete, Card, Col, Input, Row, Space, Switch, Typography,
} from 'antd';
import { FormSelect } from '../../../../components/form';
import { DOC_TYPE_LABELS } from '../../../../utils/expDocConstants';
import { TEMPLATE_SOURCE } from '../../../../utils/expDocSystemTemplates';
import { getBuyerCommercial } from '../../../../services/expdoc/expDocService';

const { Text } = Typography;

/**
 * Name, buyer and page. Packing-list and invoice templates belong to a buyer from the
 * buyer master; carton-sticker templates still name the mock's buyer codes until
 * they move to the API too.
 */
const TabIdentity = ({ tpl, patch, locked, buyers = [], stickerBuyers = [], codeEditable = false }) => {
  const identity = tpl.identity || {};
  const isSticker = tpl.source === TEMPLATE_SOURCE.MOCK;

  const buyerOptions = useMemo(() => (isSticker
    ? stickerBuyers
    : buyers.filter((b) => b.active !== false || b.id === tpl.buyerId).map((b) => ({ value: b.id, label: b.name }))),
  [isSticker, stickerBuyers, buyers, tpl.buyerId]);

  // Sub-clients have no master; the buyer's commercial profile suggests the known ones.
  const subClientOptions = useMemo(() => {
    if (isSticker) return stickerBuyers.find((b) => b.value === tpl.buyerCode)?.subClients || [];
    return (getBuyerCommercial({ buyerName: tpl.buyerName }).subClients || [])
      .map((s) => ({ value: s.code, label: `${s.code} — ${s.name}` }));
  }, [isSticker, stickerBuyers, tpl.buyerCode, tpl.buyerName]);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card size="small" title="Identity">
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Text type="secondary">Template code</Text>
              <Input
                name="templateCode"
                value={tpl.templateCode || ''}
                disabled={!codeEditable || locked}
                onChange={(e) => patch({ templateCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Shared by every version of this template and never changes once saved.
              </Text>
            </div>
            <div>
              <Text type="secondary">Name</Text>
              <Input name="templateName" value={tpl.name || ''} disabled={locked} onChange={(e) => patch({ name: e.target.value })} />
              <Text type="secondary" style={{ fontSize: 11 }}>
                What staff pick from when a buyer has more than one template, e.g. &quot;Packing list — sea&quot;.
              </Text>
            </div>
            <div>
              <Text type="secondary">Document type</Text>
              <Input name="templateDocType" value={DOC_TYPE_LABELS[tpl.docType] || tpl.docType} disabled />
            </div>
            <Row gutter={8}>
              <Col span={12}>
                <Text type="secondary">Buyer</Text>
                <FormSelect
                  variant="default"
                  style={{ width: '100%' }}
                  disabled={locked}
                  value={(isSticker ? tpl.buyerCode : tpl.buyerId) ?? undefined}
                  onChange={(v) => (isSticker
                    ? patch({ buyerCode: v || null, subClientCode: null })
                    : patch({ buyerId: v ?? null, buyerName: buyers.find((b) => b.id === v)?.name || null }))}
                  options={buyerOptions}
                  placeholder="Any buyer (tenant-wide)"
                />
              </Col>
              <Col span={12}>
                <Text type="secondary">Sub-client</Text>
                {isSticker ? (
                  <FormSelect
                    variant="default" style={{ width: '100%' }} disabled={locked || !subClientOptions.length}
                    value={tpl.subClientCode || undefined} onChange={(v) => patch({ subClientCode: v || null })}
                    options={subClientOptions} placeholder={subClientOptions.length ? 'Optional' : 'None'}
                  />
                ) : (
                  <AutoComplete
                    style={{ width: '100%' }} disabled={locked} value={tpl.subClientCode || ''}
                    options={subClientOptions} placeholder="Optional, e.g. AMG"
                    onChange={(v) => patch({ subClientCode: v ? String(v).toUpperCase() : null })}
                  />
                )}
              </Col>
            </Row>
            <Alert
              type="info"
              showIcon
              title="How this template gets used"
              description={isSticker
                ? 'A carton sticker resolves its template by buyer, then sub-client. The active version wins.'
                : 'A buyer may keep several active templates. A new document takes the buyer\'s only one automatically; when there are several, staff pick one by name. A matching sub-client is listed first.'}
            />
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card size="small" title="Page and title">
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Text type="secondary">Printed title</Text>
              <Input
                name="titleText" value={identity.titleText || ''} disabled={locked} placeholder="e.g. PACKING LIST"
                onChange={(e) => patch({ identity: { ...identity, titleText: e.target.value } })}
              />
            </div>
            <Space>
              <Switch checked={identity.showLogo !== false} disabled={locked}
                onChange={(v) => patch({ identity: { ...identity, showLogo: v } })} />
              <Text>Show the exporter logo</Text>
            </Space>
            <Row gutter={8}>
              <Col span={12}>
                <Text type="secondary">Paper</Text>
                <FormSelect
                  variant="default" allowClear={false} style={{ width: '100%' }} disabled={locked}
                  value={identity.paper || 'A4'} onChange={(v) => patch({ identity: { ...identity, paper: v } })}
                  options={[{ value: 'A4', label: 'A4' }, { value: 'A3', label: 'A3' }, { value: 'LETTER', label: 'Letter' }]}
                />
              </Col>
              <Col span={12}>
                <Text type="secondary">Orientation</Text>
                <FormSelect
                  variant="default" allowClear={false} style={{ width: '100%' }} disabled={locked}
                  value={identity.orientation || 'PORTRAIT'} onChange={(v) => patch({ identity: { ...identity, orientation: v } })}
                  options={[{ value: 'PORTRAIT', label: 'Portrait' }, { value: 'LANDSCAPE', label: 'Landscape' }]}
                />
              </Col>
            </Row>
          </Space>
        </Card>
      </Col>
    </Row>
  );
};

export default TabIdentity;
