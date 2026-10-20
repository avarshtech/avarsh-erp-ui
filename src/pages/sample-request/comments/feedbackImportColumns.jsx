import { Checkbox, Tag, Typography } from 'antd';

const { Text } = Typography;

const CONFIDENCE_TAG = {
  HIGH: { color: 'green', label: 'High' },
  MEDIUM: { color: 'gold', label: 'Medium — mapped' },
  LOW: { color: 'orange', label: 'Low — please confirm' },
  UNMAPPED: { color: 'red', label: 'Unmapped' },
};

/**
 * The review table on the comment-sheet import: one row per extracted value,
 * with where it came from and how sure the extractor was.
 *
 * Unmapped rows cannot be ticked — there is no field on the form to put them
 * in — but they are still shown, because a value the buyer wrote down should
 * never disappear just because nothing here fits it.
 */
const feedbackImportColumns = (ticked, setTicked) => [
  {
    title: 'Use',
    key: 'use',
    width: 50,
    render: (_, r) => (
      <Checkbox
        checked={Boolean(ticked[r.key])}
        disabled={r.confidence === 'UNMAPPED'}
        onChange={(e) => setTicked((s) => ({ ...s, [r.key]: e.target.checked }))}
      />
    ),
  },
  { title: 'Target field', dataIndex: 'label', key: 'label', width: 170 },
  {
    title: 'Extracted value',
    dataIndex: 'value',
    key: 'value',
    ellipsis: true,
    render: (v) => (Array.isArray(v) ? v.map((x) => <Tag key={x}>{x.replace(/_/g, ' ')}</Tag>) : String(v)),
  },
  {
    title: 'Source in file',
    dataIndex: 'sourceRef',
    key: 'sourceRef',
    width: 220,
    ellipsis: true,
    render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
  },
  {
    title: 'Confidence',
    dataIndex: 'confidence',
    key: 'confidence',
    width: 165,
    // An unrecognised confidence reads as "please confirm" rather than blowing up
    render: (c) => {
      const cfg = CONFIDENCE_TAG[c] || CONFIDENCE_TAG.LOW;
      return <Tag color={cfg.color} style={{ whiteSpace: 'nowrap' }}>{cfg.label}</Tag>;
    },
  },
];

export default feedbackImportColumns;
