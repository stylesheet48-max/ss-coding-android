import "./HomeDashboard.scss";
import fsOperation from "fileSystem";
import { getResolvedKeyBindings } from "cm/commandRegistry";
import Sidebar from "components/sidebar";
import toast from "components/toast";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import openFile from "lib/openFile";
import openFolder, { addedFolder } from "lib/openFolder";
import projects from "lib/projects";
import recents from "lib/recents";
import FileBrowser from "pages/fileBrowser";
import helpers from "utils/helpers";
import Uri from "utils/Uri";
import Url from "utils/Url";

/**
 * Renders the modular SS Coding Welcome & Home Developer Dashboard.
 * Preserves live bindings to recents, project creation, file/folder opening,
 * terminal, project search, and settings.
 * @returns {HTMLElement}
 */
export default function HomeDashboard() {
	const bindings = getResolvedKeyBindings();
	const kb = (name) => {
		const binding = bindings[name];
		return binding?.key ? binding.key.split("|")[0].replace(/-/g, "+") : "";
	};

	const $recentProjectsList = <div className="ss-recent-list" />;
	const $recentFilesList = <div className="ss-recent-list" />;
	const $workspaceMeta = <span className="ss-hero-badge" />;

	function updateWorkspaceSummary() {
		const openFilesCount =
			window.editorManager?.files?.filter((f) => f.id !== "welcome-tab")
				.length || 0;
		const openFoldersCount = addedFolder?.length || 0;
		const version = window.BuildInfo?.version || "1.13.5";
		$workspaceMeta.textContent = `v${version} · ${openFoldersCount} project${openFoldersCount === 1 ? "" : "s"} · ${openFilesCount} tab${openFilesCount === 1 ? "" : "s"}`;
	}

	function formatPath(rawUrl) {
		const parsed = Url.parse(rawUrl).url;
		const isSaf = /^content:/.test(parsed);
		const display = isSaf
			? Uri.getDisplayPath(parsed)
			: helpers.getVirtualPath(parsed);
		const name = Url.basename(display) || parsed;
		const dir = Url.dirname(display)?.replace(/\/$/, "") || "/";
		return { name, dir };
	}

	function renderRecents() {
		updateWorkspaceSummary();
		const folders = recents.folders || [];
		const files = recents.files || [];

		if (!folders.length) {
			$recentProjectsList.replaceChildren(
				<div className="ss-empty-inline">
					<span>No recent projects yet.</span>
					<button
						type="button"
						className="ss-link-btn"
						onclick={() => acode.exec("open-folder")}
					>
						Open Project
					</button>
				</div>,
			);
		} else {
			$recentProjectsList.replaceChildren(
				...folders.slice(0, 5).map((folder) => {
					const { name, dir } = formatPath(folder.url);
					return (
						<div
							className="ss-recent-item"
							onclick={() => {
								openFolder(folder.url, folder.opts || {});
								Sidebar.show();
							}}
						>
							<span className="icon folder ss-recent-icon is-folder" />
							<div className="ss-recent-meta">
								<span className="ss-recent-name">{name}</span>
								<span className="ss-recent-path">{dir}</span>
							</div>
							<button
								type="button"
								className="icon clearclose ss-recent-remove"
								aria-label={`Remove ${name}`}
								onclick={(e) => {
									e.stopPropagation();
									recents.removeFolder(folder.url);
									renderRecents();
								}}
							/>
						</div>
					);
				}),
			);
		}

		if (!files.length) {
			$recentFilesList.replaceChildren(
				<div className="ss-empty-inline">
					<span>No recent files yet.</span>
					<button
						type="button"
						className="ss-link-btn"
						onclick={() => acode.exec("new-file")}
					>
						Create File
					</button>
				</div>,
			);
		} else {
			$recentFilesList.replaceChildren(
				...files.slice(0, 5).map((fileUri) => {
					const { name, dir } = formatPath(fileUri);
					return (
						<div
							className="ss-recent-item"
							onclick={() => openFile(fileUri, { render: true })}
						>
							<span className="icon document-code-outline ss-recent-icon" />
							<div className="ss-recent-meta">
								<span className="ss-recent-name">{name}</span>
								<span className="ss-recent-path">{dir}</span>
							</div>
							<button
								type="button"
								className="icon clearclose ss-recent-remove"
								aria-label={`Remove ${name}`}
								onclick={(e) => {
									e.stopPropagation();
									recents.removeFile(fileUri);
									renderRecents();
								}}
							/>
						</div>
					);
				}),
			);
		}
	}

	async function handleNewProject() {
		try {
			const available = projects.list();
			let selectedTemplate = "html";
			if (available.length > 1) {
				selectedTemplate = await select(
					"New Project Template",
					available.map((p) => [p.name, p.name.toUpperCase()]),
				);
			}
			const projectName = await prompt("New Project", "my-project", "text", {
				match: /^[a-zA-Z0-9._-]+$/,
				required: true,
			});
			if (!projectName) return;

			const dest = await FileBrowser(
				"folder",
				`Choose location for ${projectName}`,
			);
			if (!dest?.url) return;

			const parentFs = fsOperation(dest.url);
			const projectUrl = Url.join(dest.url, projectName);
			if (!(await fsOperation(projectUrl).exists())) {
				await parentFs.createDirectory(projectName);
			}

			const template = projects.get(selectedTemplate);
			if (template) {
				const filesMap = await template.files();
				for (const [relPath, rawContent] of Object.entries(filesMap)) {
					const parts = relPath.split("/").filter(Boolean);
					const fileName = parts.pop();
					let currentDir = projectUrl;
					for (const dirPart of parts) {
						const nextDir = Url.join(currentDir, dirPart);
						if (!(await fsOperation(nextDir).exists())) {
							await fsOperation(currentDir).createDirectory(dirPart);
						}
						currentDir = nextDir;
					}
					const content = String(rawContent).replaceAll(
						"<%name%>",
						projectName,
					);
					await fsOperation(currentDir).createFile(fileName, content);
				}
			}

			openFolder(projectUrl, { name: projectName });
			Sidebar.show();
			renderRecents();
			toast(`Created project ${projectName}`);
		} catch (error) {
			if (error?.code !== 0) {
				helpers.error(error);
			}
		}
	}

	function openProjectSearch() {
		Sidebar.show();
		const $searchIcon = Sidebar.el?.querySelector(
			'.app-icons-container [data-id="searchInFiles"]',
		);
		$searchIcon?.click();
	}

	const $dashboard = (
		<div id="welcome-tab" className="ss-dashboard scroll">
			{/* Hero Branding Card */}
			<section className="ss-hero-card ss-glass-card">
				<div className="ss-hero-top">
					<img
						className="ss-hero-logo"
						src="./logo.svg"
						width="56"
						height="56"
						alt="SS Coding"
					/>
					<div className="ss-hero-text">
						<h1>SS Coding</h1>
						<p className="ss-hero-tagline">
							Modern mobile code workspace with frosted glass clarity
						</p>
						{$workspaceMeta}
					</div>
				</div>
				<div className="ss-hero-actions">
					<button
						type="button"
						className="ss-btn-primary"
						onclick={() => acode.exec("new-file")}
					>
						<span className="icon add" />
						<span>{strings["new file"] || "New File"}</span>
					</button>
					<button
						type="button"
						className="ss-btn-glass"
						onclick={() => acode.exec("open-folder")}
					>
						<span className="icon folder_open" />
						<span>Open Project</span>
					</button>
				</div>
			</section>

			{/* Quick Actions Grid */}
			<section className="ss-dash-section">
				<div className="ss-section-head">
					<h2>Workspace Actions</h2>
					<button
						type="button"
						className="ss-link-btn"
						onclick={() => acode.exec("command-palette")}
					>
						Commands{" "}
						{kb("openCommandPalette") ? `(${kb("openCommandPalette")})` : ""}
					</button>
				</div>
				<div className="ss-action-grid">
					<QuickCard
						icon="document-add-outline"
						title={strings["new file"] || "New File"}
						subtitle={kb("newFile") || "Create buffer"}
						onClick={() => acode.exec("new-file")}
					/>
					<QuickCard
						icon="document-text-outline"
						title={strings["open file"] || "Open File"}
						subtitle={kb("openFile") || "Browse device"}
						onClick={() => acode.exec("open-file")}
					/>
					<QuickCard
						icon="folder-add-outline"
						title="New Project"
						subtitle="Starter template"
						onClick={handleNewProject}
					/>
					<QuickCard
						icon="folder_open"
						title={strings["open folder"] || "Open Folder"}
						subtitle={kb("openFolder") || "Project tree"}
						onClick={() => acode.exec("open-folder")}
					/>
					<QuickCard
						icon="terminal"
						title={strings.terminal || "Terminal"}
						subtitle={kb("openTerminal") || "Alpine shell"}
						onClick={() => acode.exec("new-terminal")}
					/>
					<QuickCard
						icon="search"
						title="Project Search"
						subtitle="Find in files"
						onClick={openProjectSearch}
					/>
					<QuickCard
						icon="color_lenspalette"
						title={strings["change theme"] || "Themes"}
						subtitle="Glass & editor"
						onClick={() => acode.exec("change-app-theme")}
					/>
					<QuickCard
						icon="settings"
						title={strings.settings || "Settings"}
						subtitle="Preferences"
						onClick={() => acode.exec("open", "settings")}
					/>
				</div>
			</section>

			{/* Recent Projects & Files */}
			<div className="ss-dash-columns">
				<section className="ss-dash-card ss-glass-card">
					<div className="ss-section-head">
						<h2>Recent Projects</h2>
						<button
							type="button"
							className="ss-link-btn"
							onclick={() => acode.exec("recent")}
						>
							All Recent
						</button>
					</div>
					{$recentProjectsList}
				</section>

				<section className="ss-dash-card ss-glass-card">
					<div className="ss-section-head">
						<h2>Recent Files</h2>
						<button
							type="button"
							className="ss-link-btn"
							onclick={() => acode.exec("find-file")}
						>
							Quick Open
						</button>
					</div>
					{$recentFilesList}
				</section>
			</div>

			{/* Workspace Utilities */}
			<section className="ss-dash-section">
				<div className="ss-section-head">
					<h2>Studio & Tools</h2>
				</div>
				<div className="ss-utility-row ss-glass-card">
					<UtilityChip
						icon="extension"
						label={strings.plugins || "Plugins"}
						onClick={() => acode.exec("open", "plugins")}
					/>
					<UtilityChip
						icon="apps"
						label={strings["running processes"] || "Processes"}
						onClick={() => acode.exec("running-processes")}
					/>
					<UtilityChip
						icon="info_outline"
						label="About SS Coding"
						onClick={() => acode.exec("open", "about")}
					/>
				</div>
			</section>
		</div>
	);

	renderRecents();

	if (window.editorManager?.on) {
		window.editorManager.on("add-folder", renderRecents);
		window.editorManager.on("remove-folder", renderRecents);
		window.editorManager.on("new-file", renderRecents);
		window.editorManager.on("remove-file", renderRecents);
		window.editorManager.on("switch-file", () => {
			if (window.editorManager?.activeFile?.id === "welcome-tab") {
				renderRecents();
			}
		});
	}

	return $dashboard;
}

function QuickCard({ icon, title, subtitle, onClick }) {
	return (
		<button
			type="button"
			className="ss-action-card ss-glass-card"
			onclick={onClick}
		>
			<div className="ss-action-icon-wrap">
				<span className={`icon ${icon}`} aria-hidden="true" />
			</div>
			<div className="ss-action-meta">
				<span className="ss-action-title">{title}</span>
				{subtitle && <span className="ss-action-sub">{subtitle}</span>}
			</div>
		</button>
	);
}

function UtilityChip({ icon, label, onClick }) {
	return (
		<button type="button" className="ss-utility-chip" onclick={onClick}>
			<span className={`icon ${icon}`} aria-hidden="true" />
			<span>{label}</span>
		</button>
	);
}
