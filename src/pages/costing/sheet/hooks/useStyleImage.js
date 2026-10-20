import { useEffect, useState } from 'react';
import { downloadFileAsBlob, getFilesByEntity } from '../../../../services/core/fileService';

/** The selected style's image (read-only here; it is managed in Style Master). */
export default function useStyleImage(styleId) {
  const [image, setImage] = useState({ styleId: null, url: null });

  useEffect(() => {
    if (!styleId) return undefined;
    let cancelled = false;
    let url = null;
    getFilesByEntity('STYLE', styleId)
      .then((files) => (files || []).find((f) => ['IMAGE', 'PHOTO'].includes(f.fileCategory)))
      .then((img) => (img ? downloadFileAsBlob(img.fileId) : null))
      .then((blob) => {
        if (cancelled) return;
        url = blob ? URL.createObjectURL(blob) : null;
        setImage({ styleId, url });
      })
      .catch(() => { if (!cancelled) setImage({ styleId, url: null }); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [styleId]);

  return image.styleId === styleId ? image.url : null;
}
