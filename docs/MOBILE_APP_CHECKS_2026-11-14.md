# Home-screen app and mobile UI checks — 14 November 2026

Work remains on `development`. No commit, push or deployment was performed.

## Home-screen experience

- `/install` explains installation on iPhone/iPad and Android. It is linked from the mobile menu and footer.
- Android browsers that expose the install prompt get an explicit **Add to home screen** button. The prompt is retained across client navigation and consumed once per browser event.
- iPhone/iPad instructions use Safari → Share (or More → Share) → Add to Home Screen. Leave **Open as Web App** on if offered.
- The manifest defines one app identity, root scope/start URL, standalone display, the Jagdamba name and 192/512px icons. Apple gets a 180px touch icon. The maskable icon uses the existing bus brand mark with generous safe padding.
- The production service worker caches only the generic offline page and four brand icons. It does not cache account/booking pages, APIs, prices or transactions. Offline navigation shows a reconnect/retry screen; reconnecting restores the normal page and authentication flow. Registration is disabled during `next dev`.

## Mobile changes

- Safe-area padding for notches/home indicators; pinch zoom remains enabled.
- Mobile form text is at least 16px to avoid Safari focus zoom. Native date/select controls can shrink inside narrow columns.
- Brand text can wrap on narrow headers; menu, theme, primary buttons and dialog-close controls have larger touch targets.
- Closed mobile menus no longer leave hidden links exposed to keyboard/accessibility navigation.
- Standalone Section pages receive fixed-header clearance through the shared route-transition wrapper.
- Phone users select package-builder stops from full-width buttons with descriptions and selection state. Larger screens retain the existing map. Both views use the same selected stops, route and pricing flow.
- CMS page cards stay within the viewport even with long page addresses.

## Coverage and evidence

The audit inventories all **52 page templates**, including the new install page. Real development sessions and synthetic fixtures cover public catalogue/detail pages, custom CMS rendering/preview/editor, authentication, customer account/support/booking details, admin screens and driver trips. Vehicle and shared-trip checkout add two states, for **54 page/state cases**. This checks representative instances of dynamic templates; it does not enumerate every database record or every possible form/error state.

| Check | Coverage | Result |
|---|---|---|
| Chrome layouts | 54 cases × 10 viewport sizes | 540 passed |
| WebKit layouts | 54 cases × 4 phone/landscape sizes | 216 passed |
| Interactive layouts | 10 admin editors, site menu, touch stop selection, route ordering, package summary × 3 sizes | 42 passed |
| Home-screen browser suite | Manifest/icons/Apple metadata, real Chrome install eligibility, prompt across navigation, installed state, cache/privacy boundary, offline/retry, phone guide | 5 groups passed |
| Project TypeScript and lint | Whole current development workspace | Passed |
| Optimized build | Isolated source copy; direct Next build; no deployment/migration hooks | Passed |
| Final header-spacing regression | 11 affected public pages × 6 sizes × 2 engines, normal motion | 132 passed; home-screen suite passed again |

Chrome sizes: **320×568, 360×800, 375×667, 390×844, 412×915, 430×932, 768×1024, 1024×768, 1440×900, 844×390**. WebKit sizes: **320×568, 390×844, 430×932, 844×390**. Tables intentionally scroll inside their containers. Final verified cases have no document overflow, clipped actionable content, missing-page render or browser runtime error. Screenshots/contact sheets were visually reviewed.

The first audit found the CMS overflow and header/touch issues described above. Test harness corrections included Windows-safe screenshot names, waiting for loaded data/panels, targeting stop buttons rather than interest filters, and separating real Chrome eligibility from deterministic prompt testing. WebKit account navigation/request-abort failures were rerun as a stable account-only sequence; all 40 account checks passed. Native eligibility uses a disposable regular Chrome profile; the synthetic one-use prompt uses a separate context. No real application was installed onto the user's desktop.

All synthetic development accounts, sessions, bookings, support messages, CMS pages, catalogue entries and shared departure resources were removed and their absence verified. No real email, payment, SMS, storage-provider write or production database access was used. The normal build cache and existing local server were left alone. Original unrelated files, including the pending parent/ticket/notification fixes, were hash-verified against a task-start backup.

## Repeating the home-screen check

Use a local optimized build (not `vercel-build`), then:

```text
npm run test:home-screen -- --base=http://127.0.0.1:PORT --browser-module=PATH_TO_INSTALLED_PLAYWRIGHT
```

The test accepts only localhost/127.0.0.1. It uses a disposable browser profile, performs no account mutations and removes its own temporary profile afterward. No project dependency was added for browser automation.

## Device check after publication

Browser automation covers rendering in Chrome and WebKit, not a physical iPhone/Android installation. After an authorized HTTPS deployment, check Add to Home Screen on a real iPhone and Android phone, launch the icon, verify standalone/safe-area behavior, exercise the virtual keyboard and login return, then test airplane-mode/reconnect. Native OS prompts, keyboard/toolbars and device-specific behavior remain this manual check. The app's live features require an internet connection.

Primary platform references: [MDN installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [MDN install prompts](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt), [WebKit home-screen web apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
