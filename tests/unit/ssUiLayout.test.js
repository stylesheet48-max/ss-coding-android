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
				"lib/actionStack": { push: vi.fn(), remove: vi.fn() },
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

		// Test repeated open/close toggling on 360px phone screen
		$sidebar.show();
		expect($sidebar.activated).toBe(true);
		expect($sidebar.classList.contains("show")).toBe(true);
		expect($sidebar.isConnected).toBe(true);

		$sidebar.hide();
		expect($sidebar.classList.contains("show")).toBe(false);

		$sidebar.show();
		expect($sidebar.activated).toBe(true);
		expect($sidebar.classList.contains("show")).toBe(true);

		// Clicking Settings in drawer executes settings & closes phone drawer
		$sidebar.querySelector('[data-nav-id="settings"]').click();
		expect(execSpy).toHaveBeenCalledWith("open", "settings");
		expect($sidebar.classList.contains("show")).toBe(false);

		// Verify empty state in files sidebar app (zero blank panel!)
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
		expect(emptySection.querySelectorAll("button").length).toBe(2);
	}, 30000);
});
