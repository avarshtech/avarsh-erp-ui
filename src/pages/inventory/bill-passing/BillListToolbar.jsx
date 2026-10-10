import { Col, DatePicker, Input, Row, Segmented, Select, Space, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { ActionButton } from '../../../components/buttons';
import { billSourceOf } from '../../../utils/jobWorkBillConstants';
import { LIST_VIEW, QUICK_FILTER_OPTIONS, SOURCE_OPTIONS, STATUS_OPTIONS } from './billListConstants';

const { RangePicker } = DatePicker;

/**
 * The list's controls. The source picks which bills (supplier, job-work, or both); the Lines register is the
 * supplier bills' own, so it is offered only where supplier bills are shown. While the job-work bills run on
 * demo data the toolbar says so and offers a reset.
 */
const BillListToolbar = ({ state, set, partyOptions, poOptions, showDemo, resetting, onResetDemo }) => {
  const { view, source, quickFilter, searchText, party, po, status, invoiceRange } = state;
  const linesAllowed = source === 'ALL' || source === 'SUPPLIER_PO';
  const isBills = view === LIST_VIEW.BILLS || !linesAllowed;
  const partyLabel = source === 'ALL' ? 'Supplier / Vendor' : billSourceOf(source).party;
  return (
    <>
      <Space wrap style={{ marginBottom: 12, justifyContent: 'space-between', width: '100%' }}>
        <Segmented options={SOURCE_OPTIONS} value={source} onChange={set.source} />
        {showDemo && (
          <Space size={8}>
            <Tag color="orange">Job-work bills: demo data</Tag>
            <ActionButton action="refresh" text="Reset demo data" size="small" loading={resetting} onClick={onResetDemo} />
          </Space>
        )}
      </Space>
      <Space wrap style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        {linesAllowed ? <Segmented options={[LIST_VIEW.BILLS, LIST_VIEW.LINES]} value={view} onChange={set.view} /> : <span />}
        {isBills && <Segmented options={QUICK_FILTER_OPTIONS} value={quickFilter} onChange={set.quickFilter} />}
      </Space>
      {/* Spans total 24 in each view so the row fills the card. */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8} lg={isBills ? 6 : 10}>
          <Input
            name="billSearch"
            placeholder={isBills ? 'Search bill no, party, invoice no, PO...' : 'Search PO, supplier, item, GRN...'}
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => set.searchText(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={isBills ? 4 : 7}>
          <Select id="billPartyFilter" placeholder={partyLabel} style={{ width: '100%' }} allowClear showSearch
            optionFilterProp="label" options={partyOptions} value={party} onChange={set.party} />
        </Col>
        <Col xs={24} sm={12} md={8} lg={isBills ? 4 : 7}>
          <Select id="billPoFilter" placeholder="Purchase Order" style={{ width: '100%' }} allowClear showSearch
            optionFilterProp="label" options={poOptions} value={po} onChange={set.po} />
        </Col>
        {isBills && (
          <Col xs={24} sm={12} md={8} lg={4}>
            <Select id="billStatusFilter" placeholder="Status" style={{ width: '100%' }} allowClear
              options={STATUS_OPTIONS} value={status} onChange={set.status} />
          </Col>
        )}
        {isBills && (
          <Col xs={24} sm={24} md={16} lg={6}>
            <RangePicker id="billInvoiceRange" style={{ width: '100%' }} placeholder={['Invoice From', 'Invoice To']}
              format="DD-MMM-YYYY" value={invoiceRange} onChange={set.invoiceRange} allowClear />
          </Col>
        )}
      </Row>
    </>
  );
};

export default BillListToolbar;
