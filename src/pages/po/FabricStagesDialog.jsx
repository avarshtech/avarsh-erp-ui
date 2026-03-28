import { useState, useEffect, useCallback, useRef } from 'react';
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
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  LockOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

/**
 * Dialog for managing fabric processing stages on a PO line item.
 * Each stage has a name and target completion date within PO date → Delivery date range.
 *
 * In appendOnly mode (opened from PO View), existing stages are shown as locked/disabled
 * and new stages can be added and dragged into any position among the combined list.
 * On save, only the final ordered list of new stages (with their target positions) is returned.
 */
const FabricStagesDialog = ({
  open,
  onClose,
  onSave,
  stages: initialStages,
  existingStages: existingStagesProp,
  appendOnly,
  poDate,
  deliveryDate,
  itemName,
  itemCode,
  variantAttributes,
}) => {
  const { message } = App.useApp();
  const [stages, setStages] = useState([]);

  // In appendOnly mode we maintain a combined list of existing (locked) + new (editable) items
  // Each item has: { key, stageName, completionDate, isExisting, isCompleted? }
  const [combinedList, setCombinedList] = useState([]);

  const existingStages = existingStagesProp || [];

  useEffect(() => {
    if (open) {
      if (appendOnly) {
        // Build combined list from existing stages only (new stages start empty)
        setCombinedList(
          existingStages.map((s, i) => ({
            key: `existing_${i}`,
            stageName: s.stageName || '',
            completionDate: s.completionDate ? dayjs(s.completionDate) : null,
            isExisting: true,
            isCompleted: !!s.isCompleted,
          }))
        );
        setStages([]);
      } else if (initialStages && initialStages.length > 0) {
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

  // ── Drag & Drop (native HTML5, same pattern as ProcessAllowanceModal) ──
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleDragStart = useCallback((idx) => {
    dragItem.current = idx;
  }, []);

  const handleDragEnter = useCallback((idx) => {
    dragOverItem.current = idx;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (
      dragItem.current === null ||
      dragOverItem.current === null ||
      dragItem.current === dragOverItem.current
    ) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    if (appendOnly) {
      setCombinedList((prev) => {
        const updated = [...prev];
        const [dragged] = updated.splice(dragItem.current, 1);
        updated.splice(dragOverItem.current, 0, dragged);
        return updated;
      });
    } else {
      setStages((prev) => {
        const updated = [...prev];
        const [dragged] = updated.splice(dragItem.current, 1);
        updated.splice(dragOverItem.current, 0, dragged);
        return updated;
      });
    }
    dragItem.current = null;
    dragOverItem.current = null;
  }, [appendOnly]);

  // ── Stage CRUD (non-appendOnly mode) ──
  const addStage = () => {
    if (appendOnly) {
      const newItem = {
        key: `new_${Date.now()}_${Math.random()}`,
        stageName: '',
        completionDate: null,
        isExisting: false,
      };
      setCombinedList((prev) => [...prev, newItem]);
    } else {
      setStages((prev) => [
        ...prev,
        { key: `${Date.now()}_${Math.random()}`, stageName: '', completionDate: null },
      ]);
    }
  };

  const removeStage = (key) => {
    if (appendOnly) {
      setCombinedList((prev) => prev.filter((s) => s.key !== key));
    } else {
      setStages((prev) => prev.filter((s) => s.key !== key));
    }
  };

  const updateStage = (key, field, value) => {
    if (appendOnly) {
      setCombinedList((prev) =>
        prev.map((s) => (s.key === key ? { ...s, [field]: value } : s))
      );
    } else {
      setStages((prev) =>
        prev.map((s) => (s.key === key ? { ...s, [field]: value } : s))
      );
    }
  };

  // ── Save ──
  const handleSave = () => {
    if (appendOnly) {
      const newItems = combinedList.filter((s) => !s.isExisting);
      if (newItems.length > 0) {
        const emptyNames = newItems.filter((s) => !s.stageName?.trim());
        if (emptyNames.length > 0) {
          message.warning('Please fill in all stage names or remove empty stages');
          return;
        }
        const missingDates = newItems.filter((s) => s.stageName?.trim() && !s.completionDate);
        if (missingDates.length > 0) {
          message.warning('Please set completion dates for all stages');
          return;
        }
      }
      // Return the full reordered list: existing stages with their original data + new stages
      // The caller (POView) will use this to determine the new order
      const orderedResult = combinedList.map((item) => {
        if (item.isExisting) {
          // Find original existing stage data
          const origIdx = existingStages.findIndex(
            (es) => es.stageName === item.stageName && (
              (!es.completionDate && !item.completionDate) ||
              (es.completionDate && item.completionDate && dayjs(es.completionDate).isSame(item.completionDate, 'day'))
            )
          );
          return origIdx >= 0 ? { ...existingStages[origIdx], _isExisting: true } : null;
        }
        return {
          stageName: item.stageName.trim(),
          completionDate: item.completionDate ? item.completionDate.format('YYYY-MM-DD') : null,
          _isExisting: false,
        };
      }).filter(Boolean);

      // Extract only new stages for the addStages API, but pass the full ordered list
      const newOnly = orderedResult.filter((s) => !s._isExisting).map(({ _isExisting, ...rest }) => rest);
      if (newOnly.length === 0) {
        onSave(null);
      } else {
        // Pass full reordered list so caller can rebuild the stages array in correct order
        onSave(newOnly, orderedResult);
      }
      onClose();
    } else {
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
    }
  };

  // ── Computed counts ──
  const activeList = appendOnly ? combinedList.filter((s) => !s.isExisting) : stages;
  const stageCount = activeList.filter((s) => s.stageName?.trim()).length;
  const completedCount = activeList.filter((s) => s.stageName?.trim() && s.completionDate).length;
  const hadInitialStages = initialStages && initialStages.length > 0;
  const newCount = appendOnly ? combinedList.filter((s) => !s.isExisting).length : 0;
  const isSaveDisabled = appendOnly ? newCount === 0 : (stages.length === 0 && !hadInitialStages);

  // ── Render a single stage row ──
  const renderStageRow = (item, idx, isDraggable) => {
    const isComplete = item.isExisting
      ? !!item.isCompleted
      : !!(item.stageName?.trim() && item.completionDate);
    const isLocked = !!item.isExisting;

    return (
      <div
        key={item.key}
        draggable={isDraggable && !isLocked}
        onDragStart={isDraggable && !isLocked ? () => handleDragStart(idx) : undefined}
        onDragEnter={isDraggable ? () => handleDragEnter(idx) : undefined}
        onDragEnd={isDraggable && !isLocked ? handleDragEnd : undefined}
        onDragOver={isDraggable ? (e) => e.preventDefault() : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
          padding: '8px 10px',
          borderRadius: 8,
          border: `1px solid ${isLocked ? 'var(--border-color, #e8e8e8)' : 'var(--primary-color)'}`,
          background: isLocked
            ? 'color-mix(in srgb, var(--border-color, #e8e8e8) 15%, transparent)'
            : 'color-mix(in srgb, var(--primary-color) 4%, transparent)',
          opacity: isLocked ? 0.65 : 1,
          cursor: isDraggable && !isLocked ? 'grab' : 'default',
          transition: 'box-shadow 0.2s, border-color 0.2s',
        }}
        onMouseDown={isDraggable && !isLocked ? (e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; } : undefined}
        onMouseUp={isDraggable && !isLocked ? (e) => { e.currentTarget.style.boxShadow = 'none'; } : undefined}
        onMouseLeave={isDraggable && !isLocked ? (e) => { e.currentTarget.style.boxShadow = 'none'; } : undefined}
      >
        {/* Drag handle or lock icon */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, width: 20 }}>
          {isLocked ? (
            <LockOutlined style={{ fontSize: 12, color: '#bfbfbf' }} />
          ) : isDraggable ? (
            <HolderOutlined style={{ fontSize: 12, color: 'var(--text-muted, #bfbfbf)' }} />
          ) : isComplete ? (
            <CheckCircleOutlined style={{ fontSize: 16, color: 'var(--success-color)' }} />
          ) : (
            <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #d9d9d9' }} />
          )}
        </div>

        {/* Index */}
        <Tag
          color={isLocked ? 'default' : 'blue'}
          style={{ minWidth: 24, textAlign: 'center', flexShrink: 0, fontSize: 11, fontWeight: 600, margin: 0 }}
        >
          {idx + 1}
        </Tag>

        {/* Inputs */}
        <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Input
            style={{ flex: 1, minWidth: 180 }}
            placeholder="Stage name (e.g. Dyeing, Printing)"
            value={item.stageName}
            onChange={isLocked ? undefined : (e) => updateStage(item.key, 'stageName', e.target.value)}
            disabled={isLocked}
          />
          <DatePicker
            style={{ width: 150 }}
            placeholder="Target date"
            value={item.completionDate}
            onChange={isLocked ? undefined : (date) => updateStage(item.key, 'completionDate', date)}
            disabledDate={isLocked ? undefined : disabledDate}
            format="DD MMM YYYY"
            disabled={isLocked}
          />
          {!isLocked && (
            <Button
              type="text"
              icon={<DeleteOutlined style={{ color: 'var(--error-color)' }} />}
              size="small"
              onClick={() => removeStage(item.key)}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      width={680}
      centered
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {stageCount > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {completedCount}/{stageCount} new stages with dates
              </Text>
            )}
          </div>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" onClick={handleSave} disabled={isSaveDisabled}>
              {appendOnly ? 'Add Stages' : 'Save Stages'}
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
              {appendOnly
                ? 'Add new stages and drag to reorder their position'
                : 'Define processing milestones between PO date and delivery'}
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

      {/* Drag hint for append-only mode */}
      {appendOnly && combinedList.some((s) => !s.isExisting) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
          padding: '6px 10px', borderRadius: 6,
          background: 'color-mix(in srgb, var(--primary-color) 6%, transparent)',
          fontSize: 11, color: 'var(--text-secondary)',
        }}>
          <HolderOutlined style={{ fontSize: 12 }} />
          <Text type="secondary" style={{ fontSize: 11 }}>
            Drag new stages (blue border) to reorder them between existing stages
          </Text>
        </div>
      )}

      {/* Combined list (appendOnly) or standalone list */}
      {appendOnly ? (
        <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
          {combinedList.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  No stages yet.
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Add new stages below.
                  </Text>
                </span>
              }
              style={{ margin: '16px 0' }}
            />
          ) : (
            combinedList.map((item, idx) => renderStageRow(item, idx, true))
          )}
        </div>
      ) : stages.length === 0 ? (
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
          {stages.map((stage, idx) => renderStageRow(stage, idx, stages.length > 1))}
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
