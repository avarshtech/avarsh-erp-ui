import { memo, useMemo } from 'react';
import { Button, Popconfirm, Space, Timeline, Typography } from 'antd';
import {
  EditOutlined, InboxOutlined, NotificationOutlined, SwapOutlined,
} from '@ant-design/icons';
import { FLAG_LABEL, ISSUE_CATEGORY, ISSUE_CATEGORY_LABEL, SOURCE_LABEL, STAGE_LABEL } from '../../../../utils/jobWorkTracker/constants';
import { fmtDate, fmtQty } from '../jwFormat';

const { Text } = Typography;
const sumCells = (cells, stage) => Object.values(cells || {}).reduce((a, c) => a + (c?.[stage] || 0), 0);
const PULLBACK_ACTION = {
  SUBMITTED: 'sent for approval', APPROVED: 'approved', REJECTED: 'rejected', REFERRED_BACK: 'referred back', SETTLED: 'settled', CANCELLED: 'cancelled',
};

/** Newest first: daily updates, receipts, pull-back steps and job events. Only the latest update can be deleted. */
const JobTimeline = memo(function JobTimeline({ timeline, stages, latestEntryId, canDelete, onDeleteLatest, deleting }) {
  const items = useMemo(() => timeline.map((t) => {
    if (t.kind === 'PROGRESS') {
      const e = t.entry;
      const isLatest = e.id === latestEntryId;
      return {
        key: t.key, color: 'blue', icon: <EditOutlined />,
        title: <Text type="secondary">{fmtDate(t.at)} · {SOURCE_LABEL[e.source] || e.source} · {t.by}</Text>,
        content: (
          <Space orientation="vertical" size={2}>
            <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{stages.map((st) => `${STAGE_LABEL[st]} ${fmtQty(sumCells(e.cells, st))}`).join(' · ')}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {FLAG_LABEL[e.flag]}{e.issueCategory && e.issueCategory !== ISSUE_CATEGORY.NONE ? ` · ${ISSUE_CATEGORY_LABEL[e.issueCategory]}` : ''}
              {e.revisedDue ? ` · vendor's date ${fmtDate(e.revisedDue)}` : ''}{e.remarks ? ` — ${e.remarks}` : ''}
            </Text>
            {isLatest && canDelete && (
              <Popconfirm title="Delete the latest update?" description="The previous update becomes the latest." onConfirm={onDeleteLatest}>
                <Button size="small" danger type="link" loading={deleting} style={{ padding: 0 }}>Delete this update</Button>
              </Popconfirm>
            )}
          </Space>
        ),
      };
    }
    if (t.kind === 'RECEIPT') {
      const r = t.receipt;
      const good = r.lines.reduce((a, l) => a + l.good, 0);
      const rej = r.lines.reduce((a, l) => a + l.rejected, 0);
      const alt = r.lines.reduce((a, l) => a + l.alter, 0);
      return {
        key: t.key, color: r.status === 'CANCELLED' ? 'gray' : 'green', icon: <InboxOutlined />,
        title: <Text type="secondary">{fmtDate(t.at)} · receipt {r.receiptNo} · DC {r.vendorDcNo}</Text>,
        content: <Text delete={r.status === 'CANCELLED'}>{STAGE_LABEL[r.stage]}: {fmtQty(good)} good, {fmtQty(rej)} rejected, {fmtQty(alt)} handed back for alteration</Text>,
      };
    }
    if (t.kind === 'PULLBACK') {
      return {
        key: t.key, color: 'purple', icon: <SwapOutlined />,
        title: <Text type="secondary">{fmtDate(t.at)} · {t.pullBack.pbNo} · {t.by}</Text>,
        content: <Text>Pull-back {PULLBACK_ACTION[t.action] || t.action}{t.comment ? ` — ${t.comment}` : ''}</Text>,
      };
    }
    return {
      key: t.key, color: 'gray', icon: <NotificationOutlined />,
      title: <Text type="secondary">{fmtDate(t.at)} · {t.by}</Text>,
      content: <Text>{t.text}</Text>,
    };
  }), [timeline, stages, latestEntryId, canDelete, onDeleteLatest, deleting]);
  return <Timeline items={items} />;
});

export default JobTimeline;
