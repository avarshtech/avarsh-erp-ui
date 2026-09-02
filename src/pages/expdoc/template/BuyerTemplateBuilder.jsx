import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, App, Card, Result, Skeleton, Space, Tabs, Tag, Tooltip, Typography } from 'antd';
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
import {
  getTemplate, updateTemplate, publishTemplate, retireTemplate, newTemplateVersion,
  exportTemplateJson, getTemplateSample, listTemplateBuyers,
} from '../../../services/expdoc/expDocService';
import AckReasonModal from '../shared/AckReasonModal';
import useExporterBlock from '../shared/useExporterBlock';
import {
  TabIdentity, TabHeader, TabColumns, TabInvoice, TabSticker, TabRules,
} from './TemplateTabs';
import TplPreviewDrawer from './TplPreviewDrawer';
import TemplateCompareModal from './TemplateCompareModal';

const { Text } = Typography;
const LIST_PATH = '/export-docs/templates/list';
const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };

/** Which tabs a document type actually has — an invoice has no carton columns. */
const TABS_FOR = {
  [DOC_TYPE.PACKING_LIST]: ['identity', 'header', 'columns', 'rules'],
  [DOC_TYPE.INVOICE]: ['identity', 'header', 'invoice', 'rules'],
  [DOC_TYPE.STICKER]: ['identity', 'sticker', 'rules'],
};

const TAB_LABELS = {
  identity: 'Identity',
  header: 'Header & parties',
  columns: 'Columns & sheets',
  invoice: 'Lines, charges & declarations',
  sticker: 'Sticker faces',
  rules: 'Rules & formatting',
};

/**
 * Template builder.
 *
 * Tabs rather than steps, because configuring a layout is not a linear task. The
 * draft is edited locally and saved explicitly: a template is configuration, and
 * saving on every keystroke would make an accidental change indistinguishable from
 * an intended one.
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
  const [tab, setTab] = useState('identity');
  const [buyers, setBuyers] = useState([]);
  const [sample, setSample] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [reasonCfg, setReasonCfg] = useState(null);
  const exporter = useExporterBlock();

  const canUpdate = hasPermission(EXPDOC_MODULE.TEMPLATES, 'update');
  const canPublish = hasPermission(EXPDOC_MODULE.TEMPLATES, 'publish');

  const dirty = Boolean(draft);
  useUnsavedChanges(dirty);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTemplate(id);
      setTpl(data);
      setDraft(null);
      setTab((t) => ((TABS_FOR[data.docType] || []).includes(t) ? t : 'identity'));
    } catch (e) {
      setLoadError(e.message || 'Failed to load the template');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { listTemplateBuyers().then(setBuyers).catch(() => setBuyers([])); }, []);

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
      message.error(e.message || 'The change could not be saved');
      return null;
    } finally {
      setSaving(false);
    }
  }, [message]);

  const save = useCallback(
    () => (draft ? run(() => updateTemplate(tpl.id, { ...draft, version: tpl.version }), 'Saved') : Promise.resolve(null)),
    [draft, tpl, run],
  );

  const openPreview = useCallback(async () => {
    try {
      // Previewing the SAVED draft: an unsaved edit is not yet part of the template,
      // and previewing it would show a layout no document could ever resolve.
      if (draft) await save();
      const s = await getTemplateSample(tpl.id);
      setSample(s);
      setPreviewOpen(true);
    } catch (e) {
      message.error(e.message || 'Could not build a preview');
    }
  }, [draft, save, tpl, message]);

  const handleExport = useCallback(async () => {
    try {
      const json = await exportTemplateJson(tpl.id);
      // Clipboard rather than a download: the viewer sandbox blocks page-initiated
      // saves, and a support hand-off is a paste more often than a file anyway.
      await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
      message.success('Template JSON copied to the clipboard');
    } catch {
      message.error('Could not copy the template JSON. Check clipboard permissions.');
    }
  }, [tpl, message]);

  const actions = useMemo(() => {
    if (!working) return null;
    const list = [];
    const isDraft = working.status === TEMPLATE_STATUS.DRAFT;

    if (isDraft && canUpdate) {
      list.push(<ActionButton key="save" action="save" text="Save" loading={saving} disabled={!dirty} onClick={save} />);
    }
    if (isDraft && canPublish) {
      list.push(
        <Tooltip key="publish" title="Publishing makes this the active template and retires the previous version for the same buyer.">
          <span>
            <ActionButton
              action="approve"
              text="Publish"
              disabled={dirty}
              onClick={() => modal.confirm({
                title: `Publish ${working.templateCode} v${working.version}?`,
                content: 'Every new document for this buyer will use it. The previous active version is retired in the same step, and documents already approved keep the version they were built on.',
                okText: 'Publish',
                onOk: () => run(() => publishTemplate(working.id), 'Published'),
              })}
            />
          </span>
        </Tooltip>,
      );
    }
    if (working.status === TEMPLATE_STATUS.ACTIVE && canUpdate) {
      list.push(
        <Tooltip key="newver" title="A published template is frozen. Editing means a new version.">
          <span>
            <ActionButton
              action="edit"
              text="New version"
              onClick={async () => {
                const next = await run(() => newTemplateVersion(working.id), 'Draft version started');
                if (next) navigate(`/export-docs/templates/edit/${next.id}`);
              }}
            />
          </span>
        </Tooltip>,
      );
      if (canPublish) {
        list.push(
          <Tooltip key="retire" title={working.canRetire ? undefined : 'Documents still render from this version.'}>
            <span>
              <ActionButton
                action="cancel"
                text="Retire"
                disabled={!working.canRetire}
                onClick={() => setReasonCfg({
                  key: 'retire',
                  title: `Retire ${working.templateCode} v${working.version}?`,
                  label: 'Why is it being retired?',
                  context: {
                    title: 'This buyer will fall back to the generic layout',
                    message: 'Nothing else is active for this buyer and document type, so new documents will use the standard Indian export set.',
                  },
                  okText: 'Retire',
                  danger: true,
                  onSubmit: (reason) => run(() => retireTemplate(working.id, reason), 'Retired'),
                })}
              />
            </span>
          </Tooltip>,
        );
      }
    }
    if ((working.versions || []).length > 1) {
      list.push(<ActionButton key="cmp" action="history" text="Compare versions" onClick={() => setCompareOpen(true)} />);
    }
    list.push(<ActionButton key="json" action="custom" text="Copy JSON" onClick={handleExport} />);
    list.push(<ActionButton key="prev" action="print" text="Preview" onClick={openPreview} />);
    return list;
  }, [working, dirty, saving, canUpdate, canPublish, save, run, modal, navigate, handleExport, openPreview]);

  if (loadError) {
    return (
      <Result
        status="warning"
        title="Template could not be opened"
        subTitle={loadError}
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

  const locked = working.status !== TEMPLATE_STATUS.DRAFT || !canUpdate;
  const props = { tpl: working, patch, locked, buyers };
  const bodies = {
    identity: <TabIdentity {...props} />,
    header: <TabHeader {...props} />,
    columns: <TabColumns {...props} />,
    invoice: <TabInvoice {...props} />,
    sticker: <TabSticker {...props} />,
    rules: <TabRules {...props} />,
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={`${working.templateCode} v${working.version}`}
        subtitle={`${DOC_TYPE_LABELS[working.docType]} · ${working.buyerCode || 'generic'}${working.subClientCode ? ` / ${working.subClientCode}` : ''}`}
        onBack={() => navigate(LIST_PATH)}
        status={(
          <Space size={6} wrap>
            <StatusTag status={working.status} config={TEMPLATE_STATUS_CONFIG} labels={TEMPLATE_STATUS_LABELS} />
            {working.hasNewerVersion && <Tag color="gold">{`v${working.latestVersion} exists`}</Tag>}
            {working.usage?.total > 0 && <Tag>{`${working.usage.total} document(s) render from this`}</Tag>}
          </Space>
        )}
        style={STICKY_HEADER}
      >
        <Space wrap>{actions}</Space>
      </PageHeader>

      {locked && working.status !== TEMPLATE_STATUS.DRAFT && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={`v${working.version} is ${working.status.toLowerCase()} and cannot be edited`}
          description="Published templates are frozen so documents built on them keep rendering the same layout. Start a new version to make changes."
        />
      )}

      {working.unknownBindings?.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${working.unknownBindings.length} binding(s) are not in the field catalogue`}
          description={(
            <Space orientation="vertical" size={2}>
              <Text>{working.unknownBindings.join(', ')}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                These render blank. Pick a catalogued field, or use fixed text if the ERP has no such field.
              </Text>
            </Space>
          )}
        />
      )}

      {dirty && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Unsaved changes" description="Save before previewing or publishing." />
      )}

      <Card>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={(TABS_FOR[working.docType] || []).map((k) => ({
            key: k,
            label: TAB_LABELS[k],
            children: bodies[k],
          }))}
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

      <TplPreviewDrawer open={previewOpen} sample={sample} exporter={exporter} onClose={() => setPreviewOpen(false)} />
      {/* Keyed so it remounts on each open: `destroyOnHidden` destroys AntD's inner
          content but not this component, so its lazy version defaults would
          otherwise be whatever the template was at first mount. */}
      <TemplateCompareModal
        key={`cmp-${working.id}-${compareOpen}`}
        open={compareOpen}
        template={working}
        onCancel={() => setCompareOpen(false)}
      />
    </div>
  );
};

export default BuyerTemplateBuilder;
