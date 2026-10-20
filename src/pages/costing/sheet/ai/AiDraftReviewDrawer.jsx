import { useCallback, useState } from 'react';
import { Alert, App, Button, Card, Drawer, Empty, Flex, Input, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useQuickCreate } from '../../../../components/quickcreate/QuickCreateProvider';
import { useSheet } from '../CostingSheetContext';
import DraftHeaderPicks from './DraftHeaderPicks';
import DraftRowItem from './DraftRowItem';
import useAiCapture from './useAiCapture';
import useDraftApply from './useDraftApply';
import { SECTION_OF, canInclude, headerOffers, initialChoices, rowState } from './draftModel';

const { Text, Title } = Typography;
const GROUPS = [
  ['fabric', 'Fabric'], ['localTrim', 'Local trims'], ['importedTrim', 'Imported trims'],
  ['manufacturing', 'Manufacturing'], ['overhead', 'Overheads'],
];
const LANGUAGE = { en: 'English', ta: 'Tamil', 'ta-en': 'Tamil + English' };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Everything the AI read, for the user to check before any of it reaches the sheet: the
 * transcript (editable, and read again on request), the header values, and each line with the
 * master it links to. Lines already in the master are pre-linked, new materials are proposed
 * ready to create, and anything unsure is left unticked.
 */
export default function AiDraftReviewDrawer({ draft: firstDraft, onClose }) {
  const { message } = App.useApp();
  const { form, sheet, masters, styles } = useSheet();
  const { open } = useQuickCreate();
  const capture = useAiCapture();
  const { apply, busy, rowErrors } = useDraftApply();

  const context = useCallback(() => ({
    values: form.getFieldsValue(['buyerId', 'styleNo', 'sizes']),
    commercial: sheet.commercial,
    costingCurrency: form.getFieldValue('currency') || 'INR',
  }), [form, sheet.commercial]);
  const begin = useCallback((draft) => ({
    draft,
    choices: initialChoices(draft),
    picks: Object.fromEntries(headerOffers(draft.header, context()).map((o) => [o.key, !!o.on])),
    transcript: draft.transcript || '',
  }), [context]);
  const [review, setReview] = useState(() => begin(firstDraft));
  const { draft, choices, picks } = review;
  const rows = draft.rows || [];

  const setChoice = (ref, patch) => setReview((r) => ({ ...r, choices: { ...r.choices, [ref]: { ...r.choices[ref], ...patch } } }));
  const setHeader = (patch, pick) => setReview((r) => ({
    ...r, draft: { ...r.draft, header: { ...r.draft.header, ...patch } }, picks: { ...r.picks, [pick]: true },
  }));

  const readAgain = async () => {
    const next = await capture.read({ text: review.transcript });
    // The recording itself is still the source; the re-read only corrected the words.
    if (next) setReview(begin({ ...next, sourceFileIds: [...(draft.sourceFileIds || []), ...(next.sourceFileIds || [])] }));
  };

  const createMissing = (offer) => {
    if (offer.missing === 'buyer') {
      open('buyer', {
        prefill: { text: offer.text },
        onCreated: (buyer) => { masters.addBuyer(buyer); setHeader({ matchedBuyerId: buyer.id, matchedBuyerName: buyer.name }, 'buyer'); },
      });
      return;
    }
    const buyerId = draft.header?.matchedBuyerId || form.getFieldValue('buyerId');
    if (!buyerId) { message.info('Pick or create the buyer first — a style belongs to a buyer.'); return; }
    open('style', {
      prefill: { text: offer.text, buyerId, buyerName: masters.buyerOptions.find((b) => b.value === buyerId)?.label },
      onCreated: (style) => {
        if (buyerId === form.getFieldValue('buyerId')) styles.addStyle(style);
        setHeader({ matchedStyleId: style.id, styleNo: style.styleNo }, 'style');
      },
    });
  };

  const included = rows.filter((r) => choices[r.ref]?.include && canInclude(r, choices[r.ref]));
  const creating = included.filter((r) => rowState(r, choices[r.ref]) === 'create').length;
  const needYou = rows.filter((r) => !canInclude(r, choices[r.ref])).length;
  const anyHeader = Object.values(picks).some(Boolean);
  const applyText = creating ? `Create ${creating} new & add ${plural(included.length, 'line')}`
    : included.length ? `Add ${plural(included.length, 'line')}` : 'Apply header';

  const footer = (
    <Flex justify="space-between" align="center" gap={8} wrap>
      <Text type="secondary" style={{ fontSize: 12 }}>Nothing reaches the sheet until you apply — and Undo takes it back.</Text>
      <Flex gap={8}>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="primary" loading={busy} disabled={capture.busy || (!included.length && !anyHeader)}
          onClick={async () => { if (await apply(draft, choices, picks)) onClose(); }}>
          {applyText}
        </Button>
      </Flex>
    </Flex>
  );

  return (
    <Drawer open title="Check what the AI found" size={Math.min(720, window.innerWidth)} onClose={onClose} destroyOnHidden footer={footer}>
      {capture.error && <Alert type="error" showIcon closable title={capture.error} onClose={capture.clearError} style={{ marginBottom: 12 }} />}

      {(draft.transcript != null || review.transcript) && (
        <Card size="small" style={{ marginBottom: 12 }}
          title={<span>What the AI heard {LANGUAGE[draft.language] && <Tag>{LANGUAGE[draft.language]}</Tag>}</span>}
          extra={(
            <Button size="small" icon={<ReloadOutlined />} loading={capture.busy} disabled={!review.transcript.trim()} onClick={readAgain}>
              Read again
            </Button>
          )}>
          <Input.TextArea
            aria-label="Transcript" value={review.transcript} autoSize={{ minRows: 2, maxRows: 8 }}
            onChange={(e) => setReview((r) => ({ ...r, transcript: e.target.value }))}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>Fix a misheard word and read again.</Text>
        </Card>
      )}

      {draft.warnings?.length > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Worth a look"
          description={<ul style={{ margin: 0, paddingLeft: 18 }}>{draft.warnings.map((w) => <li key={w}>{w}</li>)}</ul>} />
      )}

      <DraftHeaderPicks offers={headerOffers(draft.header, context())} picks={picks} onCreate={createMissing}
        onToggle={(key, on) => setReview((r) => ({ ...r, picks: { ...r.picks, [key]: on } }))} />

      {rows.length === 0 ? (
        <Empty description="No costing lines were found. Add more detail and read again, or add the rows by hand." />
      ) : (
        <>
          <Text type="secondary">
            {plural(rows.length, 'line')} found — {rows.length - needYou} ready{creating ? ` (${creating} new to create)` : ''}
            {needYou ? `, ${needYou} need${needYou === 1 ? 's' : ''} a material picked or completed` : ''}.
          </Text>
          {GROUPS.map(([key, title]) => {
            const group = rows.filter((r) => SECTION_OF[r.section] === key);
            if (!group.length) return null;
            return (
              <section key={key} aria-label={title}>
                <Title level={5} style={{ marginTop: 16 }}>{title}</Title>
                <Flex vertical gap={12}>
                  {group.map((r) => (
                    <DraftRowItem key={r.ref} row={r} choice={choices[r.ref]} error={rowErrors[r.ref]}
                      onChange={(patch) => setChoice(r.ref, patch)} />
                  ))}
                </Flex>
              </section>
            );
          })}
        </>
      )}
    </Drawer>
  );
}
