import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Alert, App, Card, Result, Skeleton, Space, Tag, Tooltip, Typography,
} from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import { ActionButton } from '../../../components/buttons';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import { hasPermission } from '../../../utils/permissions';
import {
  EXPDOC_MODULE, DOC_TYPE, DOC_TYPE_LABELS, TEMPLATE_STATUS, TEMPLATE_STATUS_LABELS,
} from '../../../utils/expDocConstants';
import { TEMPLATE_STATUS_CONFIG } from '../../../utils/statusConfig';
import { unknownBindingsOf, unboundLabelsOf } from '../../../utils/expDocTemplateSchema';
import {
  getTemplate, updateTemplate, publishTemplate, retireTemplate, newTemplateVersion,
  getTemplateSample,
} from '../../../services/expdoc/expDocService';
import { downloadStoredFile } from '../../../services/core/fileService';
import AckReasonModal from '../shared/AckReasonModal';
import useExporterBlock from '../shared/useExporterBlock';
import TemplateEditor from './editor/TemplateEditor';
import TplPreviewOverlay from './TplPreviewOverlay';
import TemplateCompareModal from './TemplateCompareModal';
import TemplateCreateModal from './TemplateCreateModal';
import useExportBuyers from './useExportBuyers';

const { Text } = Typography;
const LIST_PATH = '/export-docs/templates/list';
const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };

/**
 * Template builder.
 *
 * The draft is edited locally and saved explicitly: a template is configuration, and
 * saving on every keystroke would make an accidental change indistinguishable from an
 * intended one. Every template is saved to the API. A built-in standard layout opens
 * read-only.
 */
const BuyerTemplateBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();

  const [tpl, setTpl] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sample, setSample] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [reasonCfg, setReasonCfg] = useState(null);
  const exporter = useExporterBlock();
  const { buyers } = useExportBuyers();

  const canAdd = hasPermission(EXPDOC_MODULE.TEMPLATES, 'add');
  const canUpdate = hasPermission(EXPDOC_MODULE.TEMPLATES, 'update');
  const canPublish = hasPermission(EXPDOC_MODULE.TEMPLATES, 'publish');

  const dirty = Boolean(draft);
  useUnsavedChanges(dirty);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setTpl(await getTemplate(id));
      setDraft(null);
    } catch (e) {
      setLoadError(e.message || 'Failed to load the template');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const working = useMemo(() => (draft ? { ...tpl, ...draft } : tpl), [tpl, draft]);
  const patch = useCallback((changes) => setDraft((d) => ({ ...(d || {}), ...changes })), []);

  const run = useCallback(async (fn, successMsg) => {
    setSaving(true);
    try {
      const next = await fn();
      setTpl(next);
      setDraft(null);
      if (successMsg) message.success(successMsg);
      return next;
    } catch (e) {
      if (!e.isOptimisticLockConflict) message.error(e.message || 'The change could not be saved');
      return null;
    } finally {
      setSaving(false);
    }
  }, [message]);

  // The save adopts the returned row, so its fresh lock version is what the next save sends.
  const save = useCallback(() => (draft ? run(() => updateTemplate({ ...tpl, ...draft }), 'Saved') : Promise.resolve(null)),
    [draft, tpl, run]);

  const openPreview = useCallback(async () => {
    try {
      // The working copy, unsaved edits included: the preview is where they are checked.
      setSample(await getTemplateSample(working));
      setPreviewOpen(true);
    } catch (e) {
      message.error(e.message || 'Could not build a preview');
    }
  }, [working, message]);

  const downloadSource = useCallback(() => {
    downloadStoredFile({ fileId: working.sourceFileId, originalFilename: working.sourceFileName })
      .catch(() => message.error('The original document could not be downloaded. It may no longer be in storage.'));
  }, [working, message]);

  const actions = useMemo(() => {
    if (!working) return null;
    const list = [];
    const isDraft = working.status === TEMPLATE_STATUS.DRAFT;

    if (working.isSystem) {
      if (canAdd) list.push(<ActionButton key="clone" action="add" text="Use as a starting point" onClick={() => setCloneOpen(true)} />);
    }
    if (isDraft && canUpdate) {
      list.push(<ActionButton key="save" action="save" text="Save" loading={saving} disabled={!dirty} onClick={save} />);
    }
    if (isDraft && canPublish) {
      list.push(
        <Tooltip key="publish" title={dirty ? 'Save first' : undefined}>
          <span>
            <ActionButton
              action="approve" text="Publish" disabled={dirty}
              onClick={() => modal.confirm({
                title: `Publish ${working.templateCode} v${working.version}?`,
                content: working.docType === DOC_TYPE.STICKER
                  ? 'Sticker runs can then print with it. An earlier active version of THIS template is retired in the same step; the buyer\'s other sticker templates are not touched, and a packing list that printed with the earlier version prints its next run with this one.'
                  : 'New packing lists / invoices can then use it. An earlier active version of THIS template is retired in the same step; the buyer\'s other templates are not touched, and documents already made keep the layout they were made with.',
                okText: 'Publish',
                onOk: () => run(() => publishTemplate(working), 'Published'),
              })}
            />
          </span>
        </Tooltip>,
      );
    }
    if (working.status === TEMPLATE_STATUS.ACTIVE && canUpdate && !working.isSystem) {
      list.push(
        <Tooltip key="newver" title={working.hasDraft ? 'This template already has a draft version' : 'A published template is frozen. Editing means a new version.'}>
          <span>
            <ActionButton
              action="edit" text="New version" disabled={working.hasDraft}
              onClick={async () => {
                const next = await run(() => newTemplateVersion(working), 'Draft version started');
                if (next) navigate(`/export-docs/templates/edit/${next.id}`);
              }}
            />
          </span>
        </Tooltip>,
      );
      list.push(
        <ActionButton
          key="retire" action="cancel" text="Retire"
          onClick={() => setReasonCfg({
            key: 'retire',
            title: `Retire ${working.templateCode} v${working.version}?`,
            label: 'Why is it being retired?',
            context: {
              title: 'New documents can no longer pick this version',
              message: 'Documents already made keep the layout they were made with. If this was the buyer\'s only template of this kind, new documents fall back to the standard layout.',
            },
            okText: 'Retire',
            danger: true,
            onSubmit: (reason) => run(() => retireTemplate(working, reason), 'Retired'),
          })}
        />,
      );
    }
    if ((working.versions || []).length > 1) {
      list.push(<ActionButton key="cmp" action="history" text="Compare versions" onClick={() => setCompareOpen(true)} />);
    }
    list.push(<ActionButton key="prev" action="print" text="Preview" onClick={openPreview} />);
    return list;
  }, [working, dirty, saving, canAdd, canUpdate, canPublish, save, run, modal, navigate, openPreview]);

  if (loadError) {
    return (
      <Result
        status="warning" title="Template could not be opened" subTitle={loadError}
        extra={<ActionButton action="back" text="Back to templates" onClick={() => navigate(LIST_PATH)} />}
      />
    );
  }
  if (loading || !working) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="Document template" style={STICKY_HEADER} />
        <Skeleton active paragraph={{ rows: 10 }} style={{ marginTop: 16 }} />
      </div>
    );
  }

  const locked = working.status !== TEMPLATE_STATUS.DRAFT || !canUpdate || working.isSystem;
  const unknown = unknownBindingsOf(working);
  const unbound = unboundLabelsOf(working);
  const buyerLabel = working.buyerName || 'any buyer';

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={`${working.templateCode} v${working.version}`}
        subtitle={`${working.name} · ${DOC_TYPE_LABELS[working.docType]} · ${buyerLabel}`}
        onBack={() => navigate(LIST_PATH)}
        status={(
          <Space size={6} wrap>
            <StatusTag status={working.status} config={TEMPLATE_STATUS_CONFIG} labels={TEMPLATE_STATUS_LABELS} />
            {working.isSystem && <Tag color="blue">Built-in standard layout</Tag>}
            {working.hasNewerVersion && <Tag color="gold">{`v${working.latestVersion} exists`}</Tag>}
            {working.usage?.total > 0 && <Tag>{`${working.usage.total} document(s) made with this`}</Tag>}
            {working.sourceFileName && (
              <Tooltip title="Download the document this template was read from">
                <Tag icon={<FileTextOutlined />} style={{ cursor: 'pointer' }} role="button" tabIndex={0}
                  onClick={downloadSource}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); downloadSource(); } }}>
                  {`Read from ${working.sourceFileName}`}
                </Tag>
              </Tooltip>
            )}
          </Space>
        )}
        style={STICKY_HEADER}
      >
        <Space wrap>{actions}</Space>
      </PageHeader>

      {locked && !working.isSystem && working.status !== TEMPLATE_STATUS.DRAFT && (
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          title={`v${working.version} is ${working.status.toLowerCase()} and cannot be edited`}
          description="Published templates are frozen so documents made with them keep the same layout. Start a new version to make changes."
        />
      )}
      {working.isSystem && (
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          title="The built-in standard layout"
          description="Documents use it when their buyer has no template of the kind. It cannot be edited here; use it as the starting point for a buyer's own template."
        />
      )}
      {unknown.length > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          title={`${unknown.length} binding(s) are not in the field catalogue`}
          description={`${unknown.join(', ')} — these print blank. Pick a catalogued field, or use fixed text.`}
        />
      )}
      {unbound.length > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          title={`${unbound.length} field(s) have no data source`}
          description={(
            <Text>{`${unbound.slice(0, 8).join(', ')}${unbound.length > 8 ? ' …' : ''} — they print their label with an empty value until you bind them to a field or fixed text.`}</Text>
          )}
        />
      )}
      {dirty && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Unsaved changes" description="Save before publishing. Preview shows them already." />
      )}

      <Card>
        <TemplateEditor
          key={working.id}
          tpl={working}
          patch={patch}
          locked={locked}
          meta={working.extractionMeta?.elementMeta}
          buyers={buyers}
        />
      </Card>

      <AckReasonModal
        key={reasonCfg?.key || 'none'}
        open={Boolean(reasonCfg)}
        title={reasonCfg?.title}
        label={reasonCfg?.label}
        context={reasonCfg?.context}
        okText={reasonCfg?.okText}
        danger={reasonCfg?.danger}
        confirming={saving}
        onCancel={() => setReasonCfg(null)}
        onSubmit={async (reason) => {
          const cfg = reasonCfg;
          setReasonCfg(null);
          await cfg.onSubmit(reason);
        }}
      />

      <TplPreviewOverlay open={previewOpen} sample={sample} exporter={exporter} onClose={() => setPreviewOpen(false)} />
      {/* Keyed so it remounts on each open: its lazy version defaults would otherwise be
          whatever the template was at first mount. */}
      <TemplateCompareModal key={`cmp-${working.id}-${compareOpen}`} open={compareOpen} template={working} onCancel={() => setCompareOpen(false)} />
      <TemplateCreateModal
        open={cloneOpen}
        source={working.isSystem ? working : null}
        buyers={buyers}
        onCancel={() => setCloneOpen(false)}
        onCreated={(t) => { setCloneOpen(false); navigate(`/export-docs/templates/edit/${t.id}`); }}
      />
    </div>
  );
};

export default BuyerTemplateBuilder;
