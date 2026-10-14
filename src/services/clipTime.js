/** Recording time written in a photo, video, or file name. Not the moment it was picked. */

const QT_EPOCH_MS = Date.UTC(1904, 0, 1);

function validDate(y, mo, d, h, mi, s) {
  if (y < 1990 || y > 2100) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (h < 0 || h > 23 || mi < 0 || mi > 59 || s < 0 || s > 59) return null;
  const date = new Date(y, mo - 1, d, h, mi, s, 0);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

function fromExifString(text) {
  const m = String(text || '').match(/(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return validDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]);
}

function walkExif(value, out) {
  if (!value) return;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = fromExifString(value);
    if (date) out.push({ date, raw: String(value) });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => walkExif(item, out));
    return;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach((key) => {
      const date = fromExifString(key) || fromExifString(value[key]);
      if (date && /original|digitized|datetime/i.test(key)) {
        out.push({ date, key, raw: String(value[key]) });
      }
      walkExif(value[key], out);
    });
  }
}

export function dateFromExifObject(exif) {
  const hits = [];
  walkExif(exif, hits);
  const original = hits.find((hit) => /original/i.test(hit.key || ''));
  return (original || hits[0] || {}).date || null;
}

function u32(bytes, i) {
  return ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
}

function exifDatesInBytes(bytes) {
  if (!bytes || !bytes.length) return [];
  let text = '';
  const limit = Math.min(bytes.length, 512 * 1024);
  for (let i = 0; i < limit; i += 1) text += String.fromCharCode(bytes[i]);
  const hits = [];
  const re = /(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/g;
  let m;
  while ((m = re.exec(text))) {
    const date = validDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]);
    if (date) hits.push(date);
  }
  return hits;
}

export function dateFromImageBytes(bytes) {
  const hits = exifDatesInBytes(bytes);
  if (hits.length >= 2) return hits[1];
  return hits[0] || null;
}

function boxDate(bytes, i, version) {
  const seconds = version === 1 ? u32(bytes, i) * 4294967296 + u32(bytes, i + 4) : u32(bytes, i);
  if (!seconds) return null;
  const date = new Date(QT_EPOCH_MS + seconds * 1000);
  if (date.getFullYear() < 1990 || date.getFullYear() > 2100) return null;
  return date;
}

export function dateFromVideoBytes(bytes) {
  if (!bytes || bytes.length < 16) return null;
  let i = 0;
  while (i + 8 <= bytes.length) {
    let size = u32(bytes, i);
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    let header = 8;
    if (size === 1 && i + 16 <= bytes.length) {
      size = u32(bytes, i + 8) * 4294967296 + u32(bytes, i + 12);
      header = 16;
    }
    if (size < header || i + size > bytes.length) break;
    if (type === 'moov' || type === 'trak' || type === 'mdia') {
      const inner = dateFromVideoBytes(bytes.subarray(i + header, i + size));
      if (inner) return inner;
    }
    if ((type === 'mvhd' || type === 'mdhd') && i + header + 8 <= bytes.length) {
      const version = bytes[i + header];
      const when = boxDate(bytes, i + header + 4, version);
      if (when) return when;
    }
    i += size;
  }
  return null;
}

export function dateFromFileName(name) {
  const text = String(name || '');
  const re = /(\d{4})[-_. ]?(\d{2})[-_. ]?(\d{2})[^\d]{0,3}(\d{2})[-_.: ]?(\d{2})[-_.: ]?(\d{2})/g;
  let m;
  while ((m = re.exec(text))) {
    const date = validDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]);
    if (date) return date;
  }
  return null;
}

export function describeCapture(from) {
  if (from === 'exif') return 'Time written in the photo';
  if (from === 'video') return 'Time written in the video';
  if (from === 'name') return 'Time written in the file name';
  return '';
}
