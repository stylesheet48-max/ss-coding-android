/**
 * Creates a real-operation loading indicator or an actionable error/retry view.
 */
export function createLoadingSpinner(label = "") {
	return (
		<div className="ss-loading-inline">
			<div className="ss-spinner" aria-hidden="true">
				<span className="ss-spinner-ring" />
			</div>
			{label && <span className="ss-loading-label">{label}</span>}
		</div>
	);
}

/**
 * Renders a Glassmorphism initialization / operation error card with retry action.
 * @param {object} options
 * @param {string} [options.title]
 * @param {string} [options.message]
 * @param {Function} [options.onRetry]
 * @returns {HTMLElement}
 */
export function createErrorState({
	title = "Something went wrong",
	message = "An unexpected error interrupted this operation.",
	onRetry,
} = {}) {
	return (
		<div className="ss-error-state ss-glass-card" role="alert">
			<div className="ss-error-icon">
				<span className="icon warningreport_problem" />
			</div>
			<h3 className="ss-error-title">{title}</h3>
			<p className="ss-error-message">{message}</p>
			{typeof onRetry === "function" && (
				<button type="button" className="ss-btn-primary" onclick={onRetry}>
					<span className="icon refresh" />
					<span>Retry</span>
				</button>
			)}
		</div>
	);
}

export default {
	createLoadingSpinner,
	createErrorState,
};
