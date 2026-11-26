import { memo } from 'react';
import { Card, Progress } from 'antd';
import EmptyState from '../../../components/EmptyState';

/**
 * Width, not only height. The dashboard drops these cards into flex columns, and
 * a Card is a plain block div: as a flex item it sizes to its content, so a card
 * holding one short bar rendered a quarter of its column wide and left the rest
 * of the row blank. Height keeps the three in a row level with each other.
 */
const CARD = { height: '100%', width: '100%' };

/**
 * One of the dashboard's charts, as a bar per row.
 *
 * Bars rather than a pie, and drawn with Progress rather than a charting
 * library: the module already renders its charts this way (see the inventory
 * dashboard), nobody can read a pie with eleven categories, and a bar carries
 * its own number without a legend to look across at.
 *
 * `colourOf` lets the status chart use the register's own status palette, so a
 * damaged bar is the same red as a damaged tag everywhere else.
 */
const AssetTallyChart = memo(function AssetTallyChart({
  title, rows = [], loading = false, colourOf, labelOf, emptyText = 'Nothing to show yet', onRowClick,
}) {
  // Scaled to the biggest bar, not to the total: with one category holding most
  // of the estate, scaling to the total leaves every other bar invisible.
  const widest = Math.max(...rows.map((r) => r.count), 1);

  return (
    <Card title={title} loading={loading} size="small" style={CARD}>
      {!loading && rows.length === 0 && <EmptyState title={emptyText} />}
      {rows.map((row) => {
        const label = labelOf ? labelOf(row.label) : row.label;
        return (
          <div
            key={row.label}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={{ marginBottom: 10, cursor: onRowClick ? 'pointer' : 'default' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, gap: 8 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label}
              </span>
              <strong>{row.count}</strong>
            </div>
            <Progress
              percent={Math.round((row.count / widest) * 100)}
              strokeColor={colourOf ? colourOf(row.label) : 'var(--primary-color)'}
              showInfo={false}
              size="small"
            />
          </div>
        );
      })}
    </Card>
  );
});

export default AssetTallyChart;
