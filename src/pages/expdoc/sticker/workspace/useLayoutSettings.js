import { useCallback, useMemo, useState } from 'react';
import { hasBarcodeLine, printBarcodesFor } from './stickerWorkspaceModel';

/**
 * Paper, faces and the barcode choice, kept per layout id.
 *
 * A layout brings its own paper and faces, so a switch — by the user or by the service's
 * choice — shows that layout's defaults, or what was chosen for it earlier, with nothing
 * to reset: faces ticked on one layout can never leave another selecting none. Barcodes
 * start on only when no selected carton lacks an EAN.
 */
const useLayoutSettings = (ctx) => {
  const [chosen, setChosen] = useState({});
  const layoutId = ctx?.layout?.id ?? '';
  const sticker = ctx?.layout?.stickerLayout;
  const own = chosen[layoutId];
  const ownFaces = own?.faceKeys;

  const faceKeys = useMemo(() => ownFaces ?? (sticker?.faces || []).map((f) => f.key), [ownFaces, sticker]);
  const choose = useCallback(
    (patch) => setChosen((all) => ({ ...all, [layoutId]: { ...all[layoutId], ...patch } })),
    [layoutId],
  );

  return {
    paper: own?.paper ?? sticker?.paperDefault ?? 'A4_1UP',
    faceKeys,
    barcodeLine: hasBarcodeLine(sticker),
    printBarcodes: printBarcodesFor(sticker, own?.barcodes, ctx?.eanMissing),
    setPaper: (paper) => choose({ paper }),
    setFaceKeys: (keys) => choose({ faceKeys: keys }),
    setBarcodes: (on) => choose({ barcodes: on }),
  };
};

export default useLayoutSettings;
