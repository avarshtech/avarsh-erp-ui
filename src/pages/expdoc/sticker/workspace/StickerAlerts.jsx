import { Alert, Space, Typography } from 'antd';
import { formatRanges } from '../../../../utils/expDocCalc';
import { layoutCount } from './stickerWorkspaceModel';

const { Text } = Typography;
const GAP = { marginBottom: 16 };

/**
 * What stands between the user and a clean print: a layout still to pick, cartons with no
 * EAN while the layout prints them, cartons missing a printed field, and printed cartons
 * whose data has changed since they were labelled.
 */
const StickerAlerts = ({ ctx, check, printBarcodes }) => {
  const options = ctx.layoutOptions || [];
  const noEan = ctx.eanMissing?.count > 0 ? ctx.eanMissing : null;
  const blocked = check?.blocked || [];
  const reprint = check?.reprintNeeded || [];

  return (
    <>
      {!ctx.layout && options.length > 1 && (
        <Alert
          type="info" showIcon style={GAP}
          title="Pick the sticker layout"
          description={`${ctx.pl.buyerName} has ${layoutCount(options)} sticker layouts. Choose one under “Sticker layout” — or the standard carton marking; the next run of this packing list starts from your choice.`}
        />
      )}

      {noEan && (
        <Alert
          type="warning" showIcon style={GAP}
          title={`This template prints EAN barcodes, but ${noEan.count} carton(s) have no EAN`}
          description={printBarcodes
            ? `With barcodes on, these cartons cannot be printed: ${formatRanges(noEan.ranges)}. Switch barcodes off to print them with empty barcode rows.`
            : `Barcodes are off for this run, so the barcode rows print empty. Cartons without an EAN: ${formatRanges(noEan.ranges)}.`}
        />
      )}

      {blocked.length > 0 && (
        <Alert
          type="error" showIcon style={GAP}
          title={`${blocked.length} carton(s) cannot be printed`}
          description={(
            <Space orientation="vertical" size={2}>
              <Text>
                {`Cartons ${blocked.slice(0, 12).map((b) => b.cartonNo).join(', ')}${blocked.length > 12 ? ' …' : ''} are missing a field this layout prints (${[...new Set(blocked.flatMap((b) => b.missing))].join(', ')}).`}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Fix them in the packing entry and refresh the packing list — a label with a blank weight is worse than no label.
              </Text>
            </Space>
          )}
        />
      )}

      {reprint.length > 0 && (
        <Alert
          type="warning" showIcon style={GAP}
          title="Some printed cartons have changed since they were labelled"
          description={`Cartons ${formatRanges(reprint)} carry a printed field that has since changed. Reprint them.`}
        />
      )}
    </>
  );
};

export default StickerAlerts;
