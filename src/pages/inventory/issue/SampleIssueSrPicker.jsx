import { useMemo } from 'react';
import { Select, Tag } from 'antd';

/**
 * The "which sample request" control both sample issue forms open with.
 *
 * It lists Submitted AND In Production requests: fabric and trims are separate
 * documents, so the second one is always raised against a request that the
 * first already moved into production.
 */
const SampleIssueSrPicker = ({ srs = [], value, onChange, disabled = false }) => {
  const options = useMemo(() => srs.map((r) => ({
    value: r.id,
    // Searched against, so the storekeeper can type a style or a buyer too
    name: `${r.srNo} ${r.styleNo || ''} ${r.garmentName || ''} ${r.buyerName || ''} ${r.sampleTypeName || ''}`,
    label: (
      // alignItems centres the tag against the text — without it the tag
      // stretches to the control height and its label rides high
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.srNo} · {r.styleNo} — {r.buyerName}
        </span>
        <Tag color="purple" style={{ marginInlineEnd: 0, flexShrink: 0 }}>{r.sampleTypeName}</Tag>
      </span>
    ),
  })), [srs]);

  return (
    <Select
      showSearch
      style={{ width: '100%' }}
      placeholder="Select a sample request"
      value={value}
      onChange={onChange}
      disabled={disabled}
      optionFilterProp="name"
      options={options}
    />
  );
};

export default SampleIssueSrPicker;
