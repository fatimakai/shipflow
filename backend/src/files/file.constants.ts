export const FILE_MAX_SIZE_BYTES = 25 * 1024 * 1024;
export const FILE_UPLOAD_URL_TTL_SECONDS = 10 * 60;
export const FILE_DOWNLOAD_URL_TTL_SECONDS = 5 * 60;
export const FILE_RESERVATION_TTL_MS = 15 * 60 * 1000;
export const FILE_STALE_PENDING_MS = 60 * 60 * 1000;
export const FILE_SCAN_TIMEOUT_MS = 24 * 60 * 60 * 1000;
export const FILE_SOFT_DELETE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const FILE_AUDIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const FILE_FAILED_RETENTION_MS = 24 * 60 * 60 * 1000;
export const FILE_MAINTENANCE_INTERVAL_MS = 60 * 1000;
export const FILE_RECONCILIATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const FILE_MAX_ACTIVE_RESERVATIONS_PER_USER = 5;
export const FILE_MAX_ACTIVE_RESERVATIONS_PER_ORGANIZATION = 20;

export const FILE_PLAN_QUOTAS = Object.freeze({
  FREE: { maxBytes: 100 * 1024 * 1024, maxFiles: 100 },
  PRO: { maxBytes: 10 * 1024 * 1024 * 1024, maxFiles: 10_000 },
});

export const ACCEPTED_FILE_MIME_TYPES = Object.freeze({
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
});
