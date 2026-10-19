/**
 * Test ads until an AdMob app exists for com.sarahphillips.timelineapp.
 * Test banners do not pay. They are what a Play testing build should show.
 *
 * When the AdMob app is created:
 * 1. Set USE_TEST_ADS to false.
 * 2. Paste the banner unit id below.
 * 3. Replace the two test app ids in app.json with the AdMob app ids.
 * 4. Make a new Android build. The old binary keeps the test ids.
 */
export const USE_TEST_ADS = true;

/** AdMob → Apps → ad units → Banner. Leave blank while USE_TEST_ADS is true. */
export const LIVE_BANNER_UNIT = '';

export const TEST_BANNER_UNIT = 'ca-app-pub-3940256099942544/6300978111';

export function bannerUnitId(testIds) {
  if (USE_TEST_ADS) return (testIds && (testIds.ADAPTIVE_BANNER || testIds.BANNER)) || TEST_BANNER_UNIT;
  return LIVE_BANNER_UNIT || TEST_BANNER_UNIT;
}
