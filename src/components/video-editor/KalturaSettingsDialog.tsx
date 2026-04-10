import { Check, LogOut, RefreshCw, Settings2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useScopedT } from "@/contexts/I18nContext";
import { KalturaLoginForm } from "./KalturaLoginForm";

interface KalturaSettingsDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onLogout?: () => void;
}

interface ConnectedState {
	partnerId: number;
	serviceUrl: string;
	userId: string;
	displayName?: string;
	ksExpiry: number;
}

type DialogPhase = "logged_out" | "account_selection" | "connected";

export function KalturaSettingsDialog({ isOpen, onClose, onLogout }: KalturaSettingsDialogProps) {
	const t = useScopedT("kaltura");
	const [phase, setPhase] = useState<DialogPhase>("logged_out");
	const [error, setError] = useState<string | undefined>();
	const [partners, setPartners] = useState<Array<{ id: number; name: string }>>([]);
	const [connected, setConnected] = useState<ConnectedState | null>(null);

	// Load existing session on open
	useEffect(() => {
		if (!isOpen) return;

		setError(undefined);
		setPhase("logged_out");

		window.electronAPI.kalturaLoadSession().then((result) => {
			if (result.success && result.state?.connected) {
				setConnected({
					partnerId: result.state.partnerId!,
					serviceUrl: result.state.serviceUrl!,
					userId: result.state.userId!,
					displayName: result.state.displayName,
					ksExpiry: result.state.ksExpiry!,
				});
				setPhase("connected");
			}
		});
	}, [isOpen]);

	const handleLoginSuccess = useCallback(
		(result: {
			partners?: Array<{ id: number; name: string }>;
			state?: {
				connected: boolean;
				partnerId?: number;
				serviceUrl?: string;
				userId?: string;
				displayName?: string;
				ksExpiry?: number;
			};
		}) => {
			if (result.partners && result.partners.length > 1) {
				setPartners(result.partners);
				setPhase("account_selection");
				return;
			}

			if (result.state?.connected) {
				setConnected({
					partnerId: result.state.partnerId!,
					serviceUrl: result.state.serviceUrl!,
					userId: result.state.userId!,
					displayName: result.state.displayName,
					ksExpiry: result.state.ksExpiry!,
				});
				setPhase("connected");
			}
		},
		[],
	);

	const handlePartnerSelected = useCallback(
		(result: {
			state?: {
				connected: boolean;
				partnerId?: number;
				serviceUrl?: string;
				userId?: string;
				displayName?: string;
				ksExpiry?: number;
			};
		}) => {
			if (result.state?.connected) {
				setConnected({
					partnerId: result.state.partnerId!,
					serviceUrl: result.state.serviceUrl!,
					userId: result.state.userId!,
					displayName: result.state.displayName,
					ksExpiry: result.state.ksExpiry!,
				});
				setPhase("connected");
			}
		},
		[],
	);

	const handleError = useCallback((msg: string) => {
		setError(msg);
		setPhase("logged_out");
	}, []);

	const handleLogout = useCallback(async () => {
		await window.electronAPI.kalturaLogout();
		setConnected(null);
		setPhase("logged_out");
		onLogout?.();
	}, [onLogout]);

	const handleSwitchAccount = useCallback(async () => {
		const result = await window.electronAPI.kalturaListPartners();
		if (result.success && result.partners && result.partners.length > 1) {
			setPartners(result.partners);
			setPhase("account_selection");
		} else if (!result.success) {
			await window.electronAPI.kalturaLogout();
			setConnected(null);
			setError(result.error || t("connection.switchError"));
			setPhase("logged_out");
		}
	}, [t]);

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="bg-[#09090b] rounded-2xl shadow-2xl border border-white/10 p-8 w-[90vw] max-w-lg">
				{/* Header */}
				<div className="flex items-center gap-3 mb-6">
					<div
						className={`w-10 h-10 rounded-full flex items-center justify-center ring-1 ${
							phase === "connected"
								? "bg-emerald-500/20 ring-emerald-500/50"
								: "bg-orange-500/20 ring-orange-500/50"
						}`}
					>
						{phase === "connected" ? (
							<Check className="w-5 h-5 text-emerald-400" />
						) : (
							<Settings2 className="w-5 h-5 text-orange-400" />
						)}
					</div>
					<div>
						<span className="text-lg font-bold text-slate-200 block">
							{phase === "connected"
								? t("connection.connected")
								: phase === "account_selection"
									? t("connection.selectAccount")
									: t("connection.title")}
						</span>
						<span className="text-xs text-slate-500">
							{phase === "connected" && connected
								? t("connection.partnerId", { id: connected.partnerId })
								: phase === "account_selection"
									? t("connection.chooseAccount")
									: t("connection.connectPrompt")}
						</span>
					</div>
				</div>

				{/* Login / Account Selection */}
				{phase !== "connected" && (
					<KalturaLoginForm
						error={error}
						partners={phase === "account_selection" ? partners : undefined}
						onLoginSuccess={handleLoginSuccess}
						onPartnerSelected={handlePartnerSelected}
						onError={handleError}
						onBack={() => {
							setError(undefined);
							setPhase("logged_out");
						}}
					/>
				)}

				{/* Connected State */}
				{phase === "connected" && connected && (
					<div className="space-y-4">
						<div className="space-y-3">
							<div className="flex items-center justify-between py-2 border-b border-white/5">
								<span className="text-xs text-slate-500 uppercase tracking-wider">
									{t("labels.account")}
								</span>
								<span className="text-sm text-slate-200">{connected.partnerId}</span>
							</div>
							<div className="flex items-center justify-between py-2 border-b border-white/5">
								<span className="text-xs text-slate-500 uppercase tracking-wider">
									{t("labels.user")}
								</span>
								<span className="text-sm text-slate-200">
									{connected.displayName || connected.userId}
								</span>
							</div>
							{connected.displayName && (
								<div className="flex items-center justify-between py-2 border-b border-white/5">
									<span className="text-xs text-slate-500 uppercase tracking-wider">
										{t("labels.emailLabel")}
									</span>
									<span className="text-sm text-slate-200">{connected.userId}</span>
								</div>
							)}
							<div className="flex items-center justify-between py-2 border-b border-white/5">
								<span className="text-xs text-slate-500 uppercase tracking-wider">
									{t("labels.session")}
								</span>
								<span className="text-sm text-emerald-400 flex items-center gap-1.5">
									<span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
									{t("connection.sessionActive")}
								</span>
							</div>
						</div>

						<div className="flex items-center gap-3 pt-2 border-t border-white/5">
							<Button
								onClick={handleLogout}
								variant="ghost"
								className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
							>
								<LogOut className="w-4 h-4 mr-2" />
								{t("connection.signOut")}
							</Button>
							<Button
								onClick={handleSwitchAccount}
								variant="ghost"
								className="text-slate-400 hover:text-slate-200 hover:bg-white/10"
							>
								<RefreshCw className="w-4 h-4 mr-2" />
								{t("connection.switchAccount")}
							</Button>
							<div className="flex-1" />
							<Button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-slate-200">
								{t("connection.done")}
							</Button>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
