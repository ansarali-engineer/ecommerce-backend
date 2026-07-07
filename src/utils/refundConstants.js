export const REFUND_WINDOW_DAYS = 30;
export const MAX_PROOF_IMAGES = 5;
export const MAX_IMAGE_SIZE_BYTES = 500 * 1024;

export const REFUND_STATUSES = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  INFO_REQUESTED: 'info_requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSING: 'processing',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled'
};

export const CANCELLABLE_STATUSES = [
  REFUND_STATUSES.PENDING,
  REFUND_STATUSES.UNDER_REVIEW,
  REFUND_STATUSES.INFO_REQUESTED,
  'requested'
];

export const ADMIN_ACTIONABLE = {
  approve: [REFUND_STATUSES.PENDING, REFUND_STATUSES.UNDER_REVIEW, REFUND_STATUSES.INFO_REQUESTED, 'requested'],
  reject: [REFUND_STATUSES.PENDING, REFUND_STATUSES.UNDER_REVIEW, REFUND_STATUSES.INFO_REQUESTED, 'requested'],
  requestInfo: [REFUND_STATUSES.PENDING, REFUND_STATUSES.UNDER_REVIEW, 'requested'],
  receive: [REFUND_STATUSES.APPROVED],
  refund: [REFUND_STATUSES.PROCESSING, REFUND_STATUSES.APPROVED]
};

export const normalizeStatus = (status) => {
  if (status === 'requested') return REFUND_STATUSES.PENDING;
  if (status === 'completed') return REFUND_STATUSES.REFUNDED;
  return status;
};

export const STATUS_LABELS = {
  pending: 'Pending',
  under_review: 'Under Review',
  info_requested: 'Info Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  processing: 'Processing',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
  requested: 'Pending',
  completed: 'Refunded'
};

export const RETURN_REASONS = [
  { value: 'damaged', label: 'Item arrived damaged' },
  { value: 'defective', label: 'Item is defective' },
  { value: 'wrong_item', label: 'Wrong item received' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'no_longer_needed', label: 'No longer needed' },
  { value: 'better_price_found', label: 'Found better price elsewhere' },
  { value: 'late_delivery', label: 'Late delivery' },
  { value: 'other', label: 'Other' }
];
