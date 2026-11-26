# SS Coding Architecture (`com.stylesheet.sscoding`)

## 1. Architectural Overview

SS Coding transforms the upstream Acode Cordova + Rspack + CodeMirror 6 hybrid codebase into a modular, light-mode-first Glassmorphism mobile IDE while keeping the existing editor engine, virtual file system, native plugins, and `window.acode` plugin API intact.

- **Native Android Host Layer**: Cordova Android (`config.xml`, `src/plugins/*`, `res/android/*`) configured for application ID `com.stylesheet.sscoding`, deep-link scheme `sscoding`, custom `FileProvider` authority (`com.stylesheet.sscoding.provider` generated via hook), terminal Alpine document provider (`com.stylesheet.sscoding.documents`), foreground service (`TerminalService`), crash handler (`CrashActivity`), and native icon switcher (`System.java`).
- **WebView Runtime Entry (`www/index.html`, `src/boot.js`, `src/main.js`)**: Zero-flash `#eef4fc` light-glass splash shell that monitors startup health, surfaces WebView/storage errors with a retry button, boots global managers (`settings`, `lang`, `EditorManager`, `Sidebar`, `actionStack`), and initializes SS Coding workspace navigation and status telemetry.
- **Modular Glassmorphism UI Layer (`src/ui/`)**: Isolated UI modules decoupled from CodeMirror internals so dashboard layout, bottom navigation, loading states, and status telemetry can evolve independently.

## 2. Design System & Tokens

Defined in `src/ui/designSystem.scss` and `src/ui/glass.scss`, imported first in `src/main.scss` and paired with the default `SS Glass` built-in theme (`src/theme/preInstalled.js`, `src/theme/builder.js`, `src/lib/settings.js`):

- **Color Palette**: Light canvas gradient `#f7faff -> #eef4fc -> #e0ecfb`, translucent white glass panels (`rgba(255, 255, 255, 0.72)` / `0.88`), soft slate-navy text (`#0f172a` / `#475569`), cobalt-blue primary accent (`#2563eb`), high-contrast white CodeMirror surface (`githubLight`).
- **Typography & Spacing**: Inter / system sans UI typography (`--ss-font-sans`), monospace metrics/code (`--ss-font-mono`), 4px spacing scale (`--ss-space-1`..`6`), rounded corners (`12px` / `16px` / `22px` / `999px`), smooth easing transitions (`cubic-bezier(0.22, 1, 0.36, 1)`).
- **Performance Discipline**: Controlled backdrop blur (`10px`–`20px`) is applied strictly to navigation pills, headers, dialogs, cards, menus, and sidebars—never to individual CodeMirror text lines.

## 3. Modular UI Components (`src/ui/`)

| Module | Responsibility | Integration Point |
| :--- | :--- | :--- |
| `src/ui/designSystem.scss` & `glass.scss` | Core CSS design tokens, frosted surface utilities, crisp button/card primitives | Imported at top of `src/main.scss` |
| `src/ui/dashboard/HomeDashboard.js` | Card-based Welcome & Home workspace dashboard (recent projects/files, New Project/File, Open File/Folder, Terminal, Search, Settings) | Mounted in `src/pages/welcome/welcome.js` |
| `src/ui/navigation/WorkspaceNav.js` | Floating bottom pill navigation (Home, Files, Search, Editor, Terminal, Settings) with keyboard/fullscreen/QuickTools auto-hide | Mounted in `src/main.js` (`#root`); reserves viewport room via `data-ss-nav="visible"` in `src/styles/page.scss` |
| `src/ui/statusBar/WorkspaceStatusBar.js` | Live editor telemetry bar (syntax mode, `Ln/Col`, LSP indicator, EOL, encoding) with clickable quick pickers | Bound to `editorManager` events in `src/main.js` |
| `src/ui/loading/LoadingView.js` | Non-blocking glass spinner & retryable error cards | Used by `src/dialogs/loader.js` and reusable views |

## 4. Compatibility Preservation

- **Plugin API (`window.acode`)**: Public plugin globals, command registry (`open-home` added alongside `welcome`), `EditorManager`, `EditorFile`, and `appSettings` JSON keys remain unchanged so existing CodeMirror modes and third-party plugins continue functioning.
- **App Icon Variants & Native Hooks**: Adaptive icon foreground/background vector drawables, SVG previews, and `res/android` drawables share clean SS Coding geometric mark artwork while keeping activity-alias signatures expected by `hooks/post-process.js` and `tests/unit/`.
