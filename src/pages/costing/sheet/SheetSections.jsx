import { Alert, Badge, Collapse, Divider, Input, Space, Tag, Typography } from 'antd';
import { formatCurrency } from '../../../utils/costingConstants';
import { useSheet } from './CostingSheetContext';
import SectionGrid from './grid/SectionGrid';
import PerSizePanel from './price/PerSizePanel';
import AttachmentsPanel from './header/AttachmentsPanel';

const { Text } = Typography;

function Notes({ note, label }) {
  const { sheet, dispatch } = useSheet();
  return (
    <Input.TextArea
      name={`${note}Notes`} value={sheet.notes[note]} maxLength={1000} autoSize={{ minRows: 1, maxRows: 3 }}
      placeholder={`${label} notes / remarks…`} style={{ marginTop: 12 }}
      onChange={(e) => dispatch({ type: 'SET_NOTE', note, value: e.target.value })}
    />
  );
}

const heading = (text, color, total, currency) => (
  <Space>
    <Text strong style={{ fontSize: 15, color }}>{text}</Text>
    {total !== undefined && <Tag>{formatCurrency(total, currency)}</Tag>}
  </Space>
);

/**
 * The cost sections as collapsible panels (all open by default), with the per-size breakdown
 * and the images & attachments below them. Titles keep the old sheet's wording.
 */
export default function SheetSections() {
  const { totals, header, attachments } = useSheet();
  const c = header.currency;

  const items = [
    {
      key: 'fabric',
      label: heading('Section B — Fabric Cost Breakup', 'var(--info-color)', totals.fabric, c),
      children: (
        <>
          {header.costingType === 'CMT' && (
            <Alert type="info" showIcon style={{ marginBottom: 12 }} title="CMT: fabric is supplied by the buyer, so it is left out of the price." />
          )}
          <SectionGrid sectionKey="fabric" color="var(--info-color)" />
          <Notes note="fabric" label="Fabric" />
        </>
      ),
    },
    {
      key: 'trims',
      label: heading('Section C — Trims / Accessories Cost Breakup', '#8b5cf6', totals.accessories, c),
      children: (
        <>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>C.1 — Local Accessories</Text>
          <SectionGrid sectionKey="localTrim" color="#8b5cf6" />
          <Divider style={{ margin: '16px 0' }} />
          <Text strong style={{ display: 'block', marginBottom: 8 }}>C.2 — Imported Accessories</Text>
          <SectionGrid sectionKey="importedTrim" color="#8b5cf6" />
          <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
            Total accessories {formatCurrency(totals.accessories, c)} = local {formatCurrency(totals.local, c)} + imported{' '}
            {formatCurrency(totals.importedUsd, 'USD')} × {totals.usdToCostingRate}
          </Text>
          <Notes note="trims" label="Trims" />
        </>
      ),
    },
    {
      key: 'manufacturing',
      label: heading('Section D — Manufacturing Cost', '#f59e0b', totals.manufacturing, c),
      children: (<><SectionGrid sectionKey="manufacturing" color="#f59e0b" /><Notes note="manufacturing" label="Manufacturing" /></>),
    },
    {
      key: 'overhead',
      label: heading('Section E — Overhead / Markup Costs', '#ef4444', totals.markup, c),
      children: (<><SectionGrid sectionKey="overhead" color="#ef4444" /><Notes note="overhead" label="Overhead" /></>),
    },
    totals.perSize.length > 0 && {
      key: 'perSize',
      label: heading('Section F — Per-Size Breakdown', '#10b981'),
      children: <PerSizePanel />,
    },
    {
      key: 'attachments',
      label: <Space><Text strong style={{ fontSize: 15 }}>Images & Attachments</Text><Badge count={attachments.count} showZero={false} /></Space>,
      children: <AttachmentsPanel />,
    },
  ].filter(Boolean);

  return (
    <Collapse
      defaultActiveKey={['fabric', 'trims', 'manufacturing', 'overhead', 'perSize']}
      items={items}
      style={{ marginTop: 16 }}
    />
  );
}
