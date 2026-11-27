import "./style.scss";
import Sidebar from "components/sidebar";
import tag from "html-tag-js";
import fileIcons from "lib/fileIcons";
import settings from "lib/settings";
import dragMove from "./dragMove";
import selection from "./selection";

/**@type {HTMLElement} */
let container;
/**@type {HTMLElement} */
let emptyState;

export default [
	"documents", // icon
	"files", // id
	strings["files"], // title
	initApp, // init function
	false, // prepend
	onSelected, // onSelected function
];

function createEmptyState() {
	const openFolderBtn = tag(
		"button",
		{
			type: "button",
			className: "ss-btn-primary",
			onclick(e) {
				e.stopPropagation();
				acode.exec("open-folder");
			},
		},
		[
			tag("span", { className: "icon folder_open", "aria-hidden": "true" }),
			tag("span", { textContent: strings["open folder"] || "Open Folder" }),
		],
	);

	const newFileBtn = tag(
		"button",
		{
			type: "button",
			className: "ss-btn-glass",
			onclick(e) {
				e.stopPropagation();
				acode.exec("new-file");
				Sidebar.hide();
			},
		},
		[
			tag("span", { className: "icon add", "aria-hidden": "true" }),
			tag("span", { textContent: strings["new file"] || "New File" }),
		],
	);

	return tag(
		"section",
		{
			className: "ss-files-empty",
			"aria-label": "Workspace files empty state",
		},
		[
			tag("div", { className: "ss-files-empty-card ss-glass-card" }, [
				tag("div", { className: "ss-files-empty-icon" }, [
					tag("span", { className: "icon folder_open", "aria-hidden": "true" }),
				]),
				tag("h3", { textContent: "No Folder Opened" }),
				tag("p", {
					textContent:
						"Open a project folder from device storage or start a new buffer to explore your workspace.",
				}),
				tag("div", { className: "ss-files-empty-actions" }, [
					openFolderBtn,
					newFileBtn,
				]),
			]),
		],
	);
}

function syncEmptyState() {
	if (!container || !emptyState) return;
	const hasContent = !!container.querySelector(":scope > div");
	emptyState.hidden = hasContent;
	container.classList.toggle("is-empty", !hasContent);
}

/**
 * Initialize files app
 * @param {HTMLElement} el
 */
function initApp(el) {
	container = el;
	container.classList.add("files");
	container.removeAttribute("data-msg");
	container.style.overflowX = "auto";
	emptyState = createEmptyState();
	container.append(emptyState);
	syncEmptyState();
	container.addEventListener("click", clickHandler);
	// Drag listens first so a long press can become a drag before selection
	// or the context menu sees it.
	dragMove.init(container);
	selection.init(container);
	editorManager.on(
		["new-file", "int-open-file-list", "remove-file"],
		(position) => {
			if (
				typeof position === "string" &&
				position !== settings.OPEN_FILE_LIST_POS_SIDEBAR
			)
				return;
			const fileList = container.get(":scope > div.file-list");
			if (fileList) fixHeight(fileList);
			syncEmptyState();
		},
	);
	editorManager.on("add-folder", () => {
		fixHeight();
		syncEmptyState();
	});
	editorManager.on("remove-folder", syncEmptyState);
	if (typeof MutationObserver !== "undefined") {
		new MutationObserver(syncEmptyState).observe(container, {
			childList: true,
		});
	}
	Sidebar.on("show", onSelected);
}

/**
 * On selected handler for files app
 * @param {HTMLElement} el
 */
function onSelected(el) {
	// Phone sidebars and inactive sidebar apps are detached, so document-wide
	// icon updates cannot reach them until this view is shown again.
	fileIcons.refreshRenderedIcons(container);
	selection.syncBar();
	syncEmptyState();
	// Heights measured while the sidebar was detached come out wrong.
	const $openFolder = container.querySelector(
		":scope > .list:not(.hidden):not(.file-list)",
	);
	if ($openFolder) fixHeight($openFolder);
	const $scrollableLists = container.getAll(":scope .scroll[data-scroll-top]");
	$scrollableLists.forEach(($el) => {
		$el.scrollTop = $el.dataset.scrollTop;
	});
}

/**
 * Click handler for files app
 * @param {MouseEvent} e
 * @returns
 */
function clickHandler(e) {
	if (!container.querySelector(":scope > div")) {
		return;
	}

	const { target } = e;
	if (target.matches(".files>.list>.tile")) {
		fixHeight(target.parentElement);
	}
}

/**
 * Update list height
 * @param {HTMLElement} target Target element
 */
export function fixHeight(target) {
	const lists = Array.from(container.getAll(":scope > div"));
	const ITEM_HEIGHT = 30;
	// Headers are taller than rows (36px, 40px on wide screens); measure them so
	// the expanded list doesn't overflow below the sidebar.
	const headerHeight =
		container.querySelector(":scope > .list > .tile")?.offsetHeight ||
		ITEM_HEIGHT;

	let height = (lists.length - 1) * headerHeight;
	let activeFileList;

	if (settings.value.openFileListPos === settings.OPEN_FILE_LIST_POS_SIDEBAR) {
		const [firstList] = lists;
		if (firstList.classList.contains("file-list")) {
			activeFileList = firstList;
			if (firstList.unclasped) {
				const heightOffset = height - headerHeight;
				const totalHeight =
					ITEM_HEIGHT * activeFileList.$ul.children.length + headerHeight;
				const maxHeight =
					lists.length === 1 || !lists.slice(1).find((list) => list.unclasped)
						? window.innerHeight
						: window.innerHeight / 2;
				const minHeight = Math.min(totalHeight, maxHeight - heightOffset);

				activeFileList.style.maxHeight = `${minHeight}px`;
				activeFileList.style.height = `${minHeight}px`;
				height += minHeight - headerHeight;
			}
		}
	}

	lists.forEach((list) => {
		if (list === activeFileList) return;

		if (target === activeFileList) {
			if (list.collapsed) {
				list.style.removeProperty("max-height");
				list.style.removeProperty("height");
				return;
			}
			target = list;
		}

		if (list === target && target.unclasped) {
			list.style.maxHeight = `calc(100% - ${height}px)`;
			list.style.height = `calc(100% - ${height}px)`;
			return;
		}

		if (list.collapsed) {
			list.style.removeProperty("max-height");
			list.style.removeProperty("height");
			return;
		}

		list.collapse();
		list.style.removeProperty("max-height");
		list.style.removeProperty("height");
		return;
	});
}
