import { useState } from 'react';
import {
  Alert, Card, Tabs, Typography, Upload,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import SheetSourceView from './SheetSourceView';
import { parseEvidence } from './sourceRefs';

const { Text } = Typography;

/**
 * The uploaded document beside the template, so every row can be checked against it:
 * a PDF in the browser's own viewer (opened at the cited page), or the spreadsheet
 * as the reader transcribed it (on the cited sheet, with the cell highlighted).
 */
const SourcePane = ({ result, fileUrl, fileName, evidence, onAttachFile }) => {
  const target = parseEvidence(evidence);
  const sheets = result?.sheets || [];
  const [shown, setShown] = useState({ evidence, sheet: target?.sheet || sheets[0]?.name });
  // Follow a new citation to its sheet; a tab the user picks stays until the next one.
  if (shown.evidence !== evidence) {
    setShown({ evidence, sheet: (target?.sheet && sheets.some((s) => s.name === target.sheet)) ? target.sheet : shown.sheet });
  }

  if (result?.sourceKind === 'PDF') {
    if (!fileUrl) {
      return (
        <Card size="small" title={fileName || 'Source document'}>
          <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Attach the PDF again to see it here"
            description="The page was reloaded, and a browser does not keep uploaded files across a reload. Your review is intact." />
          <Upload.Dragger accept=".pdf" multiple={false} showUploadList={false}
            beforeUpload={(file) => { onAttachFile(file); return false; }} aria-label="Attach the PDF again">
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">{`Drop ${fileName || 'the PDF'} here`}</p>
          </Upload.Dragger>
        </Card>
      );
    }
    const src = `${fileUrl}#page=${target?.page || 1}`;
    return (
      <Card size="small" title={fileName} styles={{ body: { padding: 0 } }}>
        <iframe key={src} title="Uploaded buyer document" src={src} style={{ width: '100%', height: '72vh', border: 0 }} />
      </Card>
    );
  }

  if (!sheets.length) {
    return <Card size="small" title={fileName}><Text type="secondary">The spreadsheet had no readable cells to show.</Text></Card>;
  }
  return (
    <Card size="small" title={fileName} styles={{ body: { padding: 8 } }}>
      <Tabs
        size="small"
        activeKey={shown.sheet}
        onChange={(key) => setShown({ evidence, sheet: key })}
        items={sheets.map((s) => ({
          key: s.name,
          label: s.name,
          children: <SheetSourceView sheet={s} highlight={target?.sheet === s.name ? target : null} />,
        }))}
      />
    </Card>
  );
};

export default SourcePane;
