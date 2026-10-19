import { Tag } from 'antd';
import dayjs from 'dayjs';

const date = (v) => (v ? dayjs(v).format('DD-MM-YYYY') : '-');
const stamp = (v) => (v ? dayjs(v).format('DD-MM-YYYY HH:mm') : null);

/** Who held the spanner, and whether they are on the payroll. */
const workerOf = (row) => {
  if (row.doneByName) return { name: row.doneByName, kind: 'In-house' };
  const vendor = row.vendorName || row.vendorText;
  return vendor ? { name: vendor, kind: 'Vendor' } : null;
};

/**
 * One maintenance job in full.
 *
 * <p>The table above is a list, and a list has no room for a paragraph. What
 * was done to a machine and what the mechanic noticed afterwards are the two
 * things somebody reads this log for, and both were being written into the
 * database and then shown nowhere - remarks had no column at all, and a
 * description longer than a few words was squeezed into a cell between two
 * dates.</p>
 */
const AssetMaintenanceDetail = ({ row }) => {
  const worker = workerOf(row);
  const closed = stamp(row.closedAt);

  return (
    <div className="asset-log-detail">
      <div className="asset-log-main">
        <div className="asset-log-block">
          <span className="asset-log-label">What was done / parts</span>
          <p>{row.description || <em>Nothing was written down.</em>}</p>
        </div>
        <div className="asset-log-block">
          <span className="asset-log-label">Remarks</span>
          <p>{row.remarks || <em>None.</em>}</p>
        </div>
      </div>

      <dl className="asset-log-facts">
        <dt>Done by</dt>
        <dd>
          {worker
            ? <>{worker.name} <Tag>{worker.kind}</Tag></>
            : <span style={{ opacity: 0.5 }}>Not recorded</span>}
        </dd>

        <dt>Logged</dt>
        <dd>{date(row.maintDate)}</dd>

        <dt>{closed ? 'Back in service' : 'Status'}</dt>
        <dd>{closed ?? <Tag color="orange">Still open</Tag>}</dd>

        <dt>Next due</dt>
        <dd>{row.nextDueDate ? date(row.nextDueDate) : <span style={{ opacity: 0.5 }}>Not scheduled</span>}</dd>
      </dl>
    </div>
  );
};

export default AssetMaintenanceDetail;
