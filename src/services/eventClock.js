function pad(n) {
  return String(n).padStart(2, '0');
}

/** A date with no real clock, or the noon/midnight stamp the edit screens write. */
export function isPlaceholderClock(raw) {
  const text = String(raw || '').trim();
  if (!text) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return true;
  if (/T00:00:00(\.0+)?Z$/.test(text)) return true;
  if (/T12:00:00(\.0+)?Z$/.test(text)) return true;
  return false;
}

export function hasRealClock(raw) {
  const text = String(raw || '').trim();
  if (!/T\d{2}:\d{2}/.test(text)) return false;
  return !isPlaceholderClock(text);
}

export function localDayKey(iso) {
  const text = String(iso || '').trim();
  const parsed = new Date(text);
  if (!text || Number.isNaN(parsed.getTime())) return text.slice(0, 10);
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

export function keptClockLabel(iso) {
  if (!hasRealClock(iso)) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

/**
 * Edit screens only send a calendar day. Put the previous clock, such as 18:00, back on that day.
 * A newly chosen time is left alone.
 */
export function preserveEventClock(nextDate, prevDate) {
  if (!nextDate) return prevDate || nextDate;
  if (!hasRealClock(prevDate) || !isPlaceholderClock(nextDate)) return nextDate;
  const prev = new Date(prevDate);
  const day = String(nextDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(prev.getTime())) return nextDate;
  const combined = new Date(`${day}T${pad(prev.getHours())}:${pad(prev.getMinutes())}:${pad(prev.getSeconds())}`);
  if (Number.isNaN(combined.getTime())) return nextDate;
  return combined.toISOString();
}
