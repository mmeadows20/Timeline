import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';

function key() {
  const uid = auth?.currentUser?.uid;
  return uid ? `@timeline_show_workshop_${uid}` : '@timeline_show_workshop_guest';
}

/** Off for new installs, including testers. Turn on in Settings → Show workshop while building. */
export async function getShowWorkshop() {
  try {
    const raw = await AsyncStorage.getItem(key());
    if (raw == null) return false;
    return raw === '1';
  } catch {
    return false;
  }
}

export async function saveShowWorkshop(on) {
  await AsyncStorage.setItem(key(), on ? '1' : '0');
  return !!on;
}
