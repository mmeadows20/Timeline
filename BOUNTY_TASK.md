# Bounty Objective: PLAN (agreed by Sarah, 20 Oct): daily usage allowance, rules file, rewarded ads, bot enforcement
Target: sarahvphillips/Timeline Issue #3
URL: https://github.com/sarahvphillips/Timeline/issues/3

## Issue Description
**For Grok Build.** This is the agreed plan from Sarah on 20 Oct 2026. It brings together the decisions spread across the comments on #2, and it's cleared to build in this order.

## Build order
1. Load events once per session plus the sync doc (from #2; already in build 207).
2. Upload 1.0.5 (version code 5) and make sure a test build opens reliably.
3. Daily usage allowance plus the usage rules file (below).
4. Rewarded ads to unlock more allowance, added only once the AdMob library no longer makes the Play build close.

## 1. Daily usage allowance
- The app counts its own Firestore reads, writes and deletes, and saves them once per session to `users/{uid}/meta/usage` (`date` as the UK day, `reads`, `writes`, `deletes`, `points`, `adsUnlocked`, `lastSaved`).
- It resets at **midnight UK time** (Europe/London).
- Target: an everyday user uses about 500 reads and 100 writes a day, so that 100 daily users fit inside the free tier (50K reads and 20K writes).
- When a user is over, show a friendly "you've used today's free allowance" message. Pause heavy features (full re-sync, bulk imports, bot imports); viewing the cached data keeps working.

## 2. Usage rules file (admin-editable, no rebuild needed)
- Store it in `config/usageRules`. It's read once per session and cached, editable from the Admin area, and admin-only in Firestore rules.
- Fields: `dailyAllowance`, `resetTz: "Europe/London"`, `adUnlockPoints`, `version`, global weights `wR`, `wW` and `wD` (start at 1, 3 and 1), and `actions`, a map of action names to `{reads, writes, deletes}`, with an optional `points` override and `enabled` flag per action.
- Points = reads×wR + writes×wW + deletes×wD.
- Starting weights, measured on 20 Oct and matching the console (2.8K reads and 771 writes for the whole test morning):
  - Add an event (note, days between, meal or photo): about 4 reads and 3 writes. Photos also add about 260 KB of Storage, so always resize before uploading (the API has a 5 MB limit).
  - Bulk text edit: about 2 reads and 2 writes per item, plus one full scan.
  - Delete: about 4 reads, 2 writes and 1 delete. Storage files are removed too.
  - Word to Int lookup: about 1 read when cached, plus 1 read per saved word on a cold cache.
  - Full event load: 1 read per event (about 520 now).

## 3. Rewarded ads
- Use an AdMob rewarded ad, which grants the reward only when it has been watched to the end **and Google confirms it with server-side verification (SSV)**.
- A Cloud Function receives the SSV callback and writes the unlock. The app can never grant one to itself.

## 4. Bots must obey limits and locks
- **All enforcement happens on the server**, in the bot API (Cloud Function). Nothing relies on the bot's prompt, which a user can edit.
- Each user has their own key, tied to one uid. The API checks `config/usageRules` plus `meta/usage` and charges each action. A user over their allowance gets **429**; only the app can unlock more, through an ad.
- Paid and locked features are checked against `users/{uid}/entitlements`. These are written **only** by Cloud Functions after a verified Play Billing purchase or AdMob SSV. Firestore rules deny client and bot writes to entitlements, usage and config. Locked features return **402/403**.
- Bot templates ship only the API, with no direct Firestore access, service accounts or admin key.
- Batch routes are charged per item, and the per-key rate limit stays at 60 a minute.
- Keys can be revoked per user, and usage is logged per key.

## Who does what
- **Grok Build (app):** the usage counting, the `meta/usage` doc, the `config/usageRules` doc and its Admin editor, the over-limit message, the ads, the SSV Cloud Function, entitlements and the Firestore rules.
- **Timeline Bot (bot API):** reads the same rules and usage docs, charges each bot request, and returns 429/402. This follows once the app side exists.

Related: #1 (date-only events), #2 (cutting Firestore reads and writes).

## Instructions for Kuro (Autonomous Solver):
1. Use skills: `systematic-debugging` and `code-review-and-quality`.
2. Inspect the repository structure, locate relevant files, and understand the bug/feature.
3. Apply the minimal, robust fix or implementation.
4. Run any existing test suites or linters in the workspace.
5. Ensure the fix adheres to the project's existing code style.
6. When done, output a summary of files modified and verification results.
