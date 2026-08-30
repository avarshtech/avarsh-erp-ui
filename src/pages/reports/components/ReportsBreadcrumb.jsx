import { memo } from 'react';
import { Breadcrumb } from 'antd';

const ReportsBreadcrumb = memo(function ReportsBreadcrumb({ items = [] }) {
  const breadcrumbItems = [{ title: 'Reports' }, ...items.map((item) =>
    typeof item === 'string' ? { title: item } : item
  )];

  return (
    <Breadcrumb
      items={breadcrumbItems}
      style={{ marginBottom: 12 }}
    />
  );
});

export default ReportsBreadcrumb;
