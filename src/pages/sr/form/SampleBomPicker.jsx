import { useState, useEffect } from 'react';
import { Card, Select, Typography, Alert, Space, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { searchBoms } from '../../../services/bom/bomService';
import StatusTag from '../../../components/StatusTag';
import SampleOrderTag from '../../../components/SampleOrderTag';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import useSampleOrderNos from '../../../hooks/useSampleOrderNos';
import { BOM_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getStatusLabel } from '../../../utils/bomConstants';

const { Text, Title } = Typography;

// Most-recent slice loaded up front; typing re-queries the server so BOMs
// beyond this window are still reachable.
const PAGE_SIZE = 50;

/**
 * Bare "/sample-requests/new" entry: pick the BOM to raise the SR against.
 * ALL BOMs are listed, not just SAMPLE-order ones — a PP/fit sample is raised
 * against the bulk order's BOM, and only the user knows which BOM a given
 * sample belongs to. Sample orders are badged so they stay easy to spot.
 * After a pick the dropdown itself carries the inline loading state and the
 * form page renders only once BOM + Order have resolved — no skeleton flash.
 */
const SampleBomPicker = ({ onPick, resolving = false, pickedBomId = null }) => {
  const { setSearchText, debouncedSearch } = useDebouncedSearch();
  const { isSampleOrder } = useSampleOrderNos();
  // Results carry the term they answer, so "loading" is derived rather than a
  // second state set synchronously inside the effect.
  const [result, setResult] = useState({ term: null, boms: [] });
  const listLoading = result.term !== debouncedSearch;
  const boms = result.boms;

  useEffect(() => {
    let cancelled = false;
    searchBoms({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      page: 0,
      size: PAGE_SIZE,
      sort: 'id',
      direction: 'desc',
    })
      .then((res) => { if (!cancelled) setResult({ term: debouncedSearch, boms: res.content || [] }); })
      .catch(() => { if (!cancelled) setResult({ term: debouncedSearch, boms: [] }); });
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  return (
    <Card style={{ maxWidth: 640, margin: '40px auto' }}>
      <Title level={5} style={{ marginTop: 0 }}>Select the BOM</Title>
      <Text type="secondary">
        A Sample Request tracks a sample through dispatch and buyer approval. Pick the BOM it
        should be raised against — any BOM, sample or bulk, since PP and fit samples are made
        against the bulk order&apos;s BOM. Materials auto-populate from the BOM you pick.
      </Text>
      <div style={{ marginTop: 16 }}>
        <Select
          showSearch
          filterOption={false}
          onSearch={setSearchText}
          placeholder="Search BOMs by order no, style or buyer…"
          style={{ width: '100%' }}
          value={pickedBomId || undefined}
          loading={listLoading || resolving}
          disabled={resolving}
          suffixIcon={resolving ? <LoadingOutlined spin /> : undefined}
          notFoundContent={listLoading ? <Spin size="small" /> : 'No BOMs match that search'}
          options={boms.map((b) => ({
            value: b.id,
            label: `${b.orderNo || `BOM #${b.id}`} · ${b.styleName || '—'} · ${b.buyerName || '—'}`,
            bom: b,
          }))}
          optionRender={(opt) => (
            <Space direction="vertical" size={0}>
              <Space size={4}>
                <Text strong>{opt.data.bom.orderNo || `BOM #${opt.data.bom.id}`}</Text>
                {isSampleOrder(opt.data.bom.orderNo) && <SampleOrderTag style={{ marginInline: 0 }} />}
                <StatusTag
                  status={opt.data.bom.status}
                  config={BOM_STATUS_CONFIG}
                  getLabel={getStatusLabel}
                  size="small"
                  style={{ marginInlineEnd: 0 }}
                />
              </Space>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {[opt.data.bom.styleName, opt.data.bom.buyerName, opt.data.bom.season,
                  `${opt.data.bom.lineCount || 0} lines`].filter(Boolean).join(' · ')}
              </Text>
            </Space>
          )}
          onChange={(bomId, opt) => onPick({ bomId, orderNo: opt?.bom?.orderNo || undefined })}
        />
        {resolving && (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            <LoadingOutlined spin style={{ marginInlineEnd: 6 }} />
            Loading BOM &amp; order — auto-populating the sample request…
          </Text>
        )}
      </div>
      {!listLoading && !resolving && boms.length === 0 && !debouncedSearch && (
        <Alert
          style={{ marginTop: 16 }}
          type="info"
          showIcon
          message="No BOMs yet"
          description="Create an order and give it a BOM first (BOM → Create BOM). The Sample Request can then be raised against that BOM, from here or from the BOM screen."
        />
      )}
    </Card>
  );
};

export default SampleBomPicker;
