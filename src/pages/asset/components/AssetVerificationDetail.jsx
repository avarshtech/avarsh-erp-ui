import { Tag } from 'antd';
import dayjs from 'dayjs';
import { conditionMeta, verificationResultMeta } from '../../../utils/assetConstants';

const stamp = (v) => (v ? dayjs(v).format('DD-MM-YYYY HH:mm') : null);

/**
 * One row of a run, in full.
 *
 * <p>What somebody wrote down when they found a machine somewhere it should not
 * be is the whole value of the count, and the remarks had no column at all -
 * captured by the dialog, stored by the server, sent in the DTO, and shown
 * nowhere. The list can hold a location and a tag; it cannot hold a sentence
 * about a machine with its guard missing.</p>
 *
 * <p>It also states the comparison the result came from, side by side. "Found
 * elsewhere" means nothing without both places in view.</p>
 */
/** Where it turned up, or why there is no answer to that. */
const foundAt = (row, movedAway) => {
  if (row.result === 'PENDING') return <span style={{ opacity: 0.5 }}>Not checked yet</span>;
  if (row.result === 'NOT_FOUND') return <span style={{ opacity: 0.5 }}>Nobody found it</span>;
  return (
    <>
      {row.actualLocationText || '-'}
      {movedAway && <Tag color="orange" style={{ marginInlineStart: 6 }}>Different</Tag>}
    </>
  );
};

const AssetVerificationDetail = ({ row }) => {
  const result = verificationResultMeta(row.result);
  const checked = stamp(row.verifiedAt);
  // Both answers come from the server rather than being worked out again here.
  // It compares places, not strings - trimmed, spacing collapsed, case set
  // aside - and a browser recomputing it with !== would disagree on exactly the
  // invisible differences the rule exists to absorb.
  const movedAway = row.locationDiffers;
  const conditionChanged = row.conditionDiffers;

  return (
    <div className="asset-log-detail">
      <div className="asset-log-main">
        <div className="asset-log-block">
          <span className="asset-log-label">Remarks</span>
          <p>{row.remarks || <em>Nothing was written down.</em>}</p>
        </div>
        <div className="asset-log-block">
          <span className="asset-log-label">What the run found</span>
          <p>
            {row.result === 'PENDING'
              ? <em>Nobody has reached this one yet.</em>
              : (
                <>
                  {result.label}
                  {conditionChanged && row.result !== 'CONDITION_CHANGED'
                    && ', and its condition differs as well'}
                  . Nothing on the asset itself was changed.
                </>
              )}
          </p>
        </div>
      </div>

      <dl className="asset-log-facts">
        <dt>Register says it is at</dt>
        <dd>{row.expectedLocationText || '-'}</dd>

        <dt>Found at</dt>
        <dd>
          {foundAt(row, movedAway)}
        </dd>

        <dt>Condition</dt>
        <dd>
          <Tag color={conditionMeta(row.expectedCondition).color}>
            {conditionMeta(row.expectedCondition).label}
          </Tag>
          {conditionChanged && (
            <>
              <span style={{ opacity: 0.45 }}>&rarr;</span>
              <Tag color={conditionMeta(row.actualCondition).color} style={{ marginInlineStart: 6 }}>
                {conditionMeta(row.actualCondition).label}
              </Tag>
            </>
          )}
        </dd>

        <dt>Serial no.</dt>
        <dd>{row.serialNo || <span style={{ opacity: 0.5 }}>Not recorded</span>}</dd>

        <dt>Checked</dt>
        <dd>{checked ?? <span style={{ opacity: 0.5 }}>Not yet</span>}</dd>
      </dl>
    </div>
  );
};

export default AssetVerificationDetail;
