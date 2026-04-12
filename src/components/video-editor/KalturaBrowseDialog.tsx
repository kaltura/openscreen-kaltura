import {
	AlertCircle,
	Download,
	Loader2,
	LogOut,
	MousePointerClick,
	RefreshCw,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n, useScopedT } from "@/contexts/I18nContext";
import { KalturaLoginForm } from "./KalturaLoginForm";

type PageState =
	| { phase: "checking_session" }
	| { phase: "login"; error?: string }
	| { phase: "account_selection"; partners: Array<{ id: number; name: string }> }
	| { phase: "loading_manager" }
	| { phase: "browsing" }
	| { phase: "downloading"; entryName: string; percentage: number }
	| { phase: "error"; message: string };

/**
 * Full-page Kaltura browse component rendered in its own BrowserWindow.
 * Handles login if needed, then shows the embedded media manager.
 */
export function KalturaBrowsePage() {
	const [state, setState] = useState<PageState>({ phase: "checking_session" });
	const containerRef = useRef<HTMLDivElement>(null);
	const cleanupRef = useRef<(() => void) | null>(null);
	const { locale } = useI18n();
	const t = useScopedT("kaltura");

	// Check session on mount
	useEffect(() => {
		window.electronAPI
			.kalturaLoadSession()
			.then((result) => {
				if (result.success && result.state?.connected) {
					setState({ phase: "loading_manager" });
				} else {
					setState({ phase: "login" });
				}
			})
			.catch(() => {
				setState({ phase: "login" });
			});
		return () => {
			cleanupRef.current?.();
			cleanupRef.current = null;
		};
	}, []);

	const handleEntrySelected = useCallback(
		async (entryId: string, entryName: string) => {
			setState({ phase: "downloading", entryName, percentage: 0 });

			const unsubProgress = window.electronAPI.onKalturaDownloadProgress((progress) => {
				if (progress.phase === "downloading") {
					setState({ phase: "downloading", entryName, percentage: progress.percentage });
				}
			});

			try {
				const result = await window.electronAPI.kalturaDownload({ entryId });
				unsubProgress();

				if (result.success && result.filePath) {
					await window.electronAPI.kalturaBrowseVideoLoaded(result.filePath);
				} else {
					setState({ phase: "error", message: result.error || t("browse.downloadFailed") });
				}
			} catch (error) {
				unsubProgress();
				setState({ phase: "error", message: String(error) });
			}
		},
		[t],
	);

	// Initialize media manager when we reach the loading_manager phase
	useEffect(() => {
		if (state.phase !== "loading_manager") return;

		let cancelled = false;

		async function init() {
			try {
				const sessionInfo = await window.electronAPI.kalturaGetSessionInfo();
				if (!sessionInfo.success || !sessionInfo.ks || !sessionInfo.partnerId) {
					setState({ phase: "login", error: t("connection.sessionExpired") });
					return;
				}

				if (cancelled || !containerRef.current) return;

				// The Kaltura Unisphere media manager is loaded from CDN as an ESM module.
				// This is the official integration pattern — the widget renders inside our
				// container div with context isolation still active (no Node access).
				// webSecurity: false on this window's BrowserPreferences allows the cross-origin load.
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
						language: locale,
					},
				};

				await loader(options);
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

						// Skip category rows
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
								const objects = data?.objects as
									| Array<{ id: string; name: string; mediaType?: number }>
									| undefined;
								if (!objects?.length) throw new Error(t("browse.entryNotFound"));
								const entry = objects.find((e) => e.name === entryName);
								if (!entry) throw new Error(t("browse.entryNotFound"));
								handleEntrySelected(entry.id, entry.name);
							})
							.catch((err) => {
								console.error("[KalturaBrowse] Failed to resolve entry:", err);
								selecting = false;
								row.style.opacity = "";
							});
					}

					function bindRow(row: HTMLTableRowElement) {
						if (row.dataset.selectBound) return;
						row.dataset.selectBound = "1";
						row.style.cursor = "pointer";
						row.addEventListener(
							"dblclick",
							(e) => {
								e.preventDefault();
								e.stopPropagation();
								resolveAndSelect(row);
							},
							true,
						);
						row.addEventListener(
							"keydown",
							(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									e.stopPropagation();
									resolveAndSelect(row);
								}
							},
							true,
						);
						row.setAttribute("tabindex", "0");
					}

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

						const altRows = root.querySelectorAll<HTMLTableRowElement>(
							"tr[data-row-id], tr[role='row'], [class*='row']",
						);
						if (altRows.length > 0 && rows.length === 0) {
							altRows.forEach(bindRow);
						}
					});
					observer.observe(root, { childList: true, subtree: true });

					// Bind rows already in the DOM after initial widget render
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
					setState({ phase: "error", message: t("browse.loadFailed", { error: String(error) }) });
				}
			}
		}

		init();

		return () => {
			cancelled = true;
		};
	}, [state.phase, handleEntrySelected, t, locale]);

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
			await window.electronAPI.kalturaLogout();
			setState({
				phase: "login",
				error: result.error || t("connection.switchError"),
			});
		}
	}, [t]);

	const isLoginPhase = state.phase === "login" || state.phase === "account_selection";

	return (
		<div className="w-full h-full bg-[#09090b] flex flex-col p-5">
			{/* Header */}
			<div className="flex items-center justify-between mb-4 flex-shrink-0">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-full bg-orange-500/20 ring-1 ring-orange-500/50 flex items-center justify-center">
						<Download className="w-5 h-5 text-orange-400" />
					</div>
					<div>
						<span className="text-lg font-bold text-slate-200 block">
							{isLoginPhase ? t("browse.signInTitle") : t("browse.title")}
						</span>
						<span className="text-xs text-slate-500">
							{isLoginPhase ? t("browse.connectPrompt") : t("browse.selectPrompt")}
						</span>
					</div>
				</div>
				{state.phase !== "downloading" && (
					<div className="flex items-center gap-2">
						{(state.phase === "browsing" || state.phase === "loading_manager") && (
							<>
								<Button
									variant="ghost"
									size="sm"
									onClick={async () => {
										cleanupRef.current?.();
										cleanupRef.current = null;
										await window.electronAPI.kalturaLogout();
										setState({ phase: "login" });
									}}
									className="hover:bg-white/10 text-slate-400 hover:text-white rounded-full gap-1.5 text-xs"
								>
									<LogOut className="w-3.5 h-3.5" />
									{t("connection.signOut")}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={handleSwitchAccount}
									className="hover:bg-white/10 text-slate-400 hover:text-white rounded-full gap-1.5 text-xs"
								>
									<RefreshCw className="w-3.5 h-3.5" />
									{t("connection.switchAccount")}
								</Button>
							</>
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

			{/* Login / Account Selection */}
			{isLoginPhase && (
				<div className="flex-1 flex items-center justify-center">
					<div className="w-full max-w-sm">
						<KalturaLoginForm
							error={state.phase === "login" ? state.error : undefined}
							partners={state.phase === "account_selection" ? state.partners : undefined}
							onLoginSuccess={(result) => {
								if (result.partners && result.partners.length > 1) {
									setState({ phase: "account_selection", partners: result.partners });
								} else if (result.state?.connected) {
									setState({ phase: "loading_manager" });
								}
							}}
							onPartnerSelected={(result) => {
								if (result.state?.connected) {
									setState({ phase: "loading_manager" });
								}
							}}
							onError={(msg) => setState({ phase: "login", error: msg })}
							onBack={() => setState({ phase: "login" })}
						/>
					</div>
				</div>
			)}

			{/* Media Manager / Download */}
			{(state.phase === "checking_session" ||
				state.phase === "loading_manager" ||
				state.phase === "browsing" ||
				state.phase === "downloading") && (
				<div className="flex-1 min-h-0 flex flex-col">
					{state.phase === "browsing" && (
						<div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg mb-2 flex-shrink-0">
							<MousePointerClick className="w-4 h-4 text-orange-400 flex-shrink-0" />
							<span className="text-xs text-orange-300">{t("browse.selectionHint")}</span>
						</div>
					)}
					<div className="flex-1 min-h-0 relative rounded-xl overflow-auto border border-white/5">
						<div
							id="kaltura-media-manager-container"
							ref={containerRef}
							className="w-full h-full"
						/>

						{(state.phase === "checking_session" || state.phase === "loading_manager") && (
							<div className="absolute inset-0 flex items-center justify-center bg-[#09090b]">
								<Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
								<span className="ml-3 text-sm text-slate-400">
									{state.phase === "checking_session"
										? t("browse.checkingSession")
										: t("browse.loadingBrowser")}
								</span>
							</div>
						)}

						{state.phase === "downloading" && (
							<div className="absolute inset-0 flex flex-col items-center justify-center bg-[#09090b]/90 backdrop-blur-sm">
								<Loader2 className="w-8 h-8 text-orange-400 animate-spin mb-4" />
								<span className="text-sm font-medium text-slate-200 mb-1">
									{t("browse.downloading", { name: state.entryName })}
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
								{t("upload.cancel")}
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
