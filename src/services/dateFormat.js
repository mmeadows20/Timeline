import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';

/** Day first: 25/09. Default for Timeline. */
export const DATE_FORMAT_DMY = 'dmy';
/** Month first: 09/25. */
export const DATE_FORMAT_MDY = 'mdy';

const KEY_BASE = '@timeline_date_format';

function storageKey() {
  const uid = auth.currentUser?.uid || 'guest';
  return `${KEY_BASE}_${uid}`;
}

export function normalizeDateFormat(value) {
  return value === DATE_FORMAT_MDY ? DATE_FORMAT_MDY : DATE_FORMAT_DMY;
}

export function calendarParts(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() };
  }
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [y, m, d] = text.split('-').map(Number);
    return { y, m, d };
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return { y: parsed.getFullYear(), m: parsed.getMonth() + 1, d: parsed.getDate() };
}

export function formatDayMonth(value, format = DATE_FORMAT_DMY) {
  const p = calendarParts(value);
  if (!p) return '';
  const dd = String(p.d).padStart(2, '0');
  const mm = String(p.m).padStart(2, '0');
  return normalizeDateFormat(format) === DATE_FORMAT_MDY ? `${mm}/${dd}` : `${dd}/${mm}`;
}

export function formatFullDate(value, format = DATE_FORMAT_DMY) {
  const p = calendarParts(value);
  if (!p) return '';
  const dd = String(p.d).padStart(2, '0');
  const mm = String(p.m).padStart(2, '0');
  return normalizeDateFormat(format) === DATE_FORMAT_MDY ? `${mm}/${dd}/${p.y}` : `${dd}/${mm}/${p.y}`;
}

export async function getDateFormat() {
  try {
    return normalizeDateFormat(await AsyncStorage.getItem(storageKey()));
  } catch {
    return DATE_FORMAT_DMY;
  }
}

export async function saveDateFormat(format) {
  const next = normalizeDateFormat(format);
  await AsyncStorage.setItem(storageKey(), next);
  return next;
}
