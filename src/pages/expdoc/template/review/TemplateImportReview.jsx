import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Badge, Button, Col, Drawer, Result, Row, Segmented, Space, Tabs, Tag, Tooltip, Typography,
} from 'antd';
import {
  CheckCircleFilled, FileSearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../../components/PageHeader';
import { ActionButton } from '../../../../components/buttons';
import useUnsavedChanges from '../../../../hooks/useUnsavedChanges';
import { hasPermission } from '../../../../utils/permissions';
import { DOC_TYPE_LABELS, EXPDOC_MODULE } from '../../../../utils/expDocConstants';
import {
  saveUploadedTemplates, publishTemplate, listStickerBuyers,
} from '../../../../services/expdoc/expDocService';
import useExporterBlock from '../../shared/useExporterBlock';
import TemplateEditor from '../editor/TemplateEditor';
import TemplatePrintPreview from '../TemplatePrintPreview';
import StickyUntilEnd from '../StickyUntilEnd';
import useExportBuyers from '../useExportBuyers';
import SourcePane from './SourcePane';
import ReviewDocument from './ReviewDocument';
import {
  draftsFromResult, blockingIssues, extractionMetaOf, addMissedPatch,
} from './reviewModel';
import {
  attentionItems, answerKeys, readerNotes, removeElementPatch, bindElementPatch,
} from './attentionModel';
import {
  getImportDraft, saveImportDocuments, attachImportFile, clearImportDraft,
} from './importDraftStore';

const { Text } = Typography;
const LIST_PATH = '/export-docs/templates/list';
const GLOBAL_ALERT = { ERROR: 'error', WARN: 'warning' };

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The layout editor's two views: beside the live print preview (the default), or alone. */
const EDITOR_VIEW = { SPLIT: 'split', EDITOR: 'editor' };
const EDITOR_VIEWS = [
  { value: EDITOR_VIEW.SPLIT, label: 'Editor + preview' },
  { value: EDITOR_VIEW.EDITOR, label: 'Editor only' },
];

/**
 * Check the templates read from an uploaded buyer document, before anything is saved.
 *
 * One page, one document at a time: its name, what needs the user in plain words with
 * one-click answers, and how it will print with sample data — which follows every
 * change. The uploaded file opens beside the page when asked for; "Edit layout in
 * detail", beside the print preview, opens the full editor — next to a live preview
 * that stays in view, or on its own. A workbook holding a packing list AND an invoice
 * becomes two templates, each on its own tab; either can be left out.
 */
const TemplateImportReview = () => {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [upload, setUpload] = useState(() => getImportDraft());
  const result = upload?.result;
  const [docs, setDocs] = useState(() => upload?.documents || draftsFromResult(result, upload || {}));
  const [activeUid, setActiveUid] = useState(() => docs[0]?.uid);
  const [dismissed, setDismissed] = useState(() => new Set());
  // `opened` counts the openings: each one starts the file view afresh, on its citation or its sheet.
  const [source, setSource] = useState({ open: false, evidence: null, sheet: null, opened: 0 });
  const [editor, setEditor] = useState({ open: false, tab: null });
  const [editorView, setEditorView] = useState(EDITOR_VIEW.SPLIT);
  const [saving, setSaving] = useState(null);
  const { buyers } = useExportBuyers();
  const stickerBuyers = useMemo(() => listStickerBuyers(), []);
  const exporter = useExporterBlock();
  const canPublish = hasPermission(EXPDOC_MODULE.TEMPLATES, 'publish');
  const { clearDirty } = useUnsavedChanges(Boolean(result));

  useEffect(() => { if (docs.length) saveImportDocuments(docs); }, [docs]);

  const active = docs.find((d) => d.uid === activeUid) || docs[0];
  const update = useCallback((uid, fn) => setDocs((list) => list.map((d) => (d.uid === uid ? fn(d) : d))), []);
  const patch = useCallback((changes) => {
    if (active) update(active.uid, (d) => ({ ...d, template: { ...d.template, ...changes } }));
  }, [active, update]);
  /** An answered item leaves the list, with whatever else the answer settles. */
  const answer = useCallback((docUid, item) => setDismissed((s) => {
    const next = new Set(s);
    answerKeys(docUid, item).forEach((k) => next.add(k));
    return next;
  }), []);
  const showInFile = useCallback((evidence) => setSource((s) => ({
    open: true, evidence, sheet: null, opened: s.opened + 1,
  })), []);

  const attention = useMemo(() => Object.fromEntries(docs.map((d) => [d.uid, attentionItems({ draft: d, result, dismissed })])),
    [docs, result, dismissed]);
  const included = docs.filter((d) => d.include);
  const blockers = included.flatMap((d) => blockingIssues(d)
    .map((b) => `${d.template.name || DOC_TYPE_LABELS[d.template.docType]}: ${b.text}`));
  const globalFindings = (result?.findings || []).filter((f) => f.document == null);
  const notices = globalFindings.filter((f) => GLOBAL_ALERT[f.severity]);
  const infos = globalFindings.filter((f) => !GLOBAL_ALERT[f.severity]);

  const save = async (publish) => {
    if (!included.length) { message.warning('Every document is left out — choose "Create it after all" on at least one.'); return; }
    if (blockers.length) { message.error(blockers[0]); return; }
    setSaving(publish ? 'publish' : 'draft');
    try {
      const payload = included.map((d) => ({ ...d.template, extractionMeta: extractionMetaOf(d, result) }));
      const { templates, sourceStored } = await saveUploadedTemplates(payload, upload.file || null);
      let published = 0;
      if (publish) {
        for (const t of templates) {
          try {
            await publishTemplate(t);
            published += 1;
          } catch (e) {
            message.error(`${t.templateCode} was saved as a draft but not published: ${e.message}`);
          }
        }
      }
      clearDirty();
      clearImportDraft();
      message.success(publish
        ? `${templates.length} template(s) saved, ${published} published`
        : `${templates.length} template draft(s) saved`);
      if (upload.file && !sourceStored) message.warning('Saved — but the original document could not be stored, so it cannot be downloaded later.');
      const buyerId = templates[0]?.buyerId;
      navigate(`${LIST_PATH}?buyer=${buyerId != null ? `buyer:${buyerId}` : 'standard'}&highlight=${templates.map((t) => t.id).join(',')}`);
    } catch (e) {
      if (!e.isOptimisticLockConflict) message.error(e.message || 'The templates could not be saved');
    } finally {
      setSaving(null);
    }
  };

  const discard = () => modal.confirm({
    title: 'Discard this reading?',
    content: 'Nothing has been saved. You can upload the document again later.',
    okText: 'Discard', okButtonProps: { danger: true },
    onOk: () => { clearDirty(); clearImportDraft(); navigate(LIST_PATH); },
  });

  /** The uploaded file, on the sheet of the document being checked. */
  const viewFile = () => setSource((s) => ({
    open: true, evidence: null, sheet: String(active?.where || '').split('!')[0], opened: s.opened + 1,
  }));
  const openEditor = (tab) => setEditor({ open: true, tab: tab || null });
  const closeEditor = () => setEditor({ open: false, tab: null });

  if (!result) {
    return (
      <Result status="info" title="Nothing to review"
        subTitle="Upload a buyer's document from the template register to read it into a template."
        extra={<Button type="primary" onClick={() => navigate(LIST_PATH)}>Go to the templates</Button>} />
    );
  }

  const fileName = upload.fileName || result.fileName;
  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Check the new templates"
        subtitle={`${fileName} · ${upload.buyerName || 'no buyer chosen'}${result.detectedBuyerName ? ` · reads as ${result.detectedBuyerName}` : ''}`}
        onBack={discard}
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <Space wrap>
          <Button icon={<FileSearchOutlined />} onClick={viewFile}>View uploaded file</Button>
          <ActionButton action="cancel" text="Discard" onClick={discard} />
          <Tooltip title={blockers[0]}>
            <span>
              <ActionButton action="save" text={`Save ${included.length > 1 ? `${included.length} drafts` : 'as draft'}`}
                loading={saving === 'draft'} disabled={Boolean(saving) || !included.length || blockers.length > 0}
                onClick={() => save(false)} />
            </span>
          </Tooltip>
          {canPublish && (
            <ActionButton action="approve" text="Save & publish" loading={saving === 'publish'}
              disabled={Boolean(saving) || !included.length || blockers.length > 0} onClick={() => save(true)} />
          )}
        </Space>
      </PageHeader>

      {notices.map((f) => (
        <Alert key={`${f.code}-${f.message}`} type={GLOBAL_ALERT[f.severity]} showIcon style={{ marginBottom: 12 }} title={f.message} />
      ))}
      <Text style={{ display: 'block', marginBottom: 12 }}>
        {`We found ${count(docs.length, 'document', 'documents')} in ${fileName}. Check each one, then save — nothing is saved until you do.`}
      </Text>
      {infos.length > 0 && (
        <Alert
          type="info" showIcon style={{ marginBottom: 12 }} title="Notes from the reader"
          description={<ul style={{ margin: 0, paddingInlineStart: 18 }}>{infos.map((f) => <li key={`${f.code}-${f.message}`}>{f.message}</li>)}</ul>}
        />
      )}

      <Tabs
        activeKey={active?.uid}
        onChange={setActiveUid}
        items={docs.map((d) => {
          const left = attention[d.uid].length;
          let state = <Text type="success"><CheckCircleFilled aria-label="Ready" /></Text>;
          if (!d.include) state = <Tag style={{ marginInlineEnd: 0 }}>Left out</Tag>;
          else if (left) state = <Badge count={left} color="gold" size="small" />;
          return {
            key: d.uid,
            label: <Space size={6}><span>{DOC_TYPE_LABELS[d.template.docType]}</span>{state}</Space>,
          };
        })}
      />

      {active && (
        <ReviewDocument
          key={active.uid}
          draft={active}
          docCount={docs.length}
          items={attention[active.uid]}
          notes={readerNotes(active, result)}
          exporter={exporter}
          onPatch={patch}
          onInclude={(include) => update(active.uid, (d) => ({ ...d, include }))}
          onBind={(item, binding) => { patch(bindElementPatch(active.template, item.elementId, binding)); answer(active.uid, item); }}
          onRemove={(item) => patch(removeElementPatch(active.template, item.elementId))}
          onDismiss={(item) => answer(active.uid, item)}
          onAddLeftOver={(item, as) => { patch(addMissedPatch(active.template, item.text, as)); answer(active.uid, item); }}
          onShowInFile={showInFile}
          onOpenEditor={openEditor}
        />
      )}

      <Drawer
        open={source.open}
        onClose={() => setSource((s) => ({ ...s, open: false }))}
        size="75%"
        zIndex={1100}
        title={`Your uploaded file — ${fileName}`}
      >
        <SourcePane
          key={source.opened}
          result={result}
          fileUrl={upload.fileUrl}
          fileName={fileName}
          evidence={source.evidence}
          defaultSheet={source.sheet}
          onAttachFile={(file) => setUpload(attachImportFile(file))}
        />
      </Drawer>
      {/* The editor beside a live preview: every change shows in the page as it is made. */}
      <Drawer
        open={editor.open && Boolean(active)}
        onClose={closeEditor}
        size="100%"
        title={`Edit layout in detail — ${active?.template.name || DOC_TYPE_LABELS[active?.template.docType] || ''}`}
        extra={(
          <Space wrap>
            <Segmented aria-label="Editor view" options={EDITOR_VIEWS} value={editorView} onChange={setEditorView} />
            <Button icon={<FileSearchOutlined />} onClick={viewFile}>View uploaded file</Button>
            <Button type="primary" onClick={closeEditor}>Done</Button>
          </Space>
        )}
        destroyOnHidden
      >
        {active && (
          // Stretched columns, so the preview has the whole row to stay in view along.
          <Row gutter={16} align="stretch">
            <Col xs={24} lg={editorView === EDITOR_VIEW.SPLIT ? 13 : 24}>
              <TemplateEditor
                key={`${active.uid}-${editor.tab || 'start'}`}
                tpl={active.template}
                patch={patch}
                locked={false}
                codeEditable
                meta={active.meta}
                onEvidence={showInFile}
                buyers={buyers}
                stickerBuyers={stickerBuyers}
                defaultTab={editor.tab || undefined}
              />
            </Col>
            {editorView === EDITOR_VIEW.SPLIT && (
              <Col xs={24} lg={11}>
                <StickyUntilEnd>
                  <TemplatePrintPreview
                    key={active.uid}
                    template={active.template}
                    exporter={exporter}
                    zoomable
                    frameHeight="calc(100vh - 250px)"
                  />
                </StickyUntilEnd>
              </Col>
            )}
          </Row>
        )}
      </Drawer>
    </div>
  );
};

export default TemplateImportReview;
