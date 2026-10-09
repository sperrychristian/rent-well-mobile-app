import {
  extensionOf,
  nameFromFile,
  guessMimeType,
  isImage,
  iconFor,
  daysUntil,
  expiryTag,
  formatSize,
} from './documentHelpers';

const word_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('extensionOf', () => {
  test('gives the last extension in lower case', () => {
    expect(extensionOf('Lease.PDF')).toBe('.pdf');
    expect(extensionOf('archive.tar.gz')).toBe('.gz');
  });

  test('gives nothing when there is no extension or no name', () => {
    expect(extensionOf('lease')).toBe('');
    expect(extensionOf(null)).toBe('');
    expect(extensionOf(undefined)).toBe('');
  });
});

describe('nameFromFile', () => {
  test('drops only the last extension', () => {
    expect(nameFromFile('lease.pdf')).toBe('lease');
    expect(nameFromFile('my.lease.v2.docx')).toBe('my.lease.v2');
    expect(nameFromFile('notes')).toBe('notes');
  });

  test('empty values give empty text', () => {
    expect(nameFromFile(undefined)).toBe('');
  });
});

describe('guessMimeType', () => {
  test('knows PDFs, images, and Word files in any case', () => {
    expect(guessMimeType('a.pdf')).toBe('application/pdf');
    expect(guessMimeType('scan.JPG')).toBe('image/jpeg');
    expect(guessMimeType('scan.jpeg')).toBe('image/jpeg');
    expect(guessMimeType('photo.png')).toBe('image/png');
    expect(guessMimeType('photo.heic')).toBe('image/heic');
    expect(guessMimeType('old.doc')).toBe('application/msword');
    expect(guessMimeType('new.docx')).toBe(word_type);
  });

  test('falls back to a generic type', () => {
    expect(guessMimeType('data.zip')).toBe('application/octet-stream');
    expect(guessMimeType('noextension')).toBe('application/octet-stream');
  });
});

describe('isImage and iconFor', () => {
  test('isImage checks the image/ prefix', () => {
    expect(isImage('image/png')).toBe(true);
    expect(isImage('application/pdf')).toBe(false);
    expect(isImage(undefined)).toBe(false);
  });

  test('one icon per kind of file', () => {
    expect(iconFor('application/pdf')).toBe('document-text-outline');
    expect(iconFor('image/jpeg')).toBe('image-outline');
    expect(iconFor('application/msword')).toBe('document-outline');
    expect(iconFor(word_type)).toBe('document-outline');
    expect(iconFor('application/zip')).toBe('document-attach-outline');
    expect(iconFor(undefined)).toBe('document-attach-outline');
  });
});

describe('daysUntil with a fixed today', () => {
  test('counts whole days forward and backward', () => {
    expect(daysUntil('2026-10-18', '2026-10-08')).toBe(10);
    expect(daysUntil('2026-10-08', '2026-10-08')).toBe(0);
    expect(daysUntil('2026-09-28', '2026-10-08')).toBe(-10);
  });

  test('crosses month, year, and leap day boundaries', () => {
    expect(daysUntil('2026-11-01', '2026-10-31')).toBe(1);
    expect(daysUntil('2027-01-01', '2026-12-31')).toBe(1);
    expect(daysUntil('2028-03-01', '2028-02-28')).toBe(2);
  });

  test('is not thrown off by daylight saving changes', () => {
    expect(daysUntil('2026-11-02', '2026-10-31')).toBe(2);
    expect(daysUntil('2027-03-15', '2027-03-13')).toBe(2);
  });
});

describe('daysUntil without a today', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('uses the real local day when no today is passed', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 8, 22, 0));
    expect(daysUntil('2026-10-18')).toBe(10);
  });
});

describe('expiryTag', () => {
  const today = '2026-10-08';

  test('no end date means no tag', () => {
    expect(expiryTag(null, today)).toBeNull();
    expect(expiryTag('', today)).toBeNull();
    expect(expiryTag(undefined, today)).toBeNull();
  });

  test('a passed date is expired', () => {
    expect(expiryTag('2026-10-07', today)).toEqual({ text: 'Expired', expired: true });
  });

  test('today, tomorrow, and later days read naturally', () => {
    expect(expiryTag('2026-10-08', today)).toEqual({ text: 'Expires today', expired: false });
    expect(expiryTag('2026-10-09', today)).toEqual({ text: 'Expires in 1 day', expired: false });
    expect(expiryTag('2026-10-18', today)).toEqual({ text: 'Expires in 10 days', expired: false });
  });

  test('shows up to 60 days out and nothing after that', () => {
    expect(expiryTag('2026-12-07', today)).toEqual({ text: 'Expires in 60 days', expired: false });
    expect(expiryTag('2026-12-08', today)).toBeNull();
  });
});

describe('formatSize', () => {
  test('no size gives empty text', () => {
    expect(formatSize(0)).toBe('');
    expect(formatSize(undefined)).toBe('');
  });

  test('small files show at least 1 KB', () => {
    expect(formatSize(500)).toBe('1 KB');
    expect(formatSize(2048)).toBe('2 KB');
  });

  test('a megabyte and up shows one decimal', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});
