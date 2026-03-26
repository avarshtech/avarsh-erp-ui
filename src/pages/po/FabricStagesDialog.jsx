import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  DatePicker,
  Input,
  Space,
  Typography,
  Tag,
  Empty,
  Divider,
  App,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

/**
 * Dialog for managing fabric processing stages on a PO line item.
 * Each stage has a name and target completion date within PO date → Delivery date range.
 */
const FabricStagesDialog = ({
  open,
  onClose,
  onSave,
  stages: initialStages,
  poDate,
  deliveryDate,
  itemName,
  itemCode,
  variantAttributes,
}) => {
  const { message } = App.useApp();
  const [stages, setStages] = useState([]);

  useEffect(() => {
    if (open) {
      if (initialStages && initialStages.length > 0) {
        setStages(
          initialStages.map((s, i) => ({
            key: `${Date.now()}_${i}`,
            stageName: s.stageName || '',
            completionDate: s.completionDate ? dayjs(s.completionDate) : null,
          }))
        );
      } else {
        setStages([]);
      }
    }
  }, [open, initialStages]);

  const minDate = poDate ? dayjs(poDate).startOf('day') : null;
  const maxDate = deliveryDate ? dayjs(deliveryDate).endOf('day') : null;

  const disabledDate = useCallback(
    (current) => {
      if (!current) return false;
      if (minDate && current.isBefore(minDate, 'day')) return true;
      if (maxDate && current.isAfter(maxDate, 'day')) return true;
      return false;
    },
    [minDate, maxDate]
  );

  const addStage = () => {
    setStages((prev) => [
      ...prev,
      { key: `${Date.now()}_${Math.random()}`, stageName: '', completionDate: null },
    ]);
  };

  const removeStage = (key) => {
    setStages((prev) => prev.filter((s) => s.key !== key));
  };

  const updateStage = (key, field, value) => {
    setStages((prev) =>
      prev.map((s) => (s.key === key ? { ...s, [field]: value } : s))
    );
  };

  const handleSave = () => {
    if (stages.length > 0) {
      const emptyStages = stages.filter((s) => !s.stageName || !s.stageName.trim());
      if (emptyStages.length > 0) {
        message.warning('Please fill in all stage names or remove empty stages');
        return;
      }
      const missingDates = stages.filter((s) => s.stageName?.trim() && !s.completionDate);
      if (missingDates.length > 0) {
        message.warning('Please set completion dates for all stages');
        return;
      }
    }
    const validStages = stages
      .filter((s) => s.stageName && s.stageName.trim())
      .map((s) => ({
        stageName: s.stageName.trim(),
        completionDate: s.completionDate ? s.completionDate.format('YYYY-MM-DD') : null,
      }));
    onSave(validStages.length > 0 ? validStages : null);
    onClose();
  };

  const stageCount = stages.filter((s) => s.stageName?.trim()).length;
  const completedCount = stages.filter((s) => s.stageName?.trim() && s.completionDate).length;
  const hadInitialStages = initialStages && initialStages.length > 0;
  const isSaveDisabled = stages.length === 0 && !hadInitialStages;

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      width={640}
      centered
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {stageCount > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {completedCount}/{stageCount} stages with dates
              </Text>
            )}
          </div>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" onClick={handleSave} disabled={isSaveDisabled}>
              Save Stages
            </Button>
          </Space>
        </div>
      }
      destroyOnClose
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ExperimentOutlined style={{ color: '#fff', fontSize: 18 }} />
          </div>
          <div>
            <Title level={5} style={{ margin: 0 }}>
              Fabric Processing Stages
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Define processing milestones between PO date and delivery
            </Text>
          </div>
        </div>

        {/* Item info bar */}
        <div
          style={{
            background: 'var(--bg-secondary, #f5f5f5)',
            borderRadius: 8,
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <Tag color="purple" style={{ margin: 0 }}>{itemCode}</Tag>
          <Text strong style={{ fontSize: 13 }}>{itemName}</Text>
          {variantAttributes &&
            typeof variantAttributes === 'object' &&
            Object.entries(variantAttributes).map(([k, v]) => (
              <Tag key={k} style={{ margin: 0, fontSize: 11 }}>
                {k}: {v}
              </Tag>
            ))}
        </div>

        {/* Date range indicator */}
        <div
          style={{
            marginTop: 10,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px dashed var(--border-color, #d9d9d9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
          }}
        >
          <span>
            <Text type="secondary">PO Date: </Text>
            <Text strong>{minDate ? minDate.format('DD MMM YYYY') : '-'}</Text>
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              margin: '0 12px',
              background: 'linear-gradient(to right, #6366f1, #10b981)',
            }}
          />
          <span>
            <Text type="secondary">Delivery: </Text>
            <Text strong style={{ color: 'var(--success-color, #52c41a)' }}>
              {maxDate ? maxDate.format('DD MMM YYYY') : '-'}
            </Text>
          </span>
        </div>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* Stages list */}
      {stages.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span>
              No processing stages defined.
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Add stages like Dyeing, Printing, Washing, Finishing etc.
              </Text>
            </span>
          }
          style={{ margin: '24px 0' }}
        />
      ) : (
        <div style={{ maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
          {stages.map((stage, idx) => {
            const isComplete = stage.stageName?.trim() && stage.completionDate;
            return (
              <div
                key={stage.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                {/* Step indicator */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flexShrink: 0,
                    width: 24,
                  }}
                >
                  {isComplete ? (
                    <CheckCircleOutlined style={{ fontSize: 18, color: 'var(--success-color)' }} />
                  ) : (
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        border: '2px solid #d9d9d9',
                        background: 'transparent',
                      }}
                    />
                  )}
                </div>
                <Tag
                  color="default"
                  style={{
                    minWidth: 24,
                    textAlign: 'center',
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  {idx + 1}
                </Tag>
                <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Input
                    style={{ flex: 1, minWidth: 200 }}
                    placeholder="Stage name (e.g. Dyeing, Printing)"
                    value={stage.stageName}
                    onChange={(e) => updateStage(stage.key, 'stageName', e.target.value)}
                  />
                  <DatePicker
                    style={{ width: 160 }}
                    placeholder="Target date"
                    value={stage.completionDate}
                    onChange={(date) => updateStage(stage.key, 'completionDate', date)}
                    disabledDate={disabledDate}
                    format="DD MMM YYYY"
                  />
                  <Button
                    type="text"
                    icon={<DeleteOutlined style={{ color: 'var(--error-color)' }} />}
                    size="small"
                    onClick={() => removeStage(stage.key)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add stage button */}
      <Button
        type="dashed"
        onClick={addStage}
        block
        icon={<PlusOutlined />}
        style={{ marginTop: 8 }}
      >
        Add Processing Stage
      </Button>
    </Modal>
  );
};

export default FabricStagesDialog;
