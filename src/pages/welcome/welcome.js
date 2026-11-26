import EditorFile from "lib/editorFile";
import HomeDashboard from "ui/dashboard/HomeDashboard";

/**
 * Opens the SS Coding Home & Welcome dashboard tab as an EditorFile page.
 */
export default function openWelcomeTab() {
	const existingFile = editorManager.files.find((f) => f.id === "welcome-tab");
	if (existingFile) {
		existingFile.makeActive();
		return;
	}

	const homeContent = HomeDashboard();

	const welcomeFile = new EditorFile("Home", {
		id: "welcome-tab",
		render: true,
		type: "page",
		content: homeContent,
		tabIcon: "icon home",
		hideQuickTools: true,
	});

	welcomeFile.setCustomTitle(() => "SS Coding");
}
