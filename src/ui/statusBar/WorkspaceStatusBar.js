import "./WorkspaceStatusBar.scss";
import { hasConnectedServers } from "cm/lsp/connectionState";
import { getEncoding } from "utils/encodings";

/**
 * Lightweight glass status bar displayed at the bottom of active code files.
 * Reads live state from `editorManager` without interfering with CodeMirror internals.
 */
export default function createWorkspaceStatusBar() {
	const $modeBtn = (
		<button
			type="button"
			className="ss-status-chip"
			onclick={() => acode.exec("syntax")}
		/>
	);
	const $cursorBtn = (
		<button
			type="button"
			className="ss-status-chip"
			onclick={() => acode.exec("goto")}
		/>
	);
	const $encodingBtn = (
		<button
			type="button"
			className="ss-status-chip"
			onclick={() => acode.exec("encoding")}
		/>
	);
	const $eolBtn = (
		<button
			type="button"
			className="ss-status-chip"
			onclick={() => acode.exec("eol")}
		/>
	);
	const $lspBtn = (
		<button
			type="button"
			className="ss-status-chip is-lsp"
			onclick={() => acode.exec("lsp-info")}
		/>
	);

	const $bar = (
		<div
			id="ss-status-bar"
			className="is-hidden"
			role="status"
			aria-label="Editor status"
		>
			<div className="ss-status-group">
				{$modeBtn}
				{$cursorBtn}
			</div>
			<div className="ss-status-group">
				{$lspBtn}
				{$eolBtn}
				{$encodingBtn}
			</div>
		</div>
	);

	function update() {
		const em = window.editorManager;
		const file = em?.activeFile;
		const isCodeFile = file && file.type === "editor";

		$bar.classList.toggle("is-hidden", !isCodeFile);
		if (window.root) {
			window.root.setAttribute(
				"data-ss-statusbar",
				isCodeFile ? "visible" : "hidden",
			);
		}
		if (!isCodeFile) return;

		$modeBtn.textContent = file.currentMode || "text";
		$eolBtn.textContent = (file.eol || "LF").toUpperCase();
		$encodingBtn.textContent = getEncoding(file.encoding)?.label || "UTF-8";

		let ln = 1;
		let col = 1;
		try {
			const view = em.editor;
			const state = view?.state;
			if (state) {
				const head = state.selection.main.head;
				const line = state.doc.lineAt(head);
				ln = line.number;
				col = head - line.from + 1;
			}
		} catch (_) {
			// Fallback gracefully if editor state is transitioning
		}
		$cursorBtn.textContent = `Ln ${ln}, Col ${col}`;

		const lspConnected = hasConnectedServers();
		$lspBtn.style.display = lspConnected ? "" : "none";
		if (lspConnected) {
			$lspBtn.textContent = "LSP";
		}
	}

	let updateTimer = null;
	function scheduleUpdate() {
		if (updateTimer) return;
		updateTimer = requestAnimationFrame(() => {
			updateTimer = null;
			update();
		});
	}

	return {
		el: $bar,
		update: scheduleUpdate,
		bind(editorManager) {
			if (!editorManager?.on) return;
			editorManager.on("switch-file", scheduleUpdate);
			editorManager.on("file-loaded", scheduleUpdate);
			editorManager.on("rename-file", scheduleUpdate);
			editorManager.on("remove-file", scheduleUpdate);
			editorManager.on("update", scheduleUpdate);
			document.addEventListener("selectionchange", scheduleUpdate);
			document.addEventListener("keyup", scheduleUpdate);
			document.addEventListener("pointerup", scheduleUpdate);
			scheduleUpdate();
		},
	};
}
