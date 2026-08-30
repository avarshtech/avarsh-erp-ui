export const getTablePagination = (pagination, entityName = 'records') => ({
  ...pagination,
  showSizeChanger: true,
  showQuickJumper: false,
  pageSizeOptions: ['10', '25', '50'],
  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} ${entityName}`,
});
