import { useEffect, useState } from 'react';
import { App, Button, Modal, Spin } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { downloadFileAsBlob, downloadStoredFile } from '../../../services/core/fileService';
import { toastUnlessHandled } from '../../../utils/apiError';

/** Both kinds the asset panel accepts: a scan of the paper, or a photograph. */
const isImage = (file) => {
  const type = (file?.fileType ?? '').toLowerCase();
  if (type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file?.originalFilename ?? '');
};

/**
 * Looking at a document without downloading it first.
 *
 * A warranty card is read far more often than it is filed somewhere, and
 * sending it to the downloads folder to answer one question leaves a copy
 * behind every time. The file is fetched as a blob through the same
 * authenticated call the download uses - the storage URLs are not public, so
 * pointing an img or iframe straight at one would simply fail.
 */
const AssetDocumentViewer = ({ file, onClose }) => {
  const { message } = App.useApp();
  // Carries the id it belongs to, so a result arriving for the document that
  // was open a moment ago is ignored rather than shown under the new title.
  const [loaded, setLoaded] = useState({ id: null, src: null, failed: false });

  useEffect(() => {
    if (!file) return undefined;
    let url = null;
    let ignore = false;

    downloadFileAsBlob(file.fileId)
      .then((blob) => {
        if (ignore) return;
        url = URL.createObjectURL(blob);
        setLoaded({ id: file.fileId, src: url, failed: false });
      })
      .catch((e) => {
        if (ignore) return;
        toastUnlessHandled(message, e, 'Could not open the document');
        setLoaded({ id: file.fileId, src: null, failed: true });
      });

    return () => {
      ignore = true;
      // Revoked on the way out: a blob URL left behind holds the whole file in
      // memory for as long as the tab is open.
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, message]);

  const ready = !!file && loaded.id === file.fileId;
  const src = ready ? loaded.src : null;
  const name = file?.description || file?.originalFilename || 'Document';

  return (
    <Modal
      title={name}
      open={!!file}
      onCancel={onClose}
      width={900}
      destroyOnHidden
      footer={[
        <Button
          key="download"
          icon={<DownloadOutlined />}
          onClick={() => downloadStoredFile(file)
            .catch((e) => toastUnlessHandled(message, e, 'Could not download the document'))}
        >
          Download
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>Close</Button>,
      ]}
    >
      <Spin spinning={!!file && !ready}>
        <div className="asset-doc-view">
          {src && (isImage(file)
            ? <img src={src} alt={name} />
            : <iframe src={src} title={name} />)}
          {ready && !src && (
            <p style={{ opacity: 0.6, textAlign: 'center', padding: '40px 0' }}>
              This document could not be shown. Download it to open it on your computer.
            </p>
          )}
        </div>
      </Spin>
    </Modal>
  );
};

export default AssetDocumentViewer;
