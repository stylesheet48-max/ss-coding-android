# SS Coding — Source Repository Audit

This audit documents the upstream **Acode** codebase cloned from `https://github.com/Acode-Foundation/Acode.git` (`HEAD` at `31c608095b273ce1346b69bb6e713947e4860578`, submodule `codemirror-lsp-client` at `db6930c2b6db67e14978f08ae8f5aeb149d29468`) prior to transforming it into **SS Coding** (`com.stylesheet.sscoding`).

---

## 1. Existing Architecture

Acode is a hybrid Android application built with **Apache Cordova (`cordova-android` ^15.1.0, `cordova` 13.0.0)** hosting a single-page web application inside an Android WebView (`www/index.html`) bundled via **Rspack (`@rspack/core` ^2.2.0)** and **SWC + custom JSX loader (`utils/custom-loaders/html-tag-jsx-loader.js`)**.

- **DOM & Component Framework**: Lightweight DOM manipulation via `html-tag-js` (`tag()`, `Ref`, `Reactive`) with JSX syntax compiled by `html-tag-jsx-loader.js` into `tag(...)` calls. No React/Vue/Angular runtime.
- **Navigation & Page Stack**: Custom `<wc-page>` Web Component (`src/components/WebComponents/wcPage.js`) paired with `actionStack` (`src/lib/actionStack.js`) handling Android hardware Back button (`backbutton` event in `src/main.js`) and `motion` transitions.
- **Code Editor Engine**: **CodeMirror 6** (`@codemirror/*` ^6.x, `@lezer/*`, `@emmetio/codemirror6-plugin`, `@acode.app/canvas-view`), managed by `EditorManager` (`src/lib/editorManager.js`) and `EditorFile` (`src/lib/editorFile.js`), with LSP integration (`src/cm/lsp/` + `codemirror-lsp-client/` submodule) and Ace compatibility shims (`ensureAceCompatApi` in `src/main.js`, `createSessionProxy` in `src/lib/editorFile.js`) for plugins.
- **Terminal**: **xterm.js (`@xterm/xterm` ^6.0.0)** and addons (`fit`, `attach`, `webgl`, `search`, `web-links`, `unicode11`, `image`) in `src/components/terminal/`, backed by the native Android `com.foxdebug.acode.rk.exec.terminal` Cordova plugin (`TerminalService.java`, `ProcessManager.java`, `AlpineDocumentProvider.java`) and optional proot plugin (`com.foxdebug.acode.rk.exec.proot`).
- **File System & Storage**: Virtual FS layer (`src/fileSystem/`) unifying local files, Android Storage Access Framework (`cordova-plugin-sdcard`), internal/Alpine document provider (`AlpineDocumentProvider.java`), FTP (`cordova-plugin-ftp`), and SFTP (`cordova-plugin-sftp`).
- **Native Bridge**: 18 local/vendored Cordova plugins under `src/plugins/` plus 4 npm Cordova plugins (`cordova-clipboard`, `cordova-plugin-device`, `cordova-plugin-file`, `cordova-android`).

---

## 2. Important Source Files & UI Entry Points

### Build & App Configuration
- `package.json` — Scripts (`build`, `setup`, `test`, `lint`, `format`, `check`, `typecheck`), Cordova plugin registry, JS dependencies.
- `config.xml` — Cordova widget ID (`com.foxdebug.acode`), version (`1.13.5`, `android-versionCode="1011"`), `<name>Acode</name>`, intent filters, deep-link scheme `acode://`, 16 `<activity-alias>` launcher icons, hooks, and Android preferences (`minSdkVersion` 26, `targetSdkVersion` 36, `AndroidWindowSplashScreen*`).
- `rspack.config.js` — Multi-entry bundler (`boot`, `main`, `console`, `consoleWorker`, `searchInFilesWorker`, `searchIndexWorker`, `htmlLspWorker`, `cssLspWorker`, `jsonLspWorker`, `typescriptLspWorker`) outputting to `www/build/`.
- `build-extras.gradle` / `proguard-rules.pro` — Release minification, resource shrinking, packaging exclusions.
- `utils/config.js` — Paid/free variant switcher (`ID_PAID = "com.foxdebug.acode"`, `ID_FREE = "com.foxdebug.acodefree"`), `res/android/values/ic_launcher_background.xml` writer, AdMob sync.
- `utils/setup.js` — Submodule check, dependency installation, `cordova platform add android`, plugin installation.
- `utils/scripts/build.sh` — Build orchestrator invoking `utils/config.js`, `rspack`, and `cordova build android`.
- `hooks/modify-java-files.js` — Patches Cordova `SystemWebView.java`, `SystemWebViewEngine.java`, `CordovaWebView*.java` for input types and native context menu suppression.
- `hooks/post-process.js` — Overlays `res/android/` onto `platforms/android/app/src/main/res/`, syncs `src/plugins/system/android` Java sources, patches `targetSdkVersion` (28 when `fdroid.bool` missing/true, 36 otherwise), enables `useLegacyPackaging`, injects `WeakReference<Context>` and realme splash workaround into `MainActivity.java`, strips `MAIN/LAUNCHER` from `MainActivity` so activity-aliases control launcher icons.
- `hooks/immersive-fullscreen.js` — Immersive fullscreen setup.

### Core Web UI Entry Points
- `www/index.html` — Initial HTML shell, inline dark fallback splash (`#splash`, `#20202c`, `logo.svg`), WebView version & storage error guard, `<title>Acode</title>`, `<wc-page id="root" class="primary">`.
- `src/boot.js` — Dynamic loader switching between dev server and `./build/main.js` + `./build/main.css`.
- `src/main.js` — App lifecycle (`deviceready`, `pause`, `resume`, `backbutton`, `menubutton`), storage resolution, permissions, theme & settings initialization, header/sidebar/floating togglers, welcome tab launch, update checks, main & file context menus.
- `src/main.scss` — Global layout, `.open-file-list`, `.icon`, `.section`, `.button-container`, `.cursor-menu`, floating togglers (`#header-toggler`, `#sidebar-toggler`, `#quicktools-toggler`).
- `src/styles/` — `page.scss`, `list.scss`, `mixins.scss`, `keyframes.scss`, `fileInfo.scss`, `markdown.scss`, `codemirror.scss`, `notification.scss`, `wideScreen.scss`, `overrideAceStyle.scss`, `fonts.scss`, `console.m.scss`.

### Screens, Components & Pages
- **Splash & Loading**: `www/index.html` (`#splash`), `src/dialogs/loader.js` (`create`, `showTitleLoader`, `removeTitleLoader`), `src/components/tailSpin.js`.
- **Welcome Screen**: `src/pages/welcome/welcome.js`, `src/pages/welcome/welcome.scss`, `src/pages/welcome/index.js`.
- **Navigation & Shell**: `src/components/WebComponents/wcPage.js`, `src/components/tile/index.js` & `style.scss`, `src/components/sidebar/index.js` & `style.scss`, `src/sidebarApps/index.js`, `src/components/tabView.js`, `src/views/menu.hbs`, `src/views/file-menu.hbs`.
- **Editor Workspace**: `src/lib/editorManager.js`, `src/lib/editorFile.js`, `src/components/quickTools/` (`index.js`, `footer.js`, `items.js`, `style.scss`), `src/styles/codemirror.scss`, `src/cm/themes/`.
- **File Explorer**: `src/sidebarApps/files/` (`index.js`, `style.scss`, `dragMove.js`, `selection.js`), `src/pages/fileBrowser/` (`fileBrowser.js`, `fileBrowser.scss`, `util.js`, `*.hbs`), `src/lib/openFolder.js`.
- **Terminal**: `src/components/terminal/` (`terminal.js`, `terminalManager.js`, `terminalThemeManager.js`, `terminalDefaults.js`, `terminalTouchScrolling.js`, `terminalTouchSelection.js`, `terminalTouchSelection.css`).
- **Settings**: `src/components/settingsPage.js`, `src/components/settingsPage.scss`, `src/settings/` (`mainSettings.js`, `appSettings.js`, `editorSettings.js`, `filesSettings.js`, `formatterSettings.js`, `lspSettings.js`, `previewSettings.js`, `scrollSettings.js`, `searchSettings.js`, `terminalSettings.js`, `backupRestore.js`, `helpSettings.js`).
- **Theme System**: `src/theme/builder.js`, `src/theme/list.js`, `src/theme/preInstalled.js`, `src/pages/themeSetting/` (`themeSetting.js`, `themeSetting.scss`), `src/pages/customTheme/`.
- **Dialogs & Palettes**: `src/dialogs/` (`alert.js`, `confirm.js`, `dialog.js`, `loader.js`, `multiPrompt.js`, `prompt.js`, `rateBox.js`, `select.js`, `color.js`, `style.scss`), `src/components/contextmenu/`, `src/components/toast/`, `src/components/tooltip/`, `src/components/searchbar/`, `src/palettes/` (`commandPalette`, `findFile`, `changeTheme`, `changeEditorTheme`, `changeMode`, `changeEncoding`).
- **Secondary Pages**: `src/pages/about/`, `src/pages/appIconSetting/`, `src/pages/plugins/`, `src/pages/plugin/`, `src/pages/runningProcesses/`, `src/pages/changelog/`, `src/pages/markdownPreview/`, `src/pages/problems/`, `src/pages/quickTools/`, `src/pages/sponsor/`, `src/pages/sponsors/`, `src/pages/adRewards/`.

### Branding, Icons & Localization
- `res/logo.png`, `res/logo_1.png`, `www/logo.svg`, `www/favicon.ico`, `src/components/logo/` (`index.js`, `style.scss`, `logo.png`), `src/pages/about/logo.png`, `src/pages/about/foxbiz.svg`.
- `res/android/drawable/ic_launcher_foreground.xml`, `ic_launcher_background.xml`, `ic_acode_*`, `res/android/mipmap-*/`, `res/android/values/ic_launcher_background.xml`, `colors.xml`, `themes.xml`.
- `www/icons/ic_acode_*.svg`, `src/lib/appIcons.js`, `src/lib/appIconSelection.js`.
- `src/res/icons/` (`icons.ttf`, `style.css` — includes `.icon.acode`), `src/res/file-icons/`.
- `src/lang/*.json` (`en-us.json` and translations).

---

## 3. Android Build System

- **Cordova**: `cordova@13.0.0`, `cordova-android@15.1.0`
- **Target/Min SDK**: `minSdkVersion` 26, `targetSdkVersion` 36 (patched to 28 if `fdroid` flag or `/tmp/fdroid.bool` missing in `hooks/post-process.js`).
- **Gradle / Java / Node** (per `.devcontainer/Dockerfile` and `CONTRIBUTING.md`):
  - Node.js 22 (container has `v22.23.4`)
  - Java JDK 17/21 (container has OpenJDK `17.0.20.1`)
  - Gradle 8.11 (`cordova-android@15.1.0` requires AGP 8.x & Android SDK API 36 + Build-Tools 36.0.0)
- **Host Environment Note**: This build environment runs on `aarch64` Linux proot (Android device) where `/storage/emulated/0` disallows symlinks (`npm install --no-bin-links` required on shared storage) and Android SDK 36 / x86_64 `aapt2` is not pre-installed.

---

## 4. Dependency Inventory

### Production JS Dependencies (`package.json`)
- **Editor & Language Services**: `codemirror` (^6.0.2), `@codemirror/*` (^6.x), `@lezer/*`, `@codemirror/lsp-client` (`file:codemirror-lsp-client`), `@emmetio/codemirror6-plugin` (^0.4.1), `@acode.app/canvas-view` (^0.0.11), `vscode-css-languageservice` (6.3.10), `vscode-html-languageservice` (5.6.2), `vscode-json-languageservice` (5.7.2), `vscode-languageserver-textdocument` (1.0.12), `acorn` (^8.18.0), `esprima` (^4.0.1).
- **Terminal**: `@xterm/xterm` (^6.0.0), `@xterm/addon-attach`, `@xterm/addon-fit`, `@xterm/addon-image`, `@xterm/addon-search`, `@xterm/addon-unicode11`, `@xterm/addon-web-links`, `@xterm/addon-webgl`.
- **UI & Utilities**: `html-tag-js` (^2.4.16), `motion` (^12.43.0), `dompurify` (^3.4.14), `mustache` (^4.2.0), `autosize` (^6.0.1), `vanilla-picker` (^2.12.3), `katex` (^0.16.47), `markdown-it` (^14.3.0) + plugins, `jszip` (^3.10.1), `dayjs` (^1.11.23), `filesize` (^11.0.22), `mime-types` (^3.0.2), `picomatch` (^4.0.7), `escape-string-regexp` (^5.0.0), `url-parse` (^1.5.10), `@deadlyjack/ajax` (^1.2.6), `pele` (^1.10.0), `core-js` (^3.50.0), `@ungap/custom-elements` (^1.3.0), `yargs` (^18.1.0).
- **Cordova CLI**: `cordova` (13.0.0).

### Local Cordova Plugins (`src/plugins/`)
1. `admob` (`admob-plus-cordova`, `2.0.0-alpha.19`, conditional for free variant)
2. `auth` (`com.foxdebug.acode.rk.auth`)
3. `browser` (`cordova-plugin-browser`)
4. `cordova-plugin-advanced-http` (`3.3.1`)
5. `cordova-plugin-buildinfo` (`4.0.0`)
6. `cordova-plugin-crashhandler` (`1.0.0`)
7. `custom-tabs` (`com.foxdebug.acode.rk.customtabs`)
8. `ftp` (`cordova-plugin-ftp`)
9. `iap` (`cordova-plugin-iap`)
10. `pluginContext` (`com.foxdebug.acode.rk.plugin.plugincontext`)
11. `proot` (`com.foxdebug.acode.rk.exec.proot`, includes native `.so` libs `libaxs.so` for arm32/arm64/x64)
12. `sdcard` (`cordova-plugin-sdcard`)
13. `server` (`cordova-plugin-server`)
14. `sftp` (`cordova-plugin-sftp`)
15. `system` (`cordova-plugin-system`)
16. `terminal` (`com.foxdebug.acode.rk.exec.terminal`)
17. `websocket` (`cordova-plugin-websocket`)
18. `webview` (`cordova-plugin-acode-webview`)

---

## 5. Rebranding & Package Migration Locations

### Package Identifier (`com.foxdebug.acode` -> `com.stylesheet.sscoding`)
- `config.xml` (`<widget id="...">`, deep-link scheme if updated)
- `package.json` (`name`)
- `utils/config.js` (`ID_PAID`, `ID_FREE`)
- `utils/setup.js` (`ID_PAID`)
- `hooks/post-process.js` (`getPackageName` fallback)
- `src/plugins/browser/utils/updatePackage.js` (CRITICAL: currently regex-matches `com.foxdebug.(acode|acodefree).R` and must instead support arbitrary widget ID from `config.xml`)
- `src/plugins/browser/android/com/foxdebug/browser/Menu.java` (`import ...R;`)
- `src/plugins/terminal/src/android/AlpineDocumentProvider.java` (`import ...R;`, fallback app label `"Acode"`)
- `src/plugins/terminal/src/android/TerminalService.java` (service action strings `ACTION_EXIT_SERVICE`, `MOVE_TO_BACKGROUND`, `MOVE_TO_FOREGROUND`, `ACTION_TOGGLE_WAKE_LOCK`, wake lock tag `"AcodeTerminal:WakeLock"`, notification title `"Acode Service"`)
- `src/plugins/system/utils/changeProvider.js` & `src/plugins/system/android/com/foxdebug/system/System.java` (`FileProvider` authority `${ID}.provider`, `SharedPreferences` `"acode_theme"`, `pinFileShortcut` extra, `isReservedAuthIntent`)
- `src/plugins/cordova-plugin-crashhandler/src/android/CrashActivity.java` (crash report branding, `"acode_theme"` prefs)
- `src/lib/openFolder.js`, `src/utils/helpers.js`, `src/components/terminal/terminalManager.js` (SAF document URI authority `com.foxdebug.acode.documents` & fallback `packageName`)
- `src/test/url.tests.js` & `tests/unit/config.test.js`

*Note*: Internal plugin IDs such as `com.foxdebug.acode.rk.*` and `com.foxdebug.system.*` are Java/Cordova plugin package namespaces used across cross-plugin Java imports (`EncryptedPreferenceManager`, `Ui`). Keeping those internal plugin Java package names (or carefully coordinating them) avoids breaking plugin compilation and `cordova.exec` native bridge calls, while the Android Application ID (`applicationId` / `packageName` / `R` / FileProvider authority / DocumentsProvider authority / service actions) migrates cleanly to `com.stylesheet.sscoding`.

### User-Facing Branding Locations
- `www/index.html` (`<title>`, `#splash`, startup error messages)
- `src/main.js` (header title `"Acode"`, update notification, SFTP migration alert)
- `src/lib/config.js` (`LOG_FILE_NAME`, `PLAY_STORE_URL`, URLs/feedback email)
- `src/pages/welcome/welcome.js` (title, tagline, tab icon, connect links)
- `src/pages/about/about.js` (app title, webpage/publisher/social links, logo)
- `src/pages/themeSetting/themeSetting.js` (preview snippet & error message)
- `src/pages/sponsor/sponsor.js`, `src/pages/sponsors/sponsors.js`, `src/pages/adRewards/index.js`
- `src/dialogs/rateBox.js` (email subject)
- `src/settings/mainSettings.js` & `src/lang/*.json` (user-facing strings mentioning Acode)
- `res/android/` launcher icons, splash background colors, `www/icons/*.svg`, `www/logo.svg`, `src/components/logo/`

---

## 6. Compatibility Risks & Mitigations

1. **Plugin API Compatibility (`window.acode`, `EditorManager`, `EditorFile`)**: External Acode plugins rely on `window.acode`, `EditorManager`, `EditorFile` events, and `settings.value` keys. Preserving `window.acode`, settings keys, and `EditorManager` / `EditorFile` APIs ensures existing editor and plugin functionality continues working.
2. **Dynamic App Icon Aliases**: `tests/unit/appIcons.test.js` and `tests/unit/androidPrepare.test.js` assert strict 1:1 parity between `APP_ICONS` in `src/lib/appIcons.js`, `APP_ICON_ALIASES` in `System.java`, and `<activity-alias>` entries in `config.xml`. All icon updates must preserve this contract.
3. **Browser & Terminal `R` Import Hook**: `src/plugins/browser/utils/updatePackage.js` must be updated to use the full `config.xml` widget ID (`com.stylesheet.sscoding`) rather than assuming `com.foxdebug.*`.
4. **CodeMirror Performance**: Glassmorphism (`backdrop-filter: blur(...)`) must NOT be applied per-line or on `.cm-scroller`/`.cm-content`; it should be isolated to shell chrome (headers, floating nav, sidebars, cards, dialogs, toolbars) to maintain 60fps scrolling on mobile WebViews.
5. **Cordova/Android Build Environment**: Building the final `.apk`/`.aab` requires Android SDK API 36, Build Tools 36.0.0, and Gradle 8.11 (or compatible `aapt2` for the host architecture).
