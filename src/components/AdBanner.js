import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { bannerUnitId } from '../services/adUnits';

function inExpoGo() {
  return Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
}

function loadAds() {
  if (Platform.OS === 'web' || inExpoGo()) return null;
  try {
    return require('react-native-google-mobile-ads');
  } catch (e) {
    return null;
  }
}

/** Banner on Home. Expo Go and the browser show a label. The Android build shows a test advert. */
export default function AdBanner() {
  const insets = useSafeAreaInsets();
  const bottomPad = 8 + Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 0);
  const ads = loadAds();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!ads);

  useEffect(() => {
    if (!ads) return undefined;
    let gone = false;
    (async () => {
      try {
        if (ads.AdsConsent) {
          try {
            await ads.AdsConsent.requestInfoUpdate();
            await ads.AdsConsent.loadAndShowConsentFormIfRequired();
          } catch (e) {
            // No privacy message in AdMob yet. Test ads can still load.
          }
        }
        const mobileAds = ads.default;
        await mobileAds().initialize();
        if (!gone) setReady(true);
      } catch (e) {
        if (!gone) setFailed(true);
      }
    })();
    return () => {
      gone = true;
    };
  }, [ads]);

  if (!ads || failed || !ready) {
    if (Platform.OS === 'web' || inExpoGo() || !ads) {
      return (
        <View style={[styles.slot, { paddingBottom: bottomPad }]}>
          <Text style={styles.label}>Advert · shows in the Android test build</Text>
        </View>
      );
    }
    return null;
  }

  const { BannerAd, BannerAdSize } = ads;
  return (
    <View style={[styles.slot, { paddingBottom: bottomPad }]}>
      <BannerAd
        unitId={bannerUnitId(ads.TestIds)}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = {
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minHeight: 36,
  },
  label: { color: '#94a3b8', fontSize: 12 },
};