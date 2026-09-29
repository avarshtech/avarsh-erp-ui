import { Fragment } from 'react';
import {
  Card, Col, Input, InputNumber, Row, Space, Switch, Typography,
} from 'antd';
import { FormSelect } from '../../../../components/form';
import { numericInputProps } from '../../../../utils/inputHelpers';
import {
  DOC_FONT_GROUPS, MAIN_TEXT_PT, MIN_TEXT_PT, TEXT_ROLES, textSizePt,
} from '../../../../utils/expDocConstants';

const { Text } = Typography;

/** The printable fonts by kind, each option shown in its own typeface. */
const FONT_OPTIONS = DOC_FONT_GROUPS.map((g) => ({
  label: g.label,
  options: g.fonts.map((f) => ({ value: f.name, label: f.name, stack: f.stack })),
}));

/**
 * Mandatory fields for submission and document generation, and typography: the font,
 * the main text size, and a size for each other kind of text on the page — each
 * following the main size until it is set (see TEXT_ROLES).
 */
const TabRules = ({ tpl, patch, locked }) => {
  const formatting = tpl.formatting || {};
  const sizes = formatting.textSizes || {};
  const roles = TEXT_ROLES.filter((r) => !r.docTypes || r.docTypes.includes(tpl.docType));
  /** What a kind of text prints at when left empty — shown as its placeholder. */
  const autoSize = (role) => textSizePt({ ...formatting, textSizes: { ...sizes, [role.key]: undefined } }, role, tpl.docType);
  const setSize = (key, value) => {
    const next = { ...sizes };
    if (value == null) delete next[key]; else next[key] = value;
    patch({ formatting: { ...formatting, textSizes: next } });
  };
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
                options={FONT_OPTIONS}
                optionRender={(opt) => <span style={{ fontFamily: opt.data.stack }}>{opt.data.label}</span>}
                aria-label="Font"
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Printed on the computer that prints the document; if it lacks the font, the nearest one of the same kind is used.
              </Text>
            </div>
            <div>
              <Text type="secondary">Main text size (pt)</Text>
              <InputNumber
                {...numericInputProps}
                name="baseFontPt"
                min={MIN_TEXT_PT}
                max={16}
                step={0.5}
                style={{ width: '100%' }}
                disabled={locked}
                value={formatting.baseFontPt}
                placeholder={String(MAIN_TEXT_PT[tpl.docType] ?? 9)}
                onChange={(v) => patch({ formatting: { ...formatting, baseFontPt: v ?? undefined } })}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Table rows and plain text. The sizes below follow it unless you set them.
              </Text>
            </div>
            <div>
              <Text type="secondary">Other text sizes (pt)</Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '6px 12px', alignItems: 'center', marginTop: 4 }}>
                {roles.map((role) => (
                  <Fragment key={role.key}>
                    <Text>{role.label}</Text>
                    <InputNumber
                      {...numericInputProps}
                      size="small"
                      name={`textSize-${role.key}`}
                      aria-label={`${role.label} size in points`}
                      min={MIN_TEXT_PT}
                      max={28}
                      step={0.5}
                      style={{ width: '100%' }}
                      disabled={locked}
                      value={sizes[role.key]}
                      placeholder={`${autoSize(role)} (auto)`}
                      onChange={(v) => setSize(role.key, v)}
                    />
                  </Fragment>
                ))}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {`Leave a size empty to follow the main text. Nothing prints smaller than ${MIN_TEXT_PT} pt.`}
              </Text>
            </div>
            <div>
              <Text type="secondary">Date format</Text>
              <Input
                name="dateFormat"
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
