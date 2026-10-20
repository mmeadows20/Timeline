/** Bump APP_BUILD whenever a testable change ships. */
export const APP_NAME = 'Timeline';
export const APP_VERSION = '1.0.9';
export const APP_BUILD = 215;
export const APP_BUILD_DATE = '2026-10-20';

export function versionLabel() {
  return `${APP_VERSION} (${APP_BUILD})`;
}

export function versionLine() {
  return `v${APP_VERSION} · ${APP_BUILD} · ${APP_BUILD_DATE}`;
}
