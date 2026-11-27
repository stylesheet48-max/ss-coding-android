import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { Window } from "happy-dom";
import * as sass from "sass";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const babel = require("@babel/core");

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

function compileJsxFile(relPath, mocks = {}, globals = {}) {
	const filename = path.join(REPO_ROOT, relPath);
	const source = fs.readFileSync(filename, "utf8");
	const code = babel.transformSync(source, {
		filename,
		presets: [
			[
				"@babel/preset-env",
				{ targets: { node: "current" }, modules: "commonjs" },
			],
		],
		plugins: [
			"html-tag-js/jsx/syntax-parser.js",
			"html-tag-js/jsx/jsx-to-tag.js",
		],
	}).code;

	const exports = {};
	const module = { exports };
	vm.runInNewContext(
		code,
		{
			module,
			exports,
			require(id) {
				if (id in mocks) return mocks[id];
				if (id.startsWith("@babel/")) return require(id);
				throw new Error(`Unexpected import in ${relPath}: ${id}`);
			},
			...globals,
		},
		{ filename },
	);
	return module.exports;
}

function installDomGlobals(dom) {
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	globalThis.Node = dom.window.Node;
	globalThis.Element = dom.window.Element;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.Text = dom.window.Text;
	globalThis.Comment = dom.window.Comment;
	globalThis.DocumentFragment = dom.window.DocumentFragment;
	globalThis.innerWidth = dom.window.innerWidth;
}

describe("SS Coding UI Architecture, Mobile Layout & Sidebar Navigation", () => {
	it("compiles all SS Coding dashboard and drawer styles directly into main.scss for ShadowDOM compatibility", () => {
		const mainJs = fs.readFileSync(path.join(REPO_ROOT, "src/main.js"), "utf8");
		const mainScss = fs.readFileSync(
			path.join(REPO_ROOT, "src/main.scss"),
			"utf8",
		);

		expect(mainJs).not.toContain('import "pages/welcome/welcome.scss"');
		expect(mainScss).toContain("./ui/dashboard/HomeDashboard.scss");
		expect(mainScss).toContain("./ui/navigation/WorkspaceNav.scss");
		expect(mainScss).toContain("./ui/statusBar/WorkspaceStatusBar.scss");
		expect(mainScss).toContain("./ui/loading/LoadingView.scss");

		const compiled = sass.compile(path.join(REPO_ROOT, "src/main.scss"), {
			loadPaths: [path.join(REPO_ROOT, "src")],
		}).css;

		// Essential rules that must exist in build/main.css so ShadowDOM & light DOM both style cleanly
		expect(compiled).toContain(":host");
		expect(compiled).toContain("#welcome-tab.ss-dashboard");
		expect(compiled).toContain(".ss-hero-actions");
		expect(compiled).toContain(".ss-action-grid");
		expect(compiled).toContain(".ss-utility-row");
		expect(compiled).toContain("appearance: none");
	}, 30000);

	it("renders HomeDashboard inside ShadowRoot with structured glass buttons and triggers workspace actions on 360px mobile", () => {
		const dom = new Window({
			url: "http://localhost/",
			width: 360,
			height: 800,
		});
		installDomGlobals(dom);
		const tag = require("html-tag-js");
		const Ref = require("html-tag-js/ref");

		const execSpy = vi.fn();
		const strings = {
			"new file": "New File",
			"open file": "Open File",
			"open folder": "Open Folder",
			terminal: "Terminal",
			"change theme": "Themes",
			settings: "Settings",
			plugins: "Plugins",
			"running processes": "Processes",
		};

		const mod = compileJsxFile(
			"src/ui/dashboard/HomeDashboard.js",
			{
				fileSystem: Object.assign(() => ({ exists: async () => false }), {
					default: () => ({}),
				}),
				"cm/commandRegistry": { getResolvedKeyBindings: () => ({}) },
				"components/logo/logo.png?inline": "data:image/png;base64,iVBORw0KGgo=",
				"components/sidebar": Object.assign(() => {}, {
					show: vi.fn(),
					el: null,
				}),
				"components/toast": vi.fn(),
				"dialogs/prompt": vi.fn(),
				"dialogs/select": vi.fn(),
				"lib/openFile": vi.fn(),
				"lib/openFolder": {
					__esModule: true,
					default: vi.fn(),
					addedFolder: [],
				},
				"lib/projects": { get: () => null, list: () => [] },
				"lib/recents": {
					folders: [],
					files: [],
					removeFolder: vi.fn(),
					removeFile: vi.fn(),
				},
				"pages/fileBrowser": vi.fn(),
				"utils/helpers": { getVirtualPath: (p) => p, error: vi.fn() },
				"utils/Uri": { getDisplayPath: (p) => p },
				"utils/Url": {
					parse: (u) => ({ url: u }),
					basename: (u) => u,
					dirname: () => "/",
					join: (...p) => p.join("/"),
				},
			},
			{
				tag,
				Ref,
				strings,
				acode: { exec: execSpy },
				window: dom.window,
				document: dom.window.document,
			},
		);

		const HomeDashboard = mod.default;
		const host = dom.window.document.createElement("div");
		host.className = "tab-page-container";
		const shadow = host.attachShadow({ mode: "open" });
		const content = dom.window.document.createElement("div");
		content.className = "tab-page-content";
		content.appendChild(HomeDashboard());
		shadow.appendChild(content);
		dom.window.document.body.appendChild(host);

		const rootEl = shadow.querySelector("#welcome-tab.ss-dashboard");
		expect(rootEl).toBeTruthy();

		// Hero buttons must use SS Coding glass classes, never unstyled default browser controls
		const primaryBtn = rootEl.querySelector(".ss-hero-actions .ss-btn-primary");
		const openProjectBtn = rootEl.querySelector(
			".ss-hero-actions .ss-btn-glass",
		);
		expect(primaryBtn).toBeTruthy();
		expect(openProjectBtn).toBeTruthy();

		// 8 workspace action cards + 3 utility chips
		expect(
			rootEl.querySelectorAll(".ss-action-grid .ss-action-card").length,
		).toBe(8);
		expect(
			rootEl.querySelectorAll(".ss-utility-row .ss-utility-chip").length,
		).toBe(3);

		primaryBtn.click();
		openProjectBtn.click();
		expect(execSpy).toHaveBeenCalledWith("new-file");
		expect(execSpy).toHaveBeenCalledWith("open-folder");
	}, 30000);

	it("renders redesigned SS Coding Side Navigation with 8 labeled items, smooth toggle cycles, and non-blank empty explorer", () => {
		const dom = new Window({
			url: "http://localhost/",
			width: 360,
			height: 800,
		});
		installDomGlobals(dom);
		const tag = require("html-tag-js");
		const Ref = require("html-tag-js/ref");

		const appRoot = dom.window.document.createElement("div");
		dom.window.document.body.appendChild(appRoot);
		const mainContainer = dom.window.document.createElement("main");
		const toggler = dom.window.document.createElement("span");
		const execSpy = vi.fn();

		const actionStackEntries = [];
		const actionStackMock = {
			push: vi.fn((entry) => actionStackEntries.push(entry)),
			remove: vi.fn((id) => {
				for (let i = actionStackEntries.length - 1; i >= 0; i--) {
					if (actionStackEntries[i].id === id) actionStackEntries.splice(i, 1);
				}
			}),
		};

		const sidebarMod = compileJsxFile(
			"src/components/sidebar/index.js",
			{
				"./style.scss": {},
				fileSystem: () => ({ exists: async () => false }),
				"components/logo/logo.png?inline": "data:image/png;base64,iVBORw0KGgo=",
				"components/toast": vi.fn(),
				"dialogs/confirm": vi.fn(),
				"dialogs/loader": { create: vi.fn(), show: vi.fn(), destroy: vi.fn() },
				"html-tag-js/ref": Ref,
				"lib/actionStack": actionStackMock,
				"lib/auth": {
					loginEvents: { addListener: vi.fn() },
					getLoggedInUser: vi.fn(async () => null),
				},
				"lib/config": { SIDEBAR_SLIDE_START_THRESHOLD_PX: 20 },
				"utils/helpers": {},
				"utils/Url": { join: (...p) => p.join("/") },
			},
			{
				tag,
				Ref,
				app: appRoot,
				root: appRoot,
				strings: {
					logout: "Logout",
					login: "Login",
					"loading...": "Loading...",
					confirm: "Confirm",
				},
				acode: { exec: execSpy },
				localStorage: dom.window.localStorage,
				window: dom.window,
				document: dom.window.document,
				HTMLInputElement: dom.window.HTMLInputElement,
				HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
				MutationObserver: dom.window.MutationObserver,
				setTimeout,
				clearTimeout,
				queueMicrotask,
			},
		);

		const Sidebar = sidebarMod.default;
		const $sidebar = Sidebar({ container: mainContainer, toggler });

		// Verify .container is a direct child of #sidebar (SidebarApp replaceChild compatibility)
		expect(
			Array.from($sidebar.children).some((c) =>
				c.classList.contains("container"),
			),
		).toBe(true);
		expect($sidebar.querySelector(".ss-drawer-title")?.textContent).toBe(
			"SS Coding",
		);

		// Verify all 8 navigation items exist with visible labels
		const navItems = Array.from(
			$sidebar.querySelectorAll(".ss-drawer-nav-item"),
		);
		expect(navItems.map((el) => el.dataset.navId)).toEqual([
			"home",
			"files",
			"searchInFiles",
			"editor",
			"terminal",
			"extensions",
			"notification",
			"settings",
		]);

		// Drawer width matches responsive 82% viewport rule capped at 420px
		expect($sidebar.getWidth()).toBe(Math.round(360 * 0.82));

		// Test close via close button, overlay mask, and back navigation
		$sidebar.show();
		expect($sidebar.activated).toBe(true);
		expect($sidebar.classList.contains("show")).toBe(true);
		expect($sidebar.isConnected).toBe(true);

		$sidebar.querySelector(".ss-drawer-close").click();
		expect($sidebar.classList.contains("show")).toBe(false);

		$sidebar.show();
		expect($sidebar.classList.contains("show")).toBe(true);
		appRoot.querySelector(".mask").click();
		expect($sidebar.classList.contains("show")).toBe(false);

		// Verify touch tap with minor jitter on overlay mask also closes drawer
		$sidebar.show();
		expect($sidebar.classList.contains("show")).toBe(true);
		const maskEl = appRoot.querySelector(".mask");
		const mkTouchEvent = (type, clientX) => {
			const ev = new dom.window.Event(type, {
				bubbles: true,
				cancelable: true,
			});
			ev.touches = [{ clientX, clientY: 200 }];
			return ev;
		};
		maskEl.dispatchEvent(mkTouchEvent("touchstart", 330));
		maskEl.dispatchEvent(mkTouchEvent("touchmove", 332));
		maskEl.dispatchEvent(mkTouchEvent("touchend", 332));
		expect($sidebar.classList.contains("show")).toBe(false);

		$sidebar.show();
		expect(actionStackEntries.some((e) => e.id === "sidebar")).toBe(true);
		const sidebarBackEntry = actionStackEntries.find((e) => e.id === "sidebar");
		sidebarBackEntry.action();
		expect($sidebar.classList.contains("show")).toBe(false);

		$sidebar.show();
		expect($sidebar.activated).toBe(true);
		expect($sidebar.classList.contains("show")).toBe(true);

		// Clicking Settings in drawer executes settings & closes phone drawer
		$sidebar.querySelector('[data-nav-id="settings"]').click();
		expect(execSpy).toHaveBeenCalledWith("open", "settings");
		expect($sidebar.classList.contains("show")).toBe(false);

		// Verify empty state in files sidebar app (zero blank panel + .is-empty class!)
		const filesMod = compileJsxFile(
			"src/sidebarApps/files/index.js",
			{
				"./style.scss": {},
				"components/sidebar": Sidebar,
				"html-tag-js": tag,
				"lib/fileIcons": { refreshRenderedIcons: vi.fn() },
				"lib/settings": { OPEN_FILE_LIST_POS_SIDEBAR: "sidebar", value: {} },
				"./dragMove": { init: vi.fn() },
				"./selection": { init: vi.fn(), syncBar: vi.fn() },
			},
			{
				tag,
				editorManager: { on: vi.fn() },
				strings: {
					files: "Files",
					"open folder": "Open Folder",
					"new file": "New File",
				},
				acode: { exec: execSpy },
				document: dom.window.document,
				MutationObserver: dom.window.MutationObserver,
			},
		);
		const [, , , initFiles] = filesMod.default;
		const filesContainer = $sidebar.querySelector(".container");
		initFiles(filesContainer);

		const emptySection = filesContainer.querySelector("section.ss-files-empty");
		expect(emptySection).toBeTruthy();
		expect(emptySection.hidden).toBe(false);
		expect(filesContainer.classList.contains("is-empty")).toBe(true);
		expect(emptySection.querySelectorAll("button").length).toBe(2);
	}, 30000);

	it("uses reactive theme CSS variables, fixes drawer sizing, and docks #ss-workspace-nav flush at bottom", () => {
		const compiled = sass.compile(path.join(REPO_ROOT, "src/main.scss"), {
			loadPaths: [path.join(REPO_ROOT, "src")],
		}).css;

		// Design system tokens react directly to active ThemeBuilder variables without dark/light static lock
		expect(compiled).toContain("--ss-bg-solid: var(--secondary-color");
		expect(compiled).toContain("--ss-bg-canvas: linear-gradient");
		expect(compiled).toContain("--ss-accent: var(--active-color");
		expect(compiled).toContain("--ss-text-primary: var(--primary-text-color");
		expect(compiled).toContain("color-mix(in srgb, var(--secondary-color");
		expect(compiled).not.toContain('body[theme-type="dark"]');

		// Drawer uses 82vw responsive width with 420px cap, viewport-bounded height, and pinned footer
		const sidebarCompiled = sass.compile(
			path.join(REPO_ROOT, "src/components/sidebar/style.scss"),
			{ loadPaths: [path.join(REPO_ROOT, "src")] },
		).css;
		const sidebarMatch = sidebarCompiled.match(/^#sidebar\s*\{[^}]+\}/m);
		expect(sidebarMatch).toBeTruthy();
		const sidebarRule = sidebarMatch[0];
		expect(sidebarRule).toContain("width: min(82vw, 420px)");
		expect(sidebarRule).toContain("max-width: 420px");
		expect(sidebarRule).toContain("bottom: 0");
		expect(sidebarRule).not.toContain("height: 100vh");
		expect(sidebarCompiled).toContain("margin-top: auto");

		const searchCompiled = sass.compile(
			path.join(REPO_ROOT, "src/sidebarApps/searchInFiles/styles.scss"),
			{ loadPaths: [path.join(REPO_ROOT, "src")] },
		).css;
		expect(searchCompiled).not.toContain("height: 100% !important");

		// Bottom navigation anchored at bottom: 0 with safe-area padding inside bar (never lifting bar up)
		const navMatch = compiled.match(/#ss-workspace-nav\s*\{[^}]+\}/);
		expect(navMatch).toBeTruthy();
		const navRule = navMatch[0];
		expect(navRule).toContain("position: fixed");
		expect(navRule).toContain("bottom: 0");
		expect(navRule).toContain("left: var(--ss-sidebar-offset, 0px)");
		expect(navRule).toContain("right: 0");
		expect(navRule).toContain(
			"padding: 4px 8px calc(4px + env(safe-area-inset-bottom, 0px))",
		);
		expect(navRule).not.toContain("bottom: env(safe-area-inset-bottom");
		expect(navRule).not.toContain("bottom: calc(8px");

		// Root container disables transform so fixed bars anchor to viewport, and reserves bottom nav space
		expect(compiled).toContain("wc-page#root");
		expect(compiled).toContain("transform: none");
		expect(compiled).toContain(
			"padding-bottom: calc(var(--ss-nav-height, 52px) + env(safe-area-inset-bottom, 0px))",
		);
		expect(compiled).not.toContain("height: calc(100vh - 48px - 70px)");

		// Native Android System plugin must subtract Cordova's already-applied WebView
		// margins from WindowInsetsCompat so env(safe-area-inset-bottom) is not double-counted
		const systemJava = fs.readFileSync(
			path.join(
				REPO_ROOT,
				"src/plugins/system/android/com/foxdebug/system/System.java",
			),
			"utf8",
		);
		expect(systemJava).toContain("installWebViewInsetDeduplication()");
		expect(systemJava).toContain("ViewCompat.setOnApplyWindowInsetsListener");
		expect(systemJava).toContain("insets.inset(");
		expect(systemJava).toContain("mlp.bottomMargin");

		// Spinner SVG adapts to theme currentColor
		const spinnerSvg = fs.readFileSync(
			path.join(REPO_ROOT, "src/res/tail-spin.svg"),
			"utf8",
		);
		expect(spinnerSvg).toContain('stop-color="currentColor"');
		expect(spinnerSvg).not.toContain("#2563eb");
		expect(spinnerSvg).not.toContain("#38bdf8");
	}, 30000);

	it("mounts #ss-workspace-nav on document.body outside #root and preserves visibility across orientation/resize", () => {
		const dom = new Window({
			url: "http://localhost/",
			width: 360,
			height: 800,
		});
		installDomGlobals(dom);
		const tag = require("html-tag-js");
		const rootEl = dom.window.document.createElement("wc-page");
		rootEl.id = "root";
		rootEl.className = "primary";
		dom.window.document.body.appendChild(rootEl);

		const navMod = compileJsxFile(
			"src/ui/navigation/WorkspaceNav.js",
			{
				"components/sidebar": Object.assign(() => {}, {
					el: null,
					hide: vi.fn(),
					show: vi.fn(),
					on: vi.fn(),
				}),
			},
			{
				tag,
				window: Object.assign(dom.window, { root: rootEl }),
				document: dom.window.document,
				MutationObserver: dom.window.MutationObserver,
				acode: { exec: vi.fn() },
			},
		);

		const nav = navMod.default({ onOpenHome: vi.fn() });
		nav.mount(dom.window.document.body);

		expect(nav.el.parentElement).toBe(dom.window.document.body);
		expect(rootEl.contains(nav.el)).toBe(false);
		expect(rootEl.getAttribute("data-ss-nav")).toBe("visible");
		expect(nav.el.classList.contains("is-hidden")).toBe(false);

		// Simulate orientation change to landscape (360x800 -> 800x360): nav must stay visible
		dom.window.innerWidth = 800;
		dom.window.innerHeight = 360;
		dom.window.dispatchEvent(new dom.window.Event("resize"));
		expect(rootEl.getAttribute("data-ss-nav")).toBe("visible");
		expect(nav.el.classList.contains("is-hidden")).toBe(false);

		// Simulate soft keyboard opening in landscape (360 -> 180): nav hides
		dom.window.innerHeight = 180;
		dom.window.dispatchEvent(new dom.window.Event("resize"));
		expect(rootEl.getAttribute("data-ss-nav")).toBe("hidden");
		expect(nav.el.classList.contains("is-hidden")).toBe(true);
	}, 30000);

	it("updates app styles, editor, system bars, and open terminals on every theme change", async () => {
		const dom = new Window({ url: "https://localhost" });
		installDomGlobals(dom);
		const tag = require("html-tag-js");
		dom.window.document.head.get = (sel) =>
			dom.window.document.head.querySelector(sel);
		globalThis.CustomEvent = dom.window.CustomEvent;
		globalThis.localStorage = dom.window.localStorage;

		const settingsState = {
			appTheme: "ssGlass",
			terminalSettings: { theme: "light" },
		};
		const updateSettingsSpy = vi.fn((patch) => {
			Object.assign(settingsState, patch);
		});
		const setEditorThemeSpy = vi.fn();
		const updateTerminalsSpy = vi.fn();
		const setUiThemeSpy = vi.fn();
		const themeChangeEvents = [];
		dom.window.addEventListener("ss-theme-change", (e) => {
			themeChangeEvents.push(e.detail.id);
		});

		class FakeTheme {
			constructor(opts) {
				Object.assign(this, opts);
			}
			matches(target) {
				return this.id.toLowerCase() === String(target).toLowerCase();
			}
			get css() {
				return `:root { --primary-color: ${this.primaryColor}; --active-color: ${this.activeColor}; }`;
			}
			toJSON() {
				return {
					primaryColor: this.primaryColor,
					activeColor: this.activeColor,
				};
			}
		}

		const fakeThemes = [
			new FakeTheme({
				id: "ocean",
				name: "Ocean",
				type: "dark",
				primaryColor: "#0f172a",
				activeColor: "#38bdf8",
				preferredEditorTheme: "ace/theme/one_dark",
				preferredTerminalTheme: "ocean",
			}),
			new FakeTheme({
				id: "crimson",
				name: "Crimson Custom",
				type: "dark",
				primaryColor: "#2a0a12",
				activeColor: "#f43f5e",
				preferredEditorTheme: "ace/theme/monokai",
				preferredTerminalTheme: null,
			}),
			new FakeTheme({
				id: "mint",
				name: "Mint",
				type: "light",
				primaryColor: "#ecfdf5",
				activeColor: "#10b981",
				preferredEditorTheme: "ace/theme/chrome",
				preferredTerminalTheme: "light",
			}),
		];

		const themeListMod = compileJsxFile(
			"src/theme/list.js",
			{
				"lib/fonts": { setFont: vi.fn() },
				"lib/settings": {
					value: settingsState,
					update: updateSettingsSpy,
					on: vi.fn(),
				},
				"lib/systemConfiguration": { isDeviceDarkTheme: () => false },
				"settings/terminalSettings": {
					updateActiveTerminals: updateTerminalsSpy,
				},
				"utils/color": (val) => ({ hex: { toString: () => val } }),
				"./builder": FakeTheme,
				"./preInstalled": Object.assign(fakeThemes, {
					updateSystemTheme: vi.fn(),
				}),
			},
			{
				tag,
				document: dom.window.document,
				window: dom.window,
				localStorage: dom.window.localStorage,
				CustomEvent: dom.window.CustomEvent,
				DOES_SUPPORT_THEME: true,
				editorManager: { editor: { setTheme: setEditorThemeSpy } },
				system: { setUiTheme: setUiThemeSpy },
				setTimeout: () => 0,
				clearTimeout: () => {},
			},
		);

		const themesMod = themeListMod.default;
		themesMod.init();
		await themesMod.apply("ocean", true);
		expect(dom.window.document.body.getAttribute("theme-type")).toBe("dark");
		expect(
			dom.window.document.head.querySelector("style#app-theme")?.textContent,
		).toContain("#0f172a");
		expect(updateTerminalsSpy).toHaveBeenLastCalledWith("theme", "ocean");
		expect(setEditorThemeSpy).toHaveBeenLastCalledWith("ace/theme/one_dark");

		// Second change after startup must still update terminal with fallback dark theme
		await themesMod.apply("crimson", true);
		expect(
			dom.window.document.head.querySelector("style#app-theme")?.textContent,
		).toContain("#2a0a12");
		expect(settingsState.terminalSettings.theme).toBe("dark");
		expect(updateTerminalsSpy).toHaveBeenLastCalledWith("theme", "dark");
		expect(setEditorThemeSpy).toHaveBeenLastCalledWith("ace/theme/monokai");

		// Third change to a light theme flips body attribute, CSS vars, editor & terminal
		await themesMod.apply("mint", true);
		expect(dom.window.document.body.getAttribute("theme-type")).toBe("light");
		expect(
			dom.window.document.head.querySelector("style#app-theme")?.textContent,
		).toContain("#ecfdf5");
		expect(settingsState.terminalSettings.theme).toBe("light");
		expect(updateTerminalsSpy).toHaveBeenLastCalledWith("theme", "light");
		expect(setEditorThemeSpy).toHaveBeenLastCalledWith("ace/theme/chrome");
		expect(setUiThemeSpy).toHaveBeenCalledTimes(3);
		expect(themeChangeEvents).toEqual(["ocean", "crimson", "mint"]);
	}, 30000);
});
