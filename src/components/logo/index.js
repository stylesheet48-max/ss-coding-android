import logoSrc from "./logo.png?inline";
import "./style.scss";

export default function Logo() {
	return (
		<div className="logo">
			<img className="logo-img" src={logoSrc} alt="SS Coding" />
		</div>
	);
}
