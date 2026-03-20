import React from 'react';
import { Row, Col, Card, Button, Table, Typography, Empty, Space, Input, Drawer } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import useResponsive from '../hooks/useResponsive';

const { Title } = Typography;

const MasterSplitView = ({
  title,
  subtitle,
  data,
  columns,
  loading,
  onAdd,
  addLabel = 'Add',
  selectedId,
  isEditing,
  renderForm,
  onSelectRow,
  onCloseForm,
  rowKey = "id",
  searchPlaceholder = "Search...",
  onSearch
}) => {
  const { isDarkMode } = useTheme();
  const { isMobile, isMobileOrTablet } = useResponsive();
  const borderColor = isDarkMode ? '#334155' : '#f0f0f0';
  const selectedBg = isDarkMode ? '#312e81' : '#e6f7ff';
  const textMutedColor = isDarkMode ? '#94a3b8' : '#8c8c8c';
  const searchIconColor = isDarkMode ? '#64748b' : '#bfbfbf';

  const listContent = (
    <Card
      title={
        <div>
          <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>{subtitle}</div>}
        </div>
      }
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{ body: { flex: 1, overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' } }}
    >
      <div style={{
        padding: isMobile ? '8px 12px' : '12px 16px',
        borderBottom: `1px solid ${borderColor}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: isMobile ? 8 : 12,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}>
        <Input
          placeholder={searchPlaceholder}
          prefix={<SearchOutlined style={{ color: searchIconColor }} />}
          onChange={(e) => onSearch?.(e.target.value)}
          allowClear
          style={{ width: isMobile ? '100%' : 280, flex: isMobile ? '1 1 100%' : '0 0 280px' }}
        />
        {onAdd && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd} style={{ flexShrink: 0 }}>
            {addLabel}
          </Button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Table
          className="master-split-table"
          dataSource={data}
          columns={columns}
          rowKey={rowKey}
          loading={loading}
          pagination={false}
          size="middle"
          scroll={{ x: 'max-content' }}
          onRow={(record) => ({
            onClick: () => onSelectRow(record),
            style: {
              cursor: 'pointer',
              backgroundColor: record[rowKey] === selectedId ? selectedBg : 'transparent'
            }
          })}
        />
      </div>
      <div style={{ padding: '8px 16px', borderTop: `1px solid ${borderColor}`, textAlign: 'right', color: textMutedColor }}>
         Total: {data.length}
      </div>
    </Card>
  );

  // On mobile/tablet: form opens in a Drawer instead of a side panel
  if (isMobileOrTablet) {
    return (
      <div style={{ height: '100%', overflow: 'hidden' }}>
        {listContent}
        <Drawer
          open={isEditing}
          onClose={onCloseForm}
          placement="right"
          width={isMobile ? '100%' : '80%'}
          title={title}
          styles={{
            body: { padding: 0 },
          }}
          destroyOnClose
        >
          {isEditing && renderForm()}
        </Drawer>
        <style>{`
          .master-split-table .ant-table-thead > tr > th {
            border-radius: 0 !important;
          }
        `}</style>
      </div>
    );
  }

  // Desktop: original side-by-side layout
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <Row gutter={16} style={{ height: '100%' }}>
        {/* Left Side: List */}
        <Col span={isEditing ? 8 : 24} style={{ height: '100%', transition: 'all 0.3s ease' }}>
          {listContent}
        </Col>

        {/* Right Side: Form */}
        {isEditing && (
          <Col span={16} style={{ height: '100%', animation: 'fadeIn 0.3s' }}>
            <Card
              style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
              styles={{ body: { flex: 1, minHeight: 0, overflow: 'hidden', padding: 0 } }}
            >
              {renderForm()}
            </Card>
          </Col>
        )}
      </Row>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .master-split-table .ant-table-thead > tr > th {
          border-radius: 0 !important;
        }
      `}</style>
    </div>
  );
};

export default MasterSplitView;
