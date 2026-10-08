import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Col, Row, Skeleton,
} from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { hasPermission } from '../../../utils/permissions';
import { EXPDOC_MODULE } from '../../../utils/expDocConstants';
import { TEMPLATE_SOURCE } from '../../../utils/expDocSystemTemplates';
import {
  listAllTemplates, getTemplate, deleteTemplate, getTemplateSample,
} from '../../../services/expdoc/expDocService';
import useExporterBlock from '../shared/useExporterBlock';
import TemplateCreateModal from './TemplateCreateModal';
import NewBuyerTemplateModal from './NewBuyerTemplateModal';
import TplPreviewOverlay from './TplPreviewOverlay';
import TemplateBuyerRail from './TemplateBuyerRail';
import TemplateBuyerPanel from './TemplateBuyerPanel';
import TemplateUploadModal from './upload/TemplateUploadModal';
import useExportBuyers from './useExportBuyers';
import { groupTemplatesByBuyer, RAIL_KEY } from './registerModel';

/**
 * Buyer document templates, by buyer.
 *
 * A buyer's packing list, invoice and carton sticker are uploaded and read into drafts,
 * or built by copying the nearest layout. A buyer may keep several of each — sea and
 * air, say — and staff pick one when they make a document or print stickers. A template
 * for any buyer starts from "New buyer template" in the header; the buyer's own panel
 * keeps its upload and new-template buttons for the buyer on screen.
 */
const BuyerTemplateList = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [params, setParams] = useSearchParams();
  const { buyers, loading: buyersLoading } = useExportBuyers();
  const exporter = useExporterBlock();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createCfg, setCreateCfg] = useState(null);
  const [uploadCfg, setUploadCfg] = useState(null);
  const [newBuyer, setNewBuyer] = useState({ open: false, seq: 0 });
  const [sample, setSample] = useState(null);

  const canAdd = hasPermission(EXPDOC_MODULE.TEMPLATES, 'add');
  const canDelete = hasPermission(EXPDOC_MODULE.TEMPLATES, 'delete');

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      setTemplates(await listAllTemplates({ force }));
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
    return groups.find((g) => !g.standard && g.counts.total > 0)?.key || RAIL_KEY.STANDARD;
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

  const closeNewBuyer = () => setNewBuyer((s) => ({ ...s, open: false }));

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
        subtitle="The packing list, invoice and carton sticker layouts each buyer wants — made from the buyer's own document, checked by you"
        onAdd={canAdd ? () => setNewBuyer((s) => ({ open: true, seq: s.seq + 1 })) : undefined}
        addLabel="New buyer template"
      />

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

      <NewBuyerTemplateModal
        key={`new-buyer-${newBuyer.seq}`}
        open={newBuyer.open}
        buyers={buyers}
        groups={groups}
        onCancel={closeNewBuyer}
        onUpload={(buyerId) => { closeNewBuyer(); setUploadCfg({ buyerId }); }}
        onCopy={(buyerId) => { closeNewBuyer(); setCreateCfg({ source: null, defaultBuyerId: buyerId }); }}
        onOpenTemplate={(t) => { closeNewBuyer(); open(t); }}
      />
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
      <TplPreviewOverlay open={Boolean(sample)} sample={sample} exporter={exporter} onClose={() => setSample(null)} />
    </div>
  );
};

export default BuyerTemplateList;
