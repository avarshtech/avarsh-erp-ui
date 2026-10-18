import { useState } from 'react';
import { App, Card, Col, Form, Input, Modal, Progress, Row, Select, Table, Tag, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import PermissionGuard from '../../components/PermissionGuard';
import RecordLink from '../../components/RecordLink';
import { ActionButton } from '../../components/buttons';
import useServerList from '../../hooks/useServerList';
import useAssetLookups from '../../hooks/useAssetLookups';
import useUrlFilters from '../../hooks/useUrlFilters';
import { getTablePagination } from '../../utils/paginationConfig';
import { getRuns, startRun } from '../../services/asset/verificationService';
import { toastUnlessHandled } from '../../utils/apiError';
import { VERIFICATION_STATUS } from '../../utils/assetConstants';

const fetchPage = ({ page, ...rest }) => getRuns({ ...rest, page: page - 1 });
const stamp = (v) => (v ? dayjs(v).format('DD-MM-YYYY HH:mm') : '-');

/** Verification runs: what has been counted, and what is being counted now. */
const AssetVerificationList = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const lookups = useAssetLookups();
  const fromUrl = useUrlFilters(['status', 'unitId'], { numeric: ['unitId'] });
  const list = useServerList(fetchPage, { status: undefined, unitId: undefined, ...fromUrl },
    'Could not load the verification runs');
  const [form] = Form.useForm();
  const [starting, setStarting] = useState(false);
  const [open, setOpen] = useState(false);

  const unitId = Form.useWatch('unitId', form);
  const departmentId = Form.useWatch('departmentId', form);
  const sectionId = Form.useWatch('sectionId', form);

  const begin = async (values) => {
    setStarting(true);
    try {
      const run = await startRun(values);
      message.success(`${run.runNo} started — ${run.total} assets to check`);
      navigate(`/assets/verification/${run.id}`);
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not start the run');
    } finally {
      setStarting(false);
    }
  };

  const openRun = (row) => navigate(`/assets/verification/${row.id}`);

  const columns = [
    {
      title: 'Run',
      dataIndex: 'runNo',
      width: 150,
      // The row opens too, so this stops the click rather than navigating twice.
      render: (v, row) => (
        <RecordLink
          text={v}
          onClick={(e) => { e?.stopPropagation?.(); openRun(row); }}
        />
      ),
    },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Scope', dataIndex: 'scopeText', width: 240 },
    {
      title: 'Checked',
      key: 'progress',
      width: 190,
      // Checked against expected: the number somebody walking the floor wants.
      // A bare percentage did not say what it was counting, so the count says
      // it - "7 / 12 machines" reads without a legend.
      render: (_, r) => {
        const pending = r.counts?.PENDING ?? 0;
        const done = Math.max(r.total - pending, 0);
        const percent = r.total ? Math.round((done / r.total) * 100) : 0;
        return (
          <Tooltip title={`${done} of ${r.total} checked, ${pending} still to find`}>
            <div>
              <Progress
                percent={percent}
                size="small"
                // Closing turns everything unchecked into Not found, so a
                // finished run never has pending rows - it is the missing ones
                // that make it an unhappy ending.
                status={r.status === 'CLOSED' && (r.counts?.NOT_FOUND ?? 0) > 0 ? 'exception' : undefined}
                showInfo={false}
              />
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                {r.total ? `${done} / ${r.total}` : 'nothing in scope'}
              </span>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: 'Needs attention',
      key: 'attention',
      width: 150,
      align: 'right',
      render: (_, r) => {
        const n = (r.counts?.LOCATION_MISMATCH ?? 0) + (r.counts?.CONDITION_CHANGED ?? 0)
          + (r.counts?.NOT_FOUND ?? 0) + (r.counts?.EXTRA ?? 0);
        return n > 0 ? <Tag color="orange">{n}</Tag> : <span style={{ opacity: 0.45 }}>none</span>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 130,
      render: (v) => <Tag color={VERIFICATION_STATUS[v]?.color}>{VERIFICATION_STATUS[v]?.label}</Tag>,
    },
    { title: 'Started', dataIndex: 'startedAt', width: 150, render: stamp },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Asset Verification"
        subtitle="Walking the floor to check the machines the register claims are really there"
        onBack={() => navigate('/assets')}
      >
        <PermissionGuard module="asset-verification" operation="add">
          <ActionButton action="create" text="Start a run" onClick={() => setOpen(true)} />
        </PermissionGuard>
      </PageHeader>

      <Card>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} md={5}>
            <Select
              placeholder="Status"
              allowClear
              style={{ width: '100%' }}
              value={list.filters.status}
              onChange={list.setFilter('status')}
              options={Object.entries(VERIFICATION_STATUS).map(([value, m]) => ({ value, label: m.label }))}
            />
          </Col>
          <Col xs={12} sm={8} md={5}>
            <Select
              placeholder="Unit"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              value={list.filters.unitId}
              onChange={list.setFilter('unitId')}
              options={lookups.options.units}
            />
          </Col>
        </Row>
        <Table
          columns={columns}
          dataSource={list.rows}
          loading={list.loading}
          rowKey="id"
          size="middle"
          scroll={{ x: 'max-content' }}
          // Every other list in this module opens from a row or an eye button
          // as well as the record number; this one had the number alone, a
          // small target with nothing to fall back on. Row click is what the
          // employee, bonus, invoice and shipment lists already do.
          onRow={(row) => ({ onClick: () => openRun(row), style: { cursor: 'pointer' } })}
          pagination={getTablePagination({ ...list.pagination, total: list.total }, 'runs')}
          onChange={list.onTableChange}
          locale={{
            emptyText: (
              <EmptyState
                title="No runs yet"
                description="Start one to check a unit, a department or a single line against the register."
              />
            ),
          }}
        />
      </Card>

      <Modal
        title="Start a verification run"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="Start"
        confirmLoading={starting}
        destroyOnHidden
      >
        <p style={{ marginTop: 0, opacity: 0.7 }}>
          The run lists everything the register expects in the scope, frozen as it is now. Narrow the
          scope as far as you intend to walk.
        </p>
        <Form form={form} layout="vertical" onFinish={begin}>
          <Form.Item name="name" label="Name this run" rules={[{ required: true, message: 'Give it a name' }]}>
            <Input maxLength={200} placeholder="e.g. Q3 sewing floor" />
          </Form.Item>
          <Form.Item name="unitId" label="Unit" rules={[{ required: true, message: 'Pick the unit' }]}>
            <Select showSearch optionFilterProp="label" options={lookups.options.units} placeholder="Select unit" />
          </Form.Item>
          <Form.Item name="departmentId" label="Department">
            <Select
              allowClear
              disabled={!unitId}
              showSearch
              optionFilterProp="label"
              options={lookups.departmentsOf(unitId)}
              placeholder={unitId ? 'Whole unit if left blank' : 'Pick a unit first'}
            />
          </Form.Item>
          <Form.Item name="sectionId" label="Section">
            <Select
              allowClear
              disabled={!departmentId}
              showSearch
              optionFilterProp="label"
              options={lookups.sectionsOf(departmentId)}
              placeholder={departmentId ? 'Whole department if left blank' : 'Pick a department first'}
            />
          </Form.Item>
          <Form.Item name="lineId" label="Line">
            <Select
              allowClear
              disabled={!sectionId}
              showSearch
              optionFilterProp="label"
              options={lookups.linesOf(sectionId)}
              placeholder={sectionId ? 'Whole section if left blank' : 'Pick a section first'}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AssetVerificationList;
