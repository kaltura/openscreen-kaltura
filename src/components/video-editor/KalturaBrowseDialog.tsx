import { AlertCircle, ArrowLeft, Check, Download, ExternalLink, Loader2, MousePointerClick, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type PageState =
	| { phase: "checking_session" }
	| { phase: "login"; error?: string }
	| { phase: "logging_in" }
	| { phase: "account_selection"; partners: Array<{ id: number; name: string }> }
	| { phase: "connecting_partner" }
	| { phase: "loading_manager" }
	| { phase: "browsing" }
	| { phase: "downloading"; entryName: string; percentage: number }
	| { phase: "error"; message: string };

/**
 * Full-page Kaltura browse component rendered in its own BrowserWindow.
 * Handles login if needed, then shows the media manager.
 */
export function KalturaBrowsePage() {
	const [state, setState] = useState<PageState>({ phase: "checking_session" });
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [clickedSignup, setClickedSignup] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const cleanupRef = useRef<(() => void) | null>(null);
	const emailInputRef = useRef<HTMLInputElement>(null);

	// Check session on mount
	useEffect(() => {
		window.electronAPI.kalturaLoadSession().then((result) => {
			if (result.success && result.state?.connected) {
				setState({ phase: "loading_manager" });
			} else {
				setState({ phase: "login" });
			}
		});
		return () => {
			cleanupRef.current?.();
			cleanupRef.current = null;
		};
	}, []);

	// Initialize media manager when we reach the loading_manager phase
	useEffect(() => {
		if (state.phase !== "loading_manager") return;

		let cancelled = false;

		async function init() {
			try {
				const sessionInfo = await window.electronAPI.kalturaGetSessionInfo();
				if (!sessionInfo.success || !sessionInfo.ks || !sessionInfo.partnerId) {
					setState({ phase: "login", error: "Session expired. Please sign in again." });
					return;
				}

				if (cancelled || !containerRef.current) return;

				const serverUrl = "https://unisphere.nvq2.ovp.kaltura.com/v1";
				const loaderUrl = `${serverUrl}/loader/index.esm.js`;

				const { loader } = await import(/* @vite-ignore */ loaderUrl);

				if (cancelled || !containerRef.current) return;

				const options = {
					appId: "openscreen",
					appVersion: "1.0.0",
					workspaceName: `openscreen-browse-${Date.now()}`,
					serverUrl,
					runtimes: [
						{
							widgetName: "unisphere.widget.media-manager",
							runtimeName: "kaltura-items-media-manager",
							settings: {
								contextType: "category",
								contextId: "",
								ks: sessionInfo.ks,
								partnerId: sessionInfo.partnerId,
								endpointUrl: `${sessionInfo.serviceUrl || "https://www.kaltura.com"}/api_v3`,
							},
							visuals: [
								{
									type: "table",
									target: { target: "element", elementId: "kaltura-media-manager-container" },
									settings: {},
								},
							],
						},
					],
					ui: {
						theme: "dark",
						language: "en",
					},
				};

				await loader(options);
				if (cancelled) return;

				if (cancelled) return;

				setState({ phase: "browsing" });

				// The media manager widget's internal event system is broken (emit loses `this`).
				// Intercept Select button clicks at the DOM level via a capturing listener
				// (fires before the widget's broken handler), then resolve entry via API.
				const root = containerRef.current;
				if (root) {
					let selecting = false;

					function resolveAndSelect(row: HTMLTableRowElement) {
						if (selecting) return;
						const cells = row.querySelectorAll("td");
						if (cells.length < 2) return;

						// Skip category rows (Drupal pattern: check type column)
						if (cells.length >= 4) {
							const typeTxt = (cells[3]?.textContent || "").trim().toLowerCase();
							if (typeTxt === "category") return;
						}

						const entryName = (cells[1]?.textContent || "").trim();
						if (!entryName) return;

						selecting = true;
						row.style.opacity = "0.6";

						const endpoint = `${sessionInfo.serviceUrl || "https://www.kaltura.com"}/api_v3`;
						const params = new URLSearchParams({
							ks: sessionInfo.ks!,
							"filter[searchTextMatchOr]": entryName,
							"filter[objectType]": "KalturaMediaEntryFilter",
							"pager[pageSize]": "5",
							format: "1",
						});

						fetch(`${endpoint}/service/media/action/list?${params}`)
							.then((r) => r.json())
							.then((data) => {
								const objects = data?.objects as Array<{ id: string; name: string; mediaType?: number }> | undefined;
								if (!objects?.length) throw new Error("Entry not found");
								const entry = objects.find((e) => e.name === entryName) || objects[0];
								handleEntrySelected(entry.id, entry.name);
							})
							.catch((err) => {
								console.error("[KalturaBrowse] Failed to resolve entry:", err);
								selecting = false;
								row.style.opacity = "";
							});
					}

					// Double-click and keyboard selection on rows (same as WP plugin)
					function bindRow(row: HTMLTableRowElement) {
						if (row.dataset.selectBound) return;
						row.dataset.selectBound = "1";
						row.style.cursor = "pointer";
						// Use capture phase to fire before React's synthetic event system
						row.addEventListener("dblclick", (e) => {
							e.preventDefault();
							e.stopPropagation();
							resolveAndSelect(row);
						}, true);
						row.addEventListener("keydown", (e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								e.stopPropagation();
								resolveAndSelect(row);
							}
						}, true);
						row.setAttribute("tabindex", "0");
					}

					// Also add a capturing dblclick on the root container as a fallback
					const rootDblClickHandler = (e: Event) => {
						const row = (e.target as HTMLElement).closest("tr") as HTMLTableRowElement | null;
						if (row && row.closest("tbody")) {
							resolveAndSelect(row);
						}
					};
					root.addEventListener("dblclick", rootDblClickHandler, true);

					const observer = new MutationObserver(() => {
						const rows = root.querySelectorAll<HTMLTableRowElement>("tbody tr");
						rows.forEach(bindRow);

						// Also try broader selectors in case the widget uses a different structure
						const altRows = root.querySelectorAll<HTMLTableRowElement>("tr[data-row-id], tr[role='row'], [class*='row']");
						if (altRows.length > 0 && rows.length === 0) {
							altRows.forEach(bindRow);
						}
					});
					observer.observe(root, { childList: true, subtree: true });

					// Bind any rows already in the DOM after widget loads
					setTimeout(() => {
						root.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach(bindRow);
					}, 3000);

					cleanupRef.current = () => {
						observer.disconnect();
						root.removeEventListener("dblclick", rootDblClickHandler, true);
					};
				}
			} catch (error) {
				if (!cancelled) {
					console.error("Failed to initialize media manager:", error);
					setState({ phase: "error", message: `Failed to load media browser: ${String(error)}` });
				}
			}
		}

		init();

		return () => {
			cancelled = true;
			// Don't clean up observer/listeners here — this runs on every
			// state.phase change (including the "loading_manager" → "browsing"
			// transition that happens inside init). Cleanup happens via
			// cleanupRef when the component unmounts or account is switched.
		};
	}, [state.phase]);

	const handleLogin = useCallback(async () => {
		if (!email.trim() || !password.trim()) return;

		setState({ phase: "logging_in" });

		try {
			const result = await window.electronAPI.kalturaLogin({
				serviceUrl: "https://www.kaltura.com",
				loginId: email.trim(),
				password: password.trim(),
			});

			if (!result.success) {
				setState({ phase: "login", error: result.error || "Login failed" });
				return;
			}

			if (result.partners && result.partners.length > 1) {
				setState({ phase: "account_selection", partners: result.partners });
				return;
			}

			if (result.state?.connected) {
				setPassword("");
				setState({ phase: "loading_manager" });
			}
		} catch (error) {
			setState({ phase: "login", error: String(error) });
		}
	}, [email, password]);

	const handleSelectPartner = useCallback(async (partnerId: number) => {
		setState({ phase: "connecting_partner" });

		try {
			const result = await window.electronAPI.kalturaSelectPartner({ partnerId });

			if (!result.success) {
				setState({ phase: "login", error: result.error || "Failed to select account" });
				return;
			}

			if (result.state?.connected) {
				setPassword("");
				setState({ phase: "loading_manager" });
			}
		} catch (error) {
			setState({ phase: "login", error: String(error) });
		}
	}, []);

	const handleEntrySelected = useCallback(async (entryId: string, entryName: string) => {
		setState({ phase: "downloading", entryName, percentage: 0 });

		const unsubProgress = window.electronAPI.onKalturaDownloadProgress((progress) => {
			const p = progress as { phase: string; percentage: number; filePath?: string; error?: string };
			if (p.phase === "downloading") {
				setState({ phase: "downloading", entryName, percentage: p.percentage });
			}
		});

		try {
			const result = await window.electronAPI.kalturaDownload({ entryId });
			unsubProgress();

			if (result.success && result.filePath) {
				await window.electronAPI.kalturaBrowseVideoLoaded(result.filePath);
			} else {
				setState({ phase: "error", message: result.error || "Download failed" });
			}
		} catch (error) {
			unsubProgress();
			setState({ phase: "error", message: String(error) });
		}
	}, []);

	const handleClose = useCallback(() => {
		window.electronAPI.closeKalturaBrowse();
	}, []);

	const handleSwitchAccount = useCallback(async () => {
		cleanupRef.current?.();
		cleanupRef.current = null;
		const result = await window.electronAPI.kalturaListPartners();
		if (result.success && result.partners && result.partners.length > 1) {
			setState({ phase: "account_selection", partners: result.partners });
		} else if (result.success && result.partners?.length === 1) {
			// Only one account — nothing to switch to
		} else {
			// Credentials expired — fall back to login
			await window.electronAPI.kalturaLogout();
			setEmail("");
			setPassword("");
			setState({ phase: "login", error: result.error || "Please sign in again to switch accounts." });
		}
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && state.phase === "login") {
				handleLogin();
			}
		},
		[state.phase, handleLogin],
	);

	const handleSignup = useCallback(() => {
		setClickedSignup(true);
		window.electronAPI.kalturaOpenSignup();
	}, []);

	// When user returns to the app after signup, auto-focus the email input
	useEffect(() => {
		if (!clickedSignup) return;
		const onFocus = () => {
			// Small delay to let the window fully activate
			setTimeout(() => emailInputRef.current?.focus(), 100);
		};
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [clickedSignup]);

	// --- Login form ---
	const renderLogin = () => (
		<div className="flex-1 flex items-center justify-center">
			<div className="w-full max-w-sm" onKeyDown={handleKeyDown}>
				{state.phase === "login" && state.error && (
					<div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2 mb-4">
						<AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
						<p className="text-sm text-red-400">{state.error}</p>
					</div>
				)}
				{clickedSignup && (
					<div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-2 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
						<Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
						<p className="text-sm text-emerald-300">Account created? Sign in with your new credentials below.</p>
					</div>
				)}
				<div className="space-y-4">
					<div>
						<label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Email</label>
						<input
							ref={emailInputRef}
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
							autoFocus
						/>
					</div>
					<div>
						<label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Password</label>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Enter your password"
							className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
						/>
					</div>
					<Button
						onClick={handleLogin}
						disabled={!email.trim() || !password.trim()}
						className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
					>
						Sign In
					</Button>
					{clickedSignup ? (
						<p className="w-full text-center text-xs text-slate-500">
							After creating your account and verifying your email, come back here to sign in.
						</p>
					) : (
						<button
							type="button"
							onClick={handleSignup}
							className="w-full text-center text-sm text-slate-500 hover:text-orange-400 transition-colors flex items-center justify-center gap-1"
						>
							Don't have an account? Sign up <ExternalLink className="w-3 h-3" />
						</button>
					)}
				</div>
			</div>
		</div>
	);

	// --- Account selection ---
	const renderAccountSelection = () => {
		if (state.phase !== "account_selection") return null;
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="w-full max-w-sm">
					<p className="text-sm text-slate-400 mb-4">Select an account to continue:</p>
					<div className="space-y-2 max-h-[400px] overflow-y-auto">
						{state.partners.map((partner) => (
							<button
								key={partner.id}
								type="button"
								onClick={() => handleSelectPartner(partner.id)}
								className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white transition-colors"
							>
								<span className="font-medium">{partner.name}</span>
								<span className="text-xs text-slate-500 ml-2">#{partner.id}</span>
							</button>
						))}
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="w-full h-full bg-[#09090b] flex flex-col p-5">
			{/* Header */}
			<div className="flex items-center justify-between mb-4 flex-shrink-0">
				<div className="flex items-center gap-3">
					{state.phase === "account_selection" && (
						<button
							type="button"
							onClick={() => setState({ phase: "login" })}
							className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center ring-1 ring-white/10 hover:bg-white/10 transition-colors"
						>
							<ArrowLeft className="w-5 h-5 text-slate-300" />
						</button>
					)}
					{state.phase !== "account_selection" && (
						<div className="w-10 h-10 rounded-full bg-orange-500/20 ring-1 ring-orange-500/50 flex items-center justify-center">
							<Download className="w-5 h-5 text-orange-400" />
						</div>
					)}
					<div>
						<span className="text-lg font-bold text-slate-200 block">
							{state.phase === "login" || state.phase === "logging_in"
								? "Sign in to Kaltura"
								: state.phase === "account_selection" || state.phase === "connecting_partner"
									? "Select Account"
									: "Load from Kaltura"}
						</span>
						<span className="text-xs text-slate-500">
							{state.phase === "login" || state.phase === "logging_in"
								? (clickedSignup ? "Welcome back \u2014 sign in with your new account" : "Connect to browse your video library")
								: state.phase === "account_selection"
									? "Choose which account to use"
									: "Select a video from your library"}
						</span>
					</div>
				</div>
				{state.phase !== "downloading" && state.phase !== "logging_in" && state.phase !== "connecting_partner" && (
					<div className="flex items-center gap-2">
						{(state.phase === "browsing" || state.phase === "loading_manager") && (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleSwitchAccount}
								className="hover:bg-white/10 text-slate-400 hover:text-white rounded-full gap-1.5 text-xs"
							>
								<RefreshCw className="w-3.5 h-3.5" />
								Switch Account
							</Button>
						)}
						<Button
							variant="ghost"
							size="icon"
							onClick={handleClose}
							className="hover:bg-white/10 text-slate-400 hover:text-white rounded-full"
						>
							<X className="w-5 h-5" />
						</Button>
					</div>
				)}
			</div>

			{/* Content */}
			{(state.phase === "login" || state.phase === "logging_in") && (
				state.phase === "logging_in" ? (
					<div className="flex-1 flex items-center justify-center">
						<Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
						<span className="ml-3 text-sm text-slate-400">Signing in...</span>
					</div>
				) : renderLogin()
			)}

			{(state.phase === "account_selection" || state.phase === "connecting_partner") && (
				state.phase === "connecting_partner" ? (
					<div className="flex-1 flex items-center justify-center">
						<Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
						<span className="ml-3 text-sm text-slate-400">Connecting...</span>
					</div>
				) : renderAccountSelection()
			)}

			{(state.phase === "checking_session" || state.phase === "loading_manager" || state.phase === "browsing" || state.phase === "downloading") && (
				<div className="flex-1 min-h-0 flex flex-col">
					{/* Selection hint banner */}
					{state.phase === "browsing" && (
						<div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg mb-2 flex-shrink-0">
							<MousePointerClick className="w-4 h-4 text-orange-400 flex-shrink-0" />
							<span className="text-xs text-orange-300">Double-click a video to select and load it into the editor</span>
						</div>
					)}
					<div className="flex-1 min-h-0 relative rounded-xl overflow-auto border border-white/5">
					{/* Unisphere media manager container */}
					<div
						id="kaltura-media-manager-container"
						ref={containerRef}
						className="w-full h-full"
					/>

					{/* Loading states */}
					{(state.phase === "checking_session" || state.phase === "loading_manager") && (
						<div className="absolute inset-0 flex items-center justify-center bg-[#09090b]">
							<Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
							<span className="ml-3 text-sm text-slate-400">
								{state.phase === "checking_session" ? "Checking session..." : "Loading media browser..."}
							</span>
						</div>
					)}

					{/* Downloading state */}
					{state.phase === "downloading" && (
						<div className="absolute inset-0 flex flex-col items-center justify-center bg-[#09090b]/90 backdrop-blur-sm">
							<Loader2 className="w-8 h-8 text-orange-400 animate-spin mb-4" />
							<span className="text-sm font-medium text-slate-200 mb-1">
								Downloading: {state.entryName}
							</span>
							<div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden mt-2">
								<div
									className="h-full bg-orange-500 rounded-full transition-all duration-300"
									style={{ width: `${state.percentage}%` }}
								/>
							</div>
							<span className="text-xs text-slate-500 mt-2">{state.percentage}%</span>
						</div>
					)}
					</div>
				</div>
			)}

			{/* Error state */}
			{state.phase === "error" && (
				<div className="flex-1 flex items-center justify-center">
					<div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 max-w-md">
						<AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
						<div>
							<p className="text-sm text-red-400 leading-relaxed">{state.message}</p>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleClose}
								className="mt-3 text-slate-400 hover:text-white"
							>
								Close
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
