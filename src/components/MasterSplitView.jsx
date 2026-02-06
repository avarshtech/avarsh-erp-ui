import React from 'react';
import { Row, Col, Card, Button, Table, Typography, Empty, Space, Input } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';

const { Title } = Typography;

const MasterSplitView = ({ 
  title, 
  data, 
  columns, 
  loading, 
  onAdd, 
  selectedId, 
  isEditing, 
  renderForm, 
  onSelectRow, 
  rowKey = "id",
  searchPlaceholder = "Search...",
  onSearch
}) => {
  return (
    <div style={{ height: 'calc(100vh - 120px)' }}>
      <Row gutter={16} style={{ height: '100%' }}>
        {/* Left Side: List */}
        <Col span={isEditing ? 8 : 24} style={{ height: '100%', transition: 'all 0.3s ease' }}>
          <Card 
            title={title} 
            extra={
              <Space>
                {/* Simple search input could go here */}
                <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
                  Add
                </Button>
              </Space>
            }
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' } }}
          >
           {onSearch && (
             <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                <Input 
                  placeholder={searchPlaceholder} 
                  prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                  onChange={(e) => onSearch(e.target.value)}
                  allowClear
                />
             </div>
           )}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Table
                dataSource={data}
                columns={columns}
                rowKey={rowKey}
                loading={loading}
                pagination={false}
                size="middle"
                onRow={(record) => ({
                  onClick: () => onSelectRow(record),
                  style: { 
                    cursor: 'pointer', 
                    backgroundColor: record[rowKey] === selectedId ? '#e6f7ff' : 'transparent' // Highlight selected
                  }
                })}
              />
            </div>
            <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'right', color: '#8c8c8c' }}>
               Total: {data.length}
            </div>
          </Card>
        </Col>

        {/* Right Side: Form */}
        {isEditing && (
          <Col span={16} style={{ height: '100%', animation: 'fadeIn 0.3s' }}>
            <Card style={{ height: '100%', overflowY: 'auto' }}>
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
      `}</style>
    </div>
  );
};

export default MasterSplitView;
