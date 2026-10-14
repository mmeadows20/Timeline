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
  const raw = String(text || '').trim();
  const colon = raw.match(/(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (colon) return validDate(+colon[1], +colon[2], +colon[3], +colon[4], +colon[5], +colon[6]);
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (iso) return validDate(+iso[1], +iso[2], +iso[3], +iso[4], +iso[5], +iso[6]);
  return null;
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

function bytesToText(bytes) {
  if (!bytes || !bytes.length) return '';
  const limit = Math.min(bytes.length, 2 * 1024 * 1024);
  let text = '';
  for (let i = 0; i < limit; i += 1) text += String.fromCharCode(bytes[i]);
  return text;
}

function datesInText(text) {
  const hits = [];
  const re = /(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/g;
  let m;
  while ((m = re.exec(text))) {
    const date = validDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]);
    if (date) hits.push(date);
  }
  return hits;
}

function exifDatesInBytes(bytes) {
  return datesInText(bytesToText(bytes));
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
  const walked = walkVideoBoxes(bytes, 0);
  if (walked) return walked;
  const tag = (a, b, c, d) => [a, b, c, d];
  const tags = [tag(0x6d, 0x76, 0x68, 0x64), tag(0x6d, 0x64, 0x68, 0x64)];
  for (let i = 0; i < bytes.length - 20; i += 1) {
    const hit = tags.some((t) => bytes[i] === t[0] && bytes[i + 1] === t[1] && bytes[i + 2] === t[2] && bytes[i + 3] === t[3]);
    if (!hit) continue;
    const when = boxDate(bytes, i + 8, bytes[i + 4]);
    if (when) return when;
  }
  const written = datesInText(bytesToText(bytes));
  return written[0] || null;
}

function walkVideoBoxes(bytes, depth) {
  if (!bytes || bytes.length < 16 || depth > 6) return null;
  let i = 0;
  while (i + 8 <= bytes.length) {
    let size = u32(bytes, i);
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    let header = 8;
    if (size === 1 && i + 16 <= bytes.length) {
      size = u32(bytes, i + 8) * 4294967296 + u32(bytes, i + 12);
      header = 16;
    }
    if (size < header) break;
    const end = i + size;
    if (end > bytes.length) break;
    if (type === 'moov' || type === 'trak' || type === 'mdia' || type === 'udta' || type === 'meta') {
      const inner = walkVideoBoxes(bytes.subarray(i + header, end), depth + 1);
      if (inner) return inner;
    }
    if ((type === 'mvhd' || type === 'mdhd') && i + header + 8 <= bytes.length) {
      const when = boxDate(bytes, i + header + 4, bytes[i + header]);
      if (when) return when;
    }
    i = end;
  }
  return null;
}

function namedDate(y, mo, d, h, mi, s) {
  const date = validDate(y, mo, d, h, mi, s);
  return date ? { date, hasTime: true } : null;
}

export function dateFromFileName(name) {
  const text = decodeURIComponent(String(name || ''));
  const ymdTime = /(\d{4})[-_. ]?(\d{2})[-_. ]?(\d{2})[^\d]{0,6}(\d{2})[-_.: ]?(\d{2})[-_.: ]?(\d{2})/g;
  let m;
  while ((m = ymdTime.exec(text))) {
    const hit = namedDate(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]);
    if (hit) return hit.date;
  }
  const dmyTime = /(?:^|[^\d])(\d{2})[-_. ](\d{2})[-_. ](\d{4})[^\d]{0,6}(\d{2})[-_.: ](\d{2})[-_.: ](\d{2})/g;
  while ((m = dmyTime.exec(text))) {
    const day = +m[1];
    const month = +m[2];
    const asDayFirst = namedDate(+m[3], month, day, +m[4], +m[5], +m[6]);
    if (asDayFirst && (day > 12 || month <= 12)) return asDayFirst.date;
    const asMonthFirst = namedDate(+m[3], day, month, +m[4], +m[5], +m[6]);
    if (asMonthFirst) return asMonthFirst.date;
  }
  const ymd = /(?:^|[^\d])(\d{4})[-_. ]?(\d{2})[-_. ]?(\d{2})(?:[^\d]|$)/g;
  while ((m = ymd.exec(text))) {
    const date = validDate(+m[1], +m[2], +m[3], 0, 0, 0);
    if (date) return date;
  }
  return null;
}

export function describeCapture(from) {
  if (from === 'exif') return 'Time written in the photo';
  if (from === 'video') return 'Time written in the video';
  if (from === 'name') return 'Time written in the file name';
  if (from === 'name-date') return 'Date written in the file name. No clock time was stored.';
  return '';
}
