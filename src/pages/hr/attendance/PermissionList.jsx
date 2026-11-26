import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Card, Row, Col, Select, InputNumber, Button, Table, Statistic, Space, Tag,
  Empty, Spin, Typography, Popconfirm, Alert, Modal,
} from 'antd';
import { ReloadOutlined, PlusOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getPermissions, deletePermission, getPermissionPolicy, savePermissionPolicy,
} from '../../../services/hr/permissionService';
import { getActiveUnits } from '../../../services/master/unitService';
import { useBranch } from '../../../context/BranchContext';
import { unitOptions } from '../../../utils/hrLabels';
import { hasPermission } from '../../../utils/permissions';
import { toastUnlessHandled } from '../../../utils/apiError';
import PageHeader from '../../../components/PageHeader';
import PermissionDialog from './PermissionDialog';

const { Text } = Typography;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
].map((label, i) => ({ value: i + 1, label }));

const time = (v) => (v ? String(v).slice(0, 5) : '—');

/**
 * Permissions: the hour a worker may take off, twice a month.
 *
 * Taken by coming in at 10 instead of 9, leaving an hour early, or both at once by
 * arriving at 11 - on different days, at different times, or together. None of it was
 * written down before, so nobody could answer "has he already had his two?"
 *
 * A register, not a pay rule. Nothing here changes a wage, and the screen says so
 * rather than leaving somebody to assume it does: this system computes no lateness, so
 * arriving at 11:00 is paid as a full day whether a permission was given or not.
 */
const PermissionList = () => {
  const { message } = App.useApp();
  const { activeBranchId } = useBranch();
  const canAdd = hasPermission('hr-attendance', 'add');
  const canDelete = hasPermission('hr-attendance', 'delete');
  const canSetPolicy = hasPermission('hr-attendance', 'update');

  const now = new Date();
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [draftPolicy, setDraftPolicy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  /** Always opened from what is saved, so a cancelled edit leaves nothing behind. */
  const openPolicy = useCallback(() => {
    setDraftPolicy(policy);
    setPolicyOpen(true);
  }, [policy]);

  useEffect(() => {
    getActiveUnits(activeBranchId || undefined).then(setUnits).catch(() => setUnits([]));
    getPermissionPolicy().then((p) => { setPolicy(p); setDraftPolicy(p); }).catch(() => {});
  }, [activeBranchId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getPermissions({ year, month, ...(unitId ? { unitId } : {}) }));
    } catch (e) {
      setRows([]);
      toastUnlessHandled(message, e, 'Could not load the month');
    } finally {
      setLoading(false);
    }
  }, [year, month, unitId, message]);

  useEffect(() => { load(); }, [load]);

  const remove = useCallback(async (id) => {
    try {
      await deletePermission(id);
      message.success('Removed, and the allowance given back');
      load();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not remove it');
    }
  }, [load, message]);

  const savePolicy = useCallback(async () => {
    try {
      const saved = await savePermissionPolicy(draftPolicy);
      setPolicy(saved);
      setDraftPolicy(saved);
      message.success('Allowance saved');
      setPolicyOpen(false);
      load();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not save the allowance');
    }
  }, [draftPolicy, load, message]);

  /** Units used per employee, which is what "has he had his two" actually asks. */
  const usage = useMemo(() => {
    const byEmployee = new Map();
    rows.forEach((r) => byEmployee.set(r.employeeId, (byEmployee.get(r.employeeId) ?? 0) + (r.units ?? 0)));
    const allowed = policy?.permissionsPerMonth ?? 2;
    return {
      byEmployee,
      people: byEmployee.size,
      unitsTaken: [...byEmployee.values()].reduce((a, b) => a + b, 0),
      exhausted: [...byEmployee.values()].filter((u) => u >= allowed).length,
    };
  }, [rows, policy]);

  const columns = useMemo(() => [
    { title: 'Emp No', dataIndex: 'employeeNo', width: 110 },
    { title: 'Name', dataIndex: 'employeeName', width: 190 },
    { title: 'Department', dataIndex: 'departmentName', width: 150, render: (v) => v || '—' },
    {
      title: 'Date',
      dataIndex: 'permissionDate',
      width: 130,
      render: (v) => (v ? dayjs(v).format('DD-MMM-YYYY') : '—'),
    },
    {
      title: 'Hours',
      key: 'hours',
      width: 140,
      render: (_, r) => `${time(r.fromTime)} – ${time(r.toTime)}`,
    },
    {
      // What it cost of the month's allowance. Two hours in one go is two, which is
      // the part of the rule that surprises people.
      title: 'Counts as',
      dataIndex: 'units',
      width: 110,
      align: 'right',
      render: (v) => <Tag color={v > 1 ? 'orange' : 'blue'}>{v}</Tag>,
    },
    {
      title: 'Used this month',
      key: 'used',
      width: 140,
      align: 'right',
      render: (_, r) => {
        const used = usage.byEmployee.get(r.employeeId) ?? 0;
        const allowed = policy?.permissionsPerMonth ?? 2;
        return <Text type={used >= allowed ? 'danger' : undefined}>{used} / {allowed}</Text>;
      },
    },
    { title: 'Reason', dataIndex: 'reason', render: (v) => v || '—' },
    ...(canDelete ? [{
      title: '',
      key: 'remove',
      width: 60,
      render: (_, r) => (
        <Popconfirm
          title="Remove this permission?"
          description="The allowance goes back to the employee."
          okText="Remove"
          okButtonProps={{ danger: true }}
          onConfirm={() => remove(r.id)}
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    }] : []),
  ], [usage, policy, canDelete, remove]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Permissions"
        /* The allowance reads here rather than sitting in a card of its own. It is a
           setting somebody changes once a year and reads every time they look at the
           screen, so it belongs in a line of text, not in two input boxes. */
        subtitle={policy
          ? `The hour a worker may take off - ${policy.permissionsPerMonth} a month, `
            + `${policy.minutesEach} minutes each`
          : 'The hour a worker may take off, and how many are left this month'}
      >
        <Space>
          {canSetPolicy && (
            <Button icon={<SettingOutlined />} onClick={openPolicy}>Set Allowance</Button>
          )}
          {canAdd && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialogOpen(true)}>
              Record Permission
            </Button>
          )}
        </Space>
      </PageHeader>

      {/* Said plainly, because the screen looks like it ought to affect pay. */}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="A register, not a deduction"
        description="Permissions are recorded and capped here. They do not change anyone's
          wage - lateness is not costed anywhere in the system today, so a permission has
          nothing to excuse yet."
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={12} sm={8} md={5}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Month</Text></div>
            <Select style={{ width: '100%' }} value={month} onChange={setMonth} options={MONTHS} />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Year</Text></div>
            <InputNumber style={{ width: '100%' }} value={year} onChange={setYear} min={2020} max={2099} />
          </Col>
          <Col xs={24} sm={10} md={6}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Unit</Text></div>
            <Select
              style={{ width: '100%' }}
              value={unitId}
              onChange={setUnitId}
              options={unitOptions(units)}
              placeholder="All units"
              allowClear
              showSearch
              optionFilterProp="label"
            />
          </Col>
          <Col xs={24} md={5}>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Load</Button>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} md={6}>
              <Statistic title="Permissions taken" value={usage.unitsTaken} />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Statistic title="People" value={usage.people} />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Statistic
                title="Used their full allowance"
                value={usage.exhausted}
                styles={{ content: { color: usage.exhausted > 0 ? '#fa8c16' : undefined } }}
              />
            </Col>
          </Row>
        </Card>

        <Card size="small">
          <Table
            columns={columns}
            dataSource={rows}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 25, showSizeChanger: true }}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={`No permissions recorded for ${MONTHS[month - 1].label} ${year}.`}
                />
              ),
            }}
          />
        </Card>
      </Spin>

      <Modal
        title="Set the allowance"
        open={policyOpen}
        onCancel={() => setPolicyOpen(false)}
        onOk={savePolicy}
        okText="Save"
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="This applies from now on"
          description="Permissions already recorded keep the count they were given, so
            changing this does not rewrite a past month."
        />
        <Row gutter={16}>
          <Col xs={12}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Permissions a month</Text></div>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={31}
              value={draftPolicy?.permissionsPerMonth}
              onChange={(v) => setDraftPolicy((p) => ({ ...p, permissionsPerMonth: v }))}
            />
          </Col>
          <Col xs={12}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Minutes each</Text></div>
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={480}
              value={draftPolicy?.minutesEach}
              onChange={(v) => setDraftPolicy((p) => ({ ...p, minutesEach: v }))}
            />
          </Col>
        </Row>
      </Modal>

      <PermissionDialog
        open={dialogOpen}
        policy={policy}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); load(); }}
      />
    </div>
  );
};

export default PermissionList;
