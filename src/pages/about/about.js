import "./about.scss";
import Logo from "components/logo";
import Page from "components/page";
import Reactive from "html-tag-js/reactive";
import actionStack from "lib/actionStack";
import config from "lib/config";
import helpers from "utils/helpers";

export default function AboutInclude() {
	const $page = Page(strings.about.capitalize());
	const webviewVersionName = Reactive("N/A");
	const webviewPackageName = Reactive("N/A");

	$page.classList.add("about-us");
	$page.body = (
		<main id="about-page" className="main scroll">
			<Logo />

			<div className="version-info">
				<h1 className="version-title">SS Coding</h1>
				<p className="version-subtitle">Modern Mobile Code Workspace</p>
				<div className="version-number">
					Version {BuildInfo.version} ({BuildInfo.versionCode}) ·{" "}
					{BuildInfo.packageName}
				</div>
			</div>

			<div className="info-section ss-glass-card">
				<a
					href="#"
					className="info-item"
					onclick={(e) => {
						e.preventDefault();
						system.openInBrowser(
							`https://play.google.com/store/apps/details?id=${webviewPackageName.value}`,
						);
					}}
				>
					<div className="info-item-icon">
						<span className="icon googlechrome"></span>
					</div>
					<div className="info-item-text">
						WebView Engine {webviewVersionName}
						<div className="info-item-subtext">{webviewPackageName}</div>
					</div>
				</a>
				<a
					href={`mailto:${config.FEEDBACK_EMAIL}`}
					className="info-item"
					onclick={(e) => {
						e.preventDefault();
						system.openInBrowser(`mailto:${config.FEEDBACK_EMAIL}`);
					}}
				>
					<div className="info-item-icon">
						<span className="icon gmail"></span>
					</div>
					<div className="info-item-text">
						Support & Feedback
						<div className="info-item-subtext">{config.FEEDBACK_EMAIL}</div>
					</div>
				</a>
				<a
					href={config.GITHUB_URL}
					className="info-item"
					onclick={(e) => {
						e.preventDefault();
						system.openInBrowser(config.GITHUB_URL);
					}}
				>
					<div className="info-item-icon">
						<span className="icon github"></span>
					</div>
					<div className="info-item-text">
						Open Source Foundation
						<div className="info-item-subtext">
							Powered by CodeMirror 6, xterm.js & open-source MIT modules
						</div>
					</div>
				</a>
			</div>
		</main>
	);

	system.getWebviewInfo((res) => {
		webviewPackageName.value = res?.packageName || "N/A";
		webviewVersionName.value = res?.versionName || "N/A";
	});

	actionStack.push({
		id: "about",
		action: $page.hide,
	});

	$page.onhide = function () {
		actionStack.remove("about");
	};

	app.append($page);
	helpers.showAd();
}
