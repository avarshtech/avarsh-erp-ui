import { Alert, Button, Col, Form, Row, Space, Spin } from 'antd';
import { useLocation, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import { QuickCreateProvider } from '../../../components/quickcreate/QuickCreateProvider';
import { COSTING_STATUS, getStatusLabel } from '../../../utils/costingConstants';
import { COSTING_STATUS_CONFIG } from '../../../utils/statusConfig';
import { CostingSheetProvider, useSheet } from './CostingSheetContext';
import HeaderStrip from './header/HeaderStrip';
import SheetActions from './header/SheetActions';
import SheetSections from './SheetSections';
import LivePricePanel from './price/LivePricePanel';
import StartFromBar from './start/StartFromBar';
import SheetDialogs from './SheetDialogs';
import CostingGenieBridge from './genie/CostingGenieBridge';
import useSheetShortcuts from './hooks/useSheetShortcuts';
import './costingSheet.css';

const FORM_DEFAULTS = { currency: 'INR', quoteCurrency: 'USD', costingType: 'FOB', pricingUnit: 'PIECE', sizes: [] };

function SheetLayout() {
  const { form, sheet, dispatch, meta, isNew, loading, localDraft, save } = useSheet();
  useSheetShortcuts({ saveDraft: save.saveDraft, undo: () => dispatch({ type: 'UNDO' }), canUndo: sheet.undo.length > 0 });
  const empty = Object.values(sheet.sections).every((rows) => rows.length === 0);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isNew ? 'Create Cost Sheet' : 'Edit Cost Sheet'}
        backPath="/costing/list"
        subtitle={meta.date ? meta.date.format('DD-MMM-YYYY') : undefined}
        status={meta.status && <StatusTag status={meta.status} config={COSTING_STATUS_CONFIG} getLabel={getStatusLabel} />}
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <SheetActions />
      </PageHeader>

      {meta.status === COSTING_STATUS.FINAL && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="Revising a submitted cost sheet"
          description="It is pending approval. Saving your changes reverts it to Draft and cancels the approval request — submit it again afterwards." />
      )}
      {localDraft.offer && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          title={`You have an unsaved costing from ${dayjs(localDraft.offer.at).format('DD MMM, HH:mm')}.`}
          action={<Space><Button size="small" type="primary" onClick={localDraft.restore}>Restore</Button><Button size="small" onClick={localDraft.discard}>Discard</Button></Space>} />
      )}

      <Spin spinning={loading}>
        <Row gutter={16} align="top">
          <Col xs={24} xl={17}>
            <Form form={form} layout="vertical" initialValues={FORM_DEFAULTS} onValuesChange={() => dispatch({ type: 'MARK_DIRTY' })}>
              <HeaderStrip />
            </Form>
            {isNew && empty && <StartFromBar />}
            <SheetSections />
          </Col>
          <Col xs={24} xl={7} style={{ marginTop: 16 }}>
            <LivePricePanel />
          </Col>
        </Row>
      </Spin>
      <SheetDialogs />
      <CostingGenieBridge />
    </div>
  );
}

/**
 * The one-page cost sheet (/costing/new, /costing/edit/:id). Each visit is its own instance —
 * except the first save of a new sheet, which carries its instance key into /costing/edit/:id so
 * the sheet stays exactly as it is (nothing typed meanwhile is lost, nothing is reloaded).
 */
export default function CostingSheetPage() {
  const { id } = useParams();
  const location = useLocation();
  const instanceKey = location.state?.instanceKey ?? (id ? `edit-${id}` : `new-${location.key}`);
  return (
    <QuickCreateProvider>
      <CostingSheetProvider key={instanceKey} instanceKey={instanceKey} id={id}>
        <SheetLayout />
      </CostingSheetProvider>
    </QuickCreateProvider>
  );
}
