import { uploadFile, deleteFile } from '../../../services/core/fileService';

/**
 * GRN attachment categories as stored in fil_file_storage.file_category.
 * DC = delivery challan image/PDF, INVOICE = supplier invoice image/PDF.
 */
export const GRN_FILE_CATEGORY = {
  DC: 'ATTACHMENT',
  INVOICE: 'INVOICE',
};

/**
 * Post-save attachment processor for GRN forms.
 *
 * Runs after a GRN save returns an id. For each staged slot (DC and supplier
 * invoice) it deletes any file queued for removal and uploads the newly-picked
 * file against the (possibly newly-created) GRN id. Failures are surfaced via
 * the passed `message` API but do not roll back the save — the user can
 * re-edit and retry.
 *
 * Slot shape: `{ file, existingFile, toDelete }` where `file` is the newly
 * picked File (or null), `toDelete` is an existing `fileId` queued for
 * deletion, and `existingFile` is the currently-linked metadata from
 * `getFilesByEntity`.
 *
 * @param {Object} params
 * @param {number|string} params.grnId - Saved GRN id; no-op if falsy
 * @param {{file: File|null, toDelete: string|null}} params.dcImage
 * @param {{file: File|null, toDelete: string|null}} params.supplierInvoice
 * @param {{warning: Function}} params.message - AntD App.useApp() message API
 */
export const processGrnAttachments = async ({ grnId, dcImage, supplierInvoice, message }) => {
  if (!grnId) return;
  const ops = [];

  // Delivery Challan
  if (dcImage?.toDelete) {
    ops.push(deleteFile(dcImage.toDelete).catch((e) => console.warn('Failed to delete old DC file:', e)));
  }
  if (dcImage?.file) {
    ops.push(
      uploadFile(dcImage.file, {
        module: 'GRN',
        entity: 'GRN',
        entityId: grnId,
        fileCategory: GRN_FILE_CATEGORY.DC,
      }).catch((e) => { console.error('DC upload failed:', e); throw new Error('DC upload failed'); }),
    );
  }

  // Supplier Invoice
  if (supplierInvoice?.toDelete) {
    ops.push(deleteFile(supplierInvoice.toDelete).catch((e) => console.warn('Failed to delete old invoice file:', e)));
  }
  if (supplierInvoice?.file) {
    ops.push(
      uploadFile(supplierInvoice.file, {
        module: 'GRN',
        entity: 'GRN',
        entityId: grnId,
        fileCategory: GRN_FILE_CATEGORY.INVOICE,
      }).catch((e) => { console.error('Invoice upload failed:', e); throw new Error('Invoice upload failed'); }),
    );
  }

  if (ops.length === 0) return;
  const results = await Promise.allSettled(ops);
  const failures = results.filter((r) => r.status === 'rejected').length;
  if (failures > 0) {
    message.warning(`GRN saved, but ${failures} file operation${failures > 1 ? 's' : ''} failed. Edit the GRN to retry.`);
  }
};
