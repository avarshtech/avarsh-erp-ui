import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Badge, Button, Card, Checkbox, Col, Result, Row, Space, Tabs, Tag, Tooltip, Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../../components/PageHeader';
import { ActionButton } from '../../../../components/buttons';
import useUnsavedChanges from '../../../../hooks/useUnsavedChanges';
import { hasPermission } from '../../../../utils/permissions';
import { DOC_TYPE_LABELS, EXPDOC_MODULE } from '../../../../utils/expDocConstants';
import {
  saveUploadedTemplates, publishTemplate, getTemplateSample, listStickerBuyers,
} from '../../../../services/expdoc/expDocService';
import useExporterBlock from '../../shared/useExporterBlock';
import TemplateEditor from '../editor/TemplateEditor';
import TplPreviewDrawer from '../TplPreviewDrawer';
import useExportBuyers from '../useExportBuyers';
import SourcePane from './SourcePane';
import ExtractionFindings from './ExtractionFindings';
import {
  draftsFromResult, blockingIssues, extractionMetaOf, addMissedPatch,
} from './reviewModel';
import {
  getImportDraft, saveImportDocuments, attachImportFile, clearImportDraft,
} from './importDraftStore';

const { Text } = Typography;
const LIST_PATH = '/export-docs/templates/list';
const GLOBAL_ALERT = { ERROR: 'error', WARN: 'warning', INFO: 'info' };

/**
 * Review what the AI read from an uploaded buyer document, before anything is saved.
 *
 * The document sits beside the template: every row carries the cell or page it came
 * from, rows whose label is not in the document are marked, and text no row accounts
 * for is listed with a way to add it. A workbook with a packing list AND an invoice
 * becomes two templates, each with its own tab; untick one to leave it out.
 */
const TemplateImportReview = () => {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [upload, setUpload] = useState(() => getImportDraft());
  const result = upload?.result;
  const [docs, setDocs] = useState(() => upload?.documents || draftsFromResult(result, upload || {}));
  const [activeUid, setActiveUid] = useState(() => docs[0]?.uid);
  const [evidence, setEvidence] = useState(null);
  const [dismissed, setDismissed] = useState(() => new Set());
  const [saving, setSaving] = useState(null);
  const [sample, setSample] = useState(null);
  const { buyers } = useExportBuyers();
  const stickerBuyers = useMemo(() => listStickerBuyers(), []);
  const exporter = useExporterBlock();
  const canPublish = hasPermission(EXPDOC_MODULE.TEMPLATES, 'publish');
  const { clearDirty } = useUnsavedChanges(Boolean(result));

  useEffect(() => { if (docs.length) saveImportDocuments(docs); }, [docs]);

  const active = docs.find((d) => d.uid === activeUid) || docs[0];
  const patch = useCallback((changes) => setDocs((list) => list.map((d) => (d.uid === active?.uid
    ? { ...d, template: { ...d.template, ...changes } } : d))), [active]);
  const included = docs.filter((d) => d.include);
  const blockers = included.flatMap((d) => blockingIssues(d).map((m) => `${d.template.name || DOC_TYPE_LABELS[d.template.docType]}: ${m}`));
  const globalFindings = (result?.findings || []).filter((f) => f.document == null);

  const save = async (publish) => {
    if (!included.length) { message.warning('Tick at least one document to save.'); return; }
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

  const preview = async () => {
    try { setSample(await getTemplateSample(active.template)); } catch (e) { message.error(e.message || 'Could not build a preview'); }
  };

  if (!result) {
    return (
      <Result status="info" title="Nothing to review"
        subTitle="Upload a buyer's document from the template register to read it into a template."
        extra={<Button type="primary" onClick={() => navigate(LIST_PATH)}>Go to the templates</Button>} />
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Review the reading"
        subtitle={`${result.fileName} · ${upload.buyerName || 'no buyer chosen'}${result.detectedBuyerName ? ` · reads as ${result.detectedBuyerName}` : ''}`}
        onBack={discard}
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <Space wrap>
          <ActionButton action="cancel" text="Discard" onClick={discard} />
          {docs.length > 0 && <ActionButton action="print" text="Preview" onClick={preview} />}
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

      {globalFindings.map((f) => (
        <Alert key={`${f.code}-${f.message}`} type={GLOBAL_ALERT[f.severity] || 'info'} showIcon style={{ marginBottom: 12 }} title={f.message} />
      ))}
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Nothing is saved yet"
        description="Check each row against the document on the left — click a cell or page tag to see where it came from. Saved templates are drafts until published." />

      {docs.length > 0 && (
        <Tabs
          activeKey={active?.uid}
          onChange={setActiveUid}
          items={docs.map((d) => ({
            key: d.uid,
            label: (
              <Space size={6}>
                <Checkbox checked={d.include} aria-label={`Save ${DOC_TYPE_LABELS[d.template.docType]}`}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDocs((list) => list.map((x) => (x.uid === d.uid ? { ...x, include: e.target.checked } : x)))} />
                <span>{DOC_TYPE_LABELS[d.template.docType]}</span>
                {d.where && <Tag style={{ marginInlineEnd: 0 }}>{d.where}</Tag>}
                {blockingIssues(d).length > 0 && d.include && <Badge status="error" />}
              </Space>
            ),
          }))}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <SourcePane
            result={result}
            fileUrl={upload.fileUrl}
            fileName={upload.fileName || result.fileName}
            evidence={evidence}
            onAttachFile={(file) => setUpload(attachImportFile(file))}
          />
        </Col>
        <Col xs={24} xl={14}>
          {active ? (
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              {!active.include && <Alert type="warning" showIcon title="Left out — this document will not be saved" />}
              <Card>
                <TemplateEditor
                  key={active.uid}
                  tpl={active.template}
                  patch={patch}
                  locked={false}
                  codeEditable
                  meta={active.meta}
                  onEvidence={setEvidence}
                  buyers={buyers}
                  stickerBuyers={stickerBuyers}
                />
              </Card>
              <ExtractionFindings
                result={result}
                docIndex={active.index}
                template={active.template}
                dismissed={dismissed}
                onDismiss={(key) => setDismissed((s) => new Set(s).add(key))}
                onEvidence={setEvidence}
                onAddMissed={(m, as) => patch(addMissedPatch(active.template, m.text, as))}
              />
            </Space>
          ) : (
            <Card><Text type="secondary">The reader found no packing list or invoice in this file.</Text></Card>
          )}
        </Col>
      </Row>

      <TplPreviewDrawer open={Boolean(sample)} sample={sample} exporter={exporter} onClose={() => setSample(null)} />
    </div>
  );
};

export default TemplateImportReview;
