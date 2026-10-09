// the kinds of paperwork a landlord keeps for each property
export const document_categories = [
  'Lease',
  'Addendum',
  'Checklist',
  'Inspection report',
  'Insurance',
  'Notice',
  'Other',
];

// only these two get an end date, the rest don't run out
export const dated_categories = ['Lease', 'Addendum'];

// leases ending within this many days count as expiring soon
export const expiring_soon_days = 60;

// anything bigger gets turned away so the phone doesn't fill up
export const max_document_bytes = 25 * 1024 * 1024;

// what the picker lets through: PDFs, images, and Word files
export const allowed_mime_types = [
  'application/pdf',
  'image/*',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
