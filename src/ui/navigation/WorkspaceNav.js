import Sidebar from "components/sidebar";

/**
 * Modular Glassmorphism bottom workspace navigation bar.
 * Automatically adjusts root workspace height via `root[data-ss-nav="visible"]`
 * so editor content is never obscured, and hides when the soft keyboard opens
 * or fullscreen mode is active.
 */
export default function createWorkspaceNav({ onOpenHome } = {}) {
	let activeTab = "home";
	let baselineHeight = window.innerHeight;
	let keyboardLikelyOpen = false;

	const items = [
		{ id: "home", icon: "home", label: "Home" },
		{ id: "files", icon: "folder", label: "Files" },
		{ id: "search", icon: "search", label: "Search" },
		{ id: "editor", icon: "code", label: "Editor" },
		{ id: "terminal", icon: "terminal", label: "Terminal" },
		{ id: "settings", icon: "settings", label: "Settings" },
	];

	const buttons = new Map();

	const $nav = (
		<nav
			id="ss-workspace-nav"
			className="ss-bottom-nav"
			aria-label="Workspace navigation"
		>
			{items.map((item) => {
				const $btn = (
					<button
						type="button"
						className={`ss-nav-item${item.id === activeTab ? " active" : ""}`}
						data-nav-id={item.id}
						aria-label={item.label}
						aria-current={item.id === activeTab ? "page" : "false"}
						onclick={() => handleSelect(item.id)}
					>
						<span className={`icon ${item.icon}`} aria-hidden="true" />
						<span className="ss-nav-label">{item.label}</span>
					</button>
				);
				buttons.set(item.id, $btn);
				return $btn;
			})}
		</nav>
	);

	function setActive(id) {
		if (!buttons.has(id)) return;
		activeTab = id;
		for (const [btnId, $btn] of buttons.entries()) {
			const isActive = btnId === id;
			$btn.classList.toggle("active", isActive);
			$btn.setAttribute("aria-current", isActive ? "page" : "false");
		}
	}

	function syncVisibility() {
		const isFullscreen = document.body.classList.contains("fullscreen-mode");
		const hasFooter =
			window.root && Number(window.root.getAttribute("footer-height") || 0) > 0;
		const shouldShow = !isFullscreen && !keyboardLikelyOpen && !hasFooter;
		$nav.classList.toggle("is-hidden", !shouldShow);
		if (window.root) {
			window.root.setAttribute(
				"data-ss-nav",
				shouldShow ? "visible" : "hidden",
			);
		}
	}

	function handleViewportChange() {
		const currentHeight = window.visualViewport
			? window.visualViewport.height
			: window.innerHeight;
		if (currentHeight > baselineHeight) {
			baselineHeight = currentHeight;
		}
		keyboardLikelyOpen = baselineHeight - currentHeight > 140;
		syncVisibility();
	}

	function handleSelect(id) {
		switch (id) {
			case "home":
				setActive("home");
				Sidebar.hide();
				if (typeof onOpenHome === "function") {
					onOpenHome();
				} else {
					acode.exec("open-home");
				}
				break;

			case "files":
				setActive("files");
				openSidebarApp("files");
				break;

			case "search":
				setActive("search");
				openSidebarApp("searchInFiles");
				break;

			case "editor": {
				setActive("editor");
				Sidebar.hide();
				const files = window.editorManager?.files || [];
				const codeFile =
					files.find((f) => f.type === "editor") ||
					files.find((f) => f.id !== "welcome-tab");
				if (codeFile) {
					codeFile.makeActive();
				} else {
					acode.exec("new-file");
				}
				break;
			}

			case "terminal":
				setActive("terminal");
				Sidebar.hide();
				acode.exec("new-terminal");
				break;

			case "settings":
				Sidebar.hide();
				acode.exec("open", "settings");
				break;

			default:
				break;
		}
	}

	function openSidebarApp(appId) {
		if (!Sidebar.el) return;
		if (!Sidebar.el.activated) {
			Sidebar.show();
		}
		const $icon = Sidebar.el.querySelector(
			`.app-icons-container [data-id="${appId}"]`,
		);
		$icon?.click();
	}

	function bindEvents() {
		window.addEventListener("resize", handleViewportChange);
		window.visualViewport?.addEventListener("resize", handleViewportChange);

		Sidebar.on("show", () => {
			const activeSidebarIcon = Sidebar.el?.querySelector(
				".app-icons-container .icon.active",
			);
			const id = activeSidebarIcon?.dataset?.id;
			if (id === "searchInFiles") setActive("search");
			else if (id === "files") setActive("files");
		});

		Sidebar.on("hide", () => {
			syncActiveFromEditor();
		});

		if (window.editorManager?.on) {
			window.editorManager.on("switch-file", syncActiveFromEditor);
			window.editorManager.on("remove-file", syncActiveFromEditor);
		}

		if (window.root && typeof MutationObserver !== "undefined") {
			new MutationObserver(syncVisibility).observe(window.root, {
				attributes: true,
				attributeFilter: ["footer-height"],
			});
		}
		if (document.body && typeof MutationObserver !== "undefined") {
			new MutationObserver(syncVisibility).observe(document.body, {
				attributes: true,
				attributeFilter: ["class"],
			});
		}
	}

	function syncActiveFromEditor() {
		if (Sidebar.el?.activated) return;
		const activeFile = window.editorManager?.activeFile;
		if (!activeFile || activeFile.id === "welcome-tab") {
			setActive("home");
		} else if (activeFile.type === "terminal") {
			setActive("terminal");
		} else {
			setActive("editor");
		}
		syncVisibility();
	}

	return {
		el: $nav,
		setActive,
		syncVisibility,
		syncActiveFromEditor,
		mount(parent = window.root) {
			if (!parent) return;
			if (typeof parent.appendOuter === "function") {
				parent.appendOuter($nav);
			} else {
				parent.appendChild($nav);
			}
			bindEvents();
			syncVisibility();
		},
	};
}
