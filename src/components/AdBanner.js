import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { bannerUnitId } from '../services/adUnits';

function loadAds() {
  if (Platform.OS === 'web') return null;
  try {
    return require('react-native-google-mobile-ads');
  } catch (e) {
    return null;
  }
}

/** Banner on Home. Expo Go and the browser show a label. The Android build shows a test advert. */
export default function AdBanner() {
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

  if (Platform.OS === 'web' || !ads || failed || !ready) {
    if (Platform.OS !== 'web') return null;
    return (
      <View style={styles.slot}>
        <Text style={styles.label}>Advert · shows in the Android test build</Text>
      </View>
    );
  }

  const { BannerAd, BannerAdSize } = ads;
  return (
    <View style={styles.slot}>
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
