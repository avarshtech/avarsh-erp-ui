import { memo } from 'react';
import { Tag } from 'antd';
import { CalendarOutlined, FieldTimeOutlined, ShopOutlined, TagsOutlined } from '@ant-design/icons';
import DocumentHero from '../../../components/DocumentHero';
import StatusTag from '../../../components/StatusTag';
import { JOB_WORK_PO_STATUS_CONFIG } from '../../../utils/statusConfig';
import { jobWorkPoStatusLabel } from '../../../utils/jobWorkPoStatus';
import { statusAccent } from '../../../utils/statusAccent';
import { formatDate } from '../../../utils/formatters';

const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The top of a job-work PO screen in the Supplier PO view's look (DocumentHero): an accent border in the status colour,
 * the title with its status, process and revision tags, the subtitle, a meta row (job worker, PO date, due date,
 * orders) and the PO's value on the right, with the page's actions under it. `typeLabel` "Cut Panel PO" /
 * "Garment Process PO"; `total` and `totalLabel` the figure the PO states; `dueDate` its expected delivery date.
 */
const JobWorkPoHero = memo(function JobWorkPoHero({ doc, typeLabel, subtitle, total, totalLabel, dueDate, onBack, actions }) {
  const orders = [...new Set(doc.lines.map((l) => l.orderNo).filter(Boolean))];
  const process = doc.process?.label ?? doc.process?.name ?? doc.lines[0]?.processLabel;
  const hero = {
    title: doc.poNo ? `${typeLabel} ${doc.poNo}` : `New ${typeLabel}`,
    accentColor: statusAccent(JOB_WORK_PO_STATUS_CONFIG, doc.status),
    status: <StatusTag status={doc.status} config={JOB_WORK_PO_STATUS_CONFIG} getLabel={jobWorkPoStatusLabel} />,
    tags: [
      process && <Tag key="process" color="purple" style={{ borderRadius: 20 }}>{process}</Tag>,
      doc.revisionNo > 0 && <Tag key="rev" style={{ borderRadius: 20 }}>R{doc.revisionNo}</Tag>,
    ].filter(Boolean),
    subtitle,
    meta: [
      doc.vendor?.name && { icon: <ShopOutlined />, text: doc.vendor.name },
      doc.poDate && { icon: <CalendarOutlined />, text: `PO date ${formatDate(doc.poDate)}` },
      dueDate && { icon: <FieldTimeOutlined />, text: `Due ${formatDate(dueDate)}` },
      orders.length > 0 && { icon: <TagsOutlined />, text: orders.join(', ') },
    ].filter(Boolean),
    highlight: doc.lines.length ? { label: totalLabel, value: inr(total) } : null,
  };
  return <DocumentHero page hero={hero} onBack={onBack} actions={actions} />;
});

export default JobWorkPoHero;
