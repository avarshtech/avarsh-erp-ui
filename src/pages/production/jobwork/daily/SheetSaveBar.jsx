import { memo } from 'react';
import {
  Badge, Button, Popconfirm, Popover, Space, Typography,
} from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { stageLabel } from '../../../../utils/jobWorkTracker/constants';
import { cellId } from '../jwFormat';

const { Text } = Typography;

const goTo = (p) => {
  const el = p.colour && p.stage ? document.getElementById(cellId(p.jobId, p.colour, p.stage)) : null;
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el?.focus();
};

/** Sticky bar under the sheet: what changed, what is wrong (click to jump), discard and save. */
const SheetSaveBar = memo(function SheetSaveBar({ dirtyCount, problems, jobNos, saving, onSave, onDiscard }) {
  const list = (
    <Space orientation="vertical" size={4} style={{ maxWidth: 420, maxHeight: 320, overflow: 'auto' }}>
      {problems.map((p, i) => (
        <Button key={`${p.jobId}-${p.colour}-${p.stage}-${i}`} type="link" size="small" style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => goTo(p)}>
          {jobNos[p.jobId]}{p.colour ? ` · ${p.colour}` : ''}{p.stage ? ` · ${stageLabel(p.stage)}` : ''}: {p.message}
        </Button>
      ))}
    </Space>
  );
  return (
    <div style={{
      position: 'sticky', bottom: 0, zIndex: 5, marginTop: 12, padding: '10px 16px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'var(--card-bg, #fff)',
      borderTop: '1px solid var(--border-color, #f0f0f0)', boxShadow: '0 -4px 12px rgba(0,0,0,0.04)',
    }}
    >
      <Space size={16} wrap>
        <Badge status={dirtyCount ? 'processing' : 'default'} text={dirtyCount ? `${dirtyCount} job(s) changed — not saved` : 'No changes'} />
        {problems.length > 0 && (
          <Popover title="Fix these before saving" content={list} trigger="click">
            <Button size="small" danger icon={<WarningOutlined />}>{problems.length} problem(s)</Button>
          </Popover>
        )}
        <Text type="secondary" style={{ fontSize: 12 }}>One save writes every changed job, or none of them.</Text>
      </Space>
      <Space>
        <Popconfirm title="Discard the changes on this sheet?" onConfirm={onDiscard} disabled={!dirtyCount}>
          <Button disabled={!dirtyCount}>Discard</Button>
        </Popconfirm>
        <Button type="primary" onClick={onSave} loading={saving} disabled={!dirtyCount || problems.length > 0}>Save sheet</Button>
      </Space>
    </div>
  );
});

export default SheetSaveBar;
