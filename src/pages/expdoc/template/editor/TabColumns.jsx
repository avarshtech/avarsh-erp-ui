import { Alert, Card, Checkbox, Space, Typography } from 'antd';
import { PACKING_TYPE, PACKING_TYPE_LABELS } from '../../../../utils/expDocConstants';
import ColumnsEditor from './ColumnsEditor';
import SheetsEditor from './SheetsEditor';

const { Paragraph } = Typography;

/** A packing list's carton grid and the sheets (sections) it prints in. */
const TabColumns = ({ tpl, patch, locked, meta, onEvidence }) => (
  <Space orientation="vertical" size={16} style={{ width: '100%' }}>
    <Alert
      type="info"
      showIcon
      title="One column set, two places"
      description="These columns are what the workspace grid shows AND what the printed document prints. A size grid expands to one column per size, in the frozen preset order. A group header spans the adjacent columns that share it."
    />
    <Card size="small" title="Grid columns">
      <ColumnsEditor
        columns={tpl.columns} onChange={(v) => patch({ columns: v })} locked={locked}
        categories={['ROW', 'CALC', 'STYLE', 'PL']} meta={meta} metaList="columns" onEvidence={onEvidence}
      />
    </Card>
    <Card size="small" title="Sheets">
      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        The sections the document prints, in order. Expand a carton-table sheet to give it its own columns or a
        heading and subtotal per order or style.
      </Paragraph>
      <SheetsEditor sheets={tpl.sheets} onChange={(v) => patch({ sheets: v })} locked={locked} meta={meta} onEvidence={onEvidence} />
    </Card>
    <Card size="small" title="Packing types allowed">
      <Checkbox.Group
        disabled={locked}
        value={tpl.packingTypesAllowed || Object.values(PACKING_TYPE)}
        onChange={(v) => patch({ packingTypesAllowed: v })}
        options={Object.values(PACKING_TYPE).map((p) => ({ value: p, label: PACKING_TYPE_LABELS[p] }))}
      />
      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
        Narrows what the packing entry offers for this buyer. VGT packs solid and mixed only; JOMO uses all five.
      </Paragraph>
    </Card>
  </Space>
);

export default TabColumns;
