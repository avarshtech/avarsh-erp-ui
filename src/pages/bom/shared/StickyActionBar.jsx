import { memo } from 'react';
import { Alert } from 'antd';

/**
 * Bottom action bar that stays visible while a long requirement screen scrolls.
 * `summary` sits on the left (live totals), the buttons (children) on the right, and
 * `errors` — blocking messages from the last Save / Submit — above both.
 */
const StickyActionBar = memo(function StickyActionBar({ summary, errors = [], children }) {
  return (
    <div
      role="region"
      aria-label="Actions"
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 20,
        marginTop: 16,
        padding: '10px 16px',
        background: 'var(--card-bg, #fff)',
        borderTop: '1px solid var(--border-color, #f0f0f0)',
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.06)',
        borderRadius: 8,
      }}
    >
      {errors.length > 0 && (
        <Alert
          type="error"
          showIcon
          title={errors.length === 1 ? errors[0] : `${errors.length} issues to fix before continuing`}
          description={errors.length > 1 ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          ) : undefined}
          style={{ marginBottom: 10 }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
          {summary}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>
      </div>
    </div>
  );
});

export default StickyActionBar;
