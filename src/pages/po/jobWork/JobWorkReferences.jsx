import { memo, useState } from 'react';
import { Button, Input, Space, Tag, Typography } from 'antd';
import { LinkOutlined, PlusOutlined } from '@ant-design/icons';

const { Text } = Typography;
const isUrl = (v) => /^https?:\/\/\S+$/i.test(String(v || '').trim());

/**
 * Reference documents — artwork, placement sheet, strike-off — linked, never uploaded
 * (CPP FR-22). Where the process marks artwork as required, one must be linked before the
 * PO goes to the vendor (VR-17). The API phase links the style's Costing tech-pack files (D9).
 */
const JobWorkReferences = memo(function JobWorkReferences({ references = [], editable, required, onChange }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const add = () => {
    onChange([...references, { title: title.trim() || url.trim(), url: url.trim() }]);
    setTitle('');
    setUrl('');
  };
  return (
    <div>
      <Space size={[6, 6]} wrap style={{ marginBottom: editable ? 8 : 0 }}>
        {references.map((r, i) => (
          <Tag key={`${r.url}-${i}`} icon={<LinkOutlined />} closable={editable}
            onClose={(e) => { e.preventDefault(); onChange(references.filter((_, j) => j !== i)); }}>
            <a href={r.url} target="_blank" rel="noreferrer noopener">{r.title}</a>
          </Tag>
        ))}
        {!references.length && (
          <Text type={required ? 'warning' : 'secondary'}>
            {required ? 'This process needs an artwork or placement reference before the PO is sent.' : 'No reference linked.'}
          </Text>
        )}
      </Space>
      {editable && (
        <Space.Compact style={{ width: '100%' }}>
          <Input name="refTitle" aria-label="Reference title" placeholder="Title, e.g. Front print artwork" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '40%' }} />
          <Input name="refUrl" aria-label="Reference link" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} status={url && !isUrl(url) ? 'error' : undefined} />
          <Button icon={<PlusOutlined />} disabled={!isUrl(url)} onClick={add}>Link</Button>
        </Space.Compact>
      )}
    </div>
  );
});

export default JobWorkReferences;
