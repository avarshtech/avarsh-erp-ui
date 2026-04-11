import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Card, Select, Table, Button, Spin } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import { getAllActiveLines, getOperatorSkills, updateOperatorSkills } from '../../../services/sewingService';
import { SKILL_GRADES } from '../../../utils/sewingConstants';
import EmptyState from '../../../components/EmptyState';

const gradeColorMap = Object.fromEntries(SKILL_GRADES.map((g) => [g.value, g.color]));
const gradeOptions = SKILL_GRADES.map((g) => ({ value: g.value, label: g.value }));

const SkillMatrixPage = () => {
  const { message } = App.useApp();
  const [lineOptions, setLineOptions] = useState([]);
  const [selectedLine, setSelectedLine] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [operators, setOperators] = useState([]);
  const [operations, setOperations] = useState([]);
  const [skillData, setSkillData] = useState({});
  const [dirty, setDirty] = useState(false);

  // Load lines
  useEffect(() => {
    getAllActiveLines()
      .then((data) => {
        const lines = Array.isArray(data) ? data : (data?.content || []);
        setLineOptions(lines.map((l) => ({ value: l.id, label: l.lineCode || l.lineName })));
      })
      .catch(() => { /* ignore */ });
  }, []);

  // Load operator skills when line is selected
  const loadSkills = useCallback(async (lineId) => {
    if (!lineId) return;
    setLoading(true);
    try {
      const data = await getOperatorSkills({ lineId });
      const ops = data?.operators || [];
      const opsNames = data?.operations || [];
      setOperators(ops);
      setOperations(opsNames);
      // Build skill map: { operatorId: { operation: grade } }
      const map = {};
      ops.forEach((op) => {
        map[op.id] = {};
        (op.skills || []).forEach((sk) => {
          map[op.id][sk.operation] = sk.grade;
        });
      });
      setSkillData(map);
      setDirty(false);
    } catch {
      message.error('Failed to load skill data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLineChange = useCallback((lineId) => {
    setSelectedLine(lineId);
    loadSkills(lineId);
  }, [loadSkills]);

  const handleGradeChange = useCallback((operatorId, operation, grade) => {
    setSkillData((prev) => ({
      ...prev,
      [operatorId]: { ...(prev[operatorId] || {}), [operation]: grade },
    }));
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const promises = operators.map((op) => {
        const skills = operations.map((operation) => ({
          operation,
          grade: skillData[op.id]?.[operation] || null,
        })).filter((s) => s.grade);
        return updateOperatorSkills(op.id, { lineId: selectedLine, skills });
      });
      await Promise.all(promises);
      message.success('Skills updated');
      setDirty(false);
    } catch {
      message.error('Failed to save skills');
    } finally {
      setSaving(false);
    }
  }, [operators, operations, skillData, selectedLine]);

  const columns = useMemo(() => [
    {
      title: 'Operator',
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 180,
      fixed: 'left',
      render: (text) => <strong>{text}</strong>,
    },
    ...operations.map((operation) => ({
      title: operation,
      key: operation,
      width: 100,
      align: 'center',
      render: (_, record) => {
        const grade = skillData[record.id]?.[operation] || null;
        return (
          <Select
            size="small"
            value={grade}
            onChange={(v) => handleGradeChange(record.id, operation, v)}
            options={gradeOptions}
            placeholder="-"
            allowClear
            style={{
              width: 60,
              ...(grade ? { color: gradeColorMap[grade] } : {}),
            }}
          />
        );
      },
    })),
  ], [operations, skillData, handleGradeChange]);

  return (
    <>
      <PageHeader title="Operator Skill Matrix">
        {dirty && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save All
          </Button>
        )}
      </PageHeader>

      <Card style={{ marginBottom: 16 }}>
        <Select
          placeholder="Select a sewing line"
          options={lineOptions}
          value={selectedLine}
          onChange={handleLineChange}
          showSearch
          optionFilterProp="label"
          style={{ width: 300 }}
        />
      </Card>

      <Spin spinning={loading}>
        {selectedLine && operators.length > 0 ? (
          <Card>
            <div style={{ marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {SKILL_GRADES.map((g) => (
                <span key={g.value} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 2, background: g.color, display: 'inline-block' }} />
                  <span style={{ fontSize: 12 }}>{g.label}</span>
                </span>
              ))}
            </div>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={operators}
              pagination={false}
              size="small"
              scroll={{ x: 180 + operations.length * 100 }}
              locale={{ emptyText: <EmptyState description="No operators found for this line" /> }}
            />
          </Card>
        ) : (
          !loading && (
            <Card>
              <EmptyState description={selectedLine ? 'No operators found for this line' : 'Select a line to view the skill matrix'} />
            </Card>
          )
        )}
      </Spin>
    </>
  );
};

export default SkillMatrixPage;
