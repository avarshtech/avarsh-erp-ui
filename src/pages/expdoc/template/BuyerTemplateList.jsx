import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Alert, App, Col, Row, Skeleton, Space, Typography,
} from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { hasPermission } from '../../../utils/permissions';
import { EXPDOC_MODULE } from '../../../utils/expDocConstants';
import { TEMPLATE_SOURCE } from '../../../utils/expDocSystemTemplates';
import {
  listAllTemplates, getTemplate, deleteTemplate, getTemplateSample, stickerTemplateConflicts,
} from '../../../services/expdoc/expDocService';
import useExporterBlock from '../shared/useExporterBlock';
import TemplateCreateModal from './TemplateCreateModal';
import TplPreviewDrawer from './TplPreviewDrawer';
import TemplateBuyerRail from './TemplateBuyerRail';
import TemplateBuyerPanel from './TemplateBuyerPanel';
import TemplateUploadModal from './upload/TemplateUploadModal';
import useExportBuyers from './useExportBuyers';
import { groupTemplatesByBuyer, RAIL_KEY } from './registerModel';

const { Text } = Typography;

/**
 * Buyer document templates, by buyer.
 *
 * A buyer's packing list and invoice are uploaded (PDF or Excel) and read into drafts,
 * or built by copying the nearest layout. A buyer may keep several of each — sea and
 * air, one per end customer — and staff pick one when they make a document.
 */
const BuyerTemplateList = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [params, setParams] = useSearchParams();
  const { buyers, loading: buyersLoading } = useExportBuyers();
  const exporter = useExporterBlock();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState([]);
  const [createCfg, setCreateCfg] = useState(null);
  const [uploadCfg, setUploadCfg] = useState(null);
  const [sample, setSample] = useState(null);

  const canAdd = hasPermission(EXPDOC_MODULE.TEMPLATES, 'add');
  const canDelete = hasPermission(EXPDOC_MODULE.TEMPLATES, 'delete');

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      setTemplates(await listAllTemplates({ force }));
      setConflicts(stickerTemplateConflicts());
    } catch (e) {
      message.error(e.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(true); }, [load]);

  const groups = useMemo(() => groupTemplatesByBuyer(templates, buyers), [templates, buyers]);
  const highlightIds = useMemo(() => (params.get('highlight') || '').split(',').filter(Boolean), [params]);

  const selectedKey = useMemo(() => {
    const wanted = params.get('buyer');
    if (wanted && groups.some((g) => g.key === wanted)) return wanted;
    return groups.find((g) => !g.standard && !g.demo && g.counts.total > 0)?.key || RAIL_KEY.STANDARD;
  }, [params, groups]);
  const selected = groups.find((g) => g.key === selectedKey) || null;

  const select = useCallback((key) => setParams({ buyer: key }, { replace: true }), [setParams]);

  const open = useCallback((t) => navigate(`/export-docs/templates/edit/${t.id}`), [navigate]);

  const preview = useCallback(async (t) => {
    try {
      // Register rows from the API carry no layout; the preview needs the full template.
      const full = t.source === TEMPLATE_SOURCE.API ? await getTemplate(t.id) : t;
      setSample(await getTemplateSample(full));
    } catch (e) {
      message.error(e.message || 'Could not build a preview');
    }
  }, [message]);

  const copy = useCallback(async (t) => {
    try {
      const full = t.source === TEMPLATE_SOURCE.API ? await getTemplate(t.id) : t;
      setCreateCfg({ source: full, defaultBuyerId: selected?.buyerId });
    } catch (e) {
      message.error(e.message || 'Could not open the template');
    }
  }, [message, selected]);

  const remove = useCallback(async (t) => {
    try {
      await deleteTemplate(t);
      message.success(`${t.templateCode} v${t.version} deleted`);
      load(true);
    } catch (e) {
      message.error(e.message || 'Failed to delete the template');
    }
  }, [message, load]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Buyer Document Templates"
        subtitle="Each buyer's own packing list and invoice layouts — read from the buyer's document or copied from the nearest one"
      />

      {conflicts.length > 0 && (
        <Alert
          type="error" showIcon style={{ marginBottom: 16 }}
          title={`${conflicts.length} buyer(s) have more than one active carton-sticker template`}
          description={(
            <Space orientation="vertical" size={2}>
              {conflicts.map((c) => (
                <Text key={c.key}>{`${c.key.replace(/\|/g, ' · ')} — ${c.templates.map((t) => `${t.templateCode} v${t.version}`).join(' and ')}`}</Text>
              ))}
              <Text type="secondary" style={{ fontSize: 12 }}>Stickers still resolve automatically; retire all but one.</Text>
            </Space>
          )}
        />
      )}

      {loading && !templates.length ? <Skeleton active paragraph={{ rows: 8 }} /> : (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8} xl={6}>
            {buyersLoading && !buyers.length
              ? <Skeleton active paragraph={{ rows: 6 }} />
              : <TemplateBuyerRail groups={groups} selectedKey={selectedKey} onSelect={select} />}
          </Col>
          <Col xs={24} md={16} xl={18}>
            <TemplateBuyerPanel
              group={selected}
              highlightIds={highlightIds}
              canAdd={canAdd}
              canDelete={canDelete}
              onUpload={(g, docTypeHint) => setUploadCfg({ buyerId: g.buyerId ?? null, docTypeHint })}
              onNew={(g) => setCreateCfg({ source: null, defaultBuyerId: g.buyerId })}
              onOpen={open}
              onPreview={preview}
              onCopy={copy}
              onDelete={remove}
            />
          </Col>
        </Row>
      )}

      <TemplateCreateModal
        open={Boolean(createCfg)}
        source={createCfg?.source || null}
        defaultBuyerId={createCfg?.defaultBuyerId}
        templates={templates}
        buyers={buyers}
        onCancel={() => setCreateCfg(null)}
        onCreated={(t) => { setCreateCfg(null); open(t); }}
      />
      <TemplateUploadModal
        key={uploadCfg ? `upload-${uploadCfg.buyerId ?? 'any'}-${uploadCfg.docTypeHint || 'AUTO'}` : 'upload-closed'}
        open={Boolean(uploadCfg)}
        buyers={buyers}
        defaultBuyerId={uploadCfg?.buyerId}
        defaultDocType={uploadCfg?.docTypeHint}
        onCancel={() => setUploadCfg(null)}
        onRead={() => { setUploadCfg(null); navigate('/export-docs/templates/import'); }}
        onManual={(buyerId) => setCreateCfg({ source: null, defaultBuyerId: buyerId })}
      />
      <TplPreviewDrawer open={Boolean(sample)} sample={sample} exporter={exporter} onClose={() => setSample(null)} />
    </div>
  );
};

export default BuyerTemplateList;
