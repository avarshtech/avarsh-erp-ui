import { Alert } from 'antd';
import { useLocation } from 'react-router-dom';
import { isPreviewPath, PREVIEW_MESSAGE } from '../utils/permissions';

/**
 * Tells users that the screen in front of them keeps its data in this browser only.
 *
 * MainLayout renders it above every page; it shows on the routes of the screens flagged `preview`
 * in SCREENS and disappears when the flag is removed at that screen's API cutover. A page that is a
 * preview inside an otherwise live screen (the job-work bills under Bill Passing) passes `force`.
 */
const PreviewBanner = ({ force = false }) => {
  const { pathname } = useLocation();
  if (!force && !isPreviewPath(pathname)) return null;
  return <Alert type="warning" showIcon banner title={PREVIEW_MESSAGE} style={{ marginBottom: 12 }} />;
};

export default PreviewBanner;
