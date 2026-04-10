import {
	AlertCircle,
	ArrowLeft,
	Check,
	ExternalLink,
	Loader2,
	LogOut,
	RefreshCw,
	Settings2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface KalturaSettingsDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onLogout?: () => void;
}

type DialogState =
	| { phase: "logged_out"; error?: string }
	| { phase: "logging_in" }
	| { phase: "account_selection"; partners: Array<{ id: number; name: string }> }
	| { phase: "connecting_partner" }
	| {
			phase: "connected";
			partnerId: number;
			serviceUrl: string;
			userId: string;
			displayName?: string;
			ksExpiry: number;
	  };

export function KalturaSettingsDialog({ isOpen, onClose, onLogout }: KalturaSettingsDialogProps) {
	const [dialogState, setDialogState] = useState<DialogState>({ phase: "logged_out" });
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [clickedSignup, setClickedSignup] = useState(false);
	const emailInputRef = useRef<HTMLInputElement>(null);

	// Load existing session on open
	useEffect(() => {
		if (!isOpen) return;

		setPassword("");
		setClickedSignup(false);
		setDialogState({ phase: "logged_out" });

		window.electronAPI.kalturaLoadSession().then((result) => {
			if (result.success && result.state?.connected) {
				setDialogState({
					phase: "connected",
					partnerId: result.state.partnerId!,
					serviceUrl: result.state.serviceUrl!,
					userId: result.state.userId!,
					displayName: result.state.displayName,
					ksExpiry: result.state.ksExpiry!,
				});
			}
		});
	}, [isOpen]);

	const handleLogin = useCallback(async () => {
		if (!email.trim() || !password.trim()) return;

		setDialogState({ phase: "logging_in" });

		try {
			const result = await window.electronAPI.kalturaLogin({
				serviceUrl: "https://www.kaltura.com",
				loginId: email.trim(),
				password: password.trim(),
			});

			if (!result.success) {
				setDialogState({ phase: "logged_out", error: result.error || "Login failed" });
				return;
			}

			if (result.partners && result.partners.length > 1) {
				setDialogState({ phase: "account_selection", partners: result.partners });
				return;
			}

			if (result.state?.connected) {
				setPassword("");
				setDialogState({
					phase: "connected",
					partnerId: result.state.partnerId!,
					serviceUrl: result.state.serviceUrl!,
					userId: result.state.userId!,
					displayName: result.state.displayName,
					ksExpiry: result.state.ksExpiry!,
				});
			}
		} catch (error) {
			setDialogState({ phase: "logged_out", error: String(error) });
		}
	}, [email, password]);

	const handleSelectPartner = useCallback(async (partnerId: number) => {
		setDialogState({ phase: "connecting_partner" });

		try {
			const result = await window.electronAPI.kalturaSelectPartner({ partnerId });

			if (!result.success) {
				setDialogState({
					phase: "logged_out",
					error: result.error || "Failed to select account",
				});
				return;
			}

			if (result.state?.connected) {
				setPassword("");
				setDialogState({
					phase: "connected",
					partnerId: result.state.partnerId!,
					serviceUrl: result.state.serviceUrl!,
					userId: result.state.userId!,
					displayName: result.state.displayName,
					ksExpiry: result.state.ksExpiry!,
				});
			}
		} catch (error) {
			setDialogState({ phase: "logged_out", error: String(error) });
		}
	}, []);

	const handleLogout = useCallback(async () => {
		await window.electronAPI.kalturaLogout();
		setEmail("");
		setPassword("");
		setDialogState({ phase: "logged_out" });
		onLogout?.();
	}, [onLogout]);

	const handleSwitchAccount = useCallback(async () => {
		const result = await window.electronAPI.kalturaListPartners();
		if (result.success && result.partners && result.partners.length > 1) {
			setDialogState({ phase: "account_selection", partners: result.partners });
		} else if (!result.success) {
			await window.electronAPI.kalturaLogout();
			setEmail("");
			setPassword("");
			setDialogState({ phase: "logged_out", error: result.error || "Please sign in again to switch accounts." });
		}
	}, []);

	const handleSignup = useCallback(() => {
		setClickedSignup(true);
		window.electronAPI.kalturaOpenSignup();
	}, []);

	// When user returns to the app after signup, auto-focus the email input
	useEffect(() => {
		if (!clickedSignup || !isOpen) return;
		const onFocus = () => {
			setTimeout(() => emailInputRef.current?.focus(), 100);
		};
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [clickedSignup, isOpen]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && dialogState.phase === "logged_out") {
				handleLogin();
			}
		},
		[dialogState.phase, handleLogin],
	);

	if (!isOpen) return null;

	const isLoggingIn = dialogState.phase === "logging_in";
	const isConnecting = dialogState.phase === "connecting_partner";

	return (
		<>
			<div
				className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 animate-in fade-in duration-200"
				onClick={isLoggingIn || isConnecting ? undefined : onClose}
			/>
			<div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60] bg-[#09090b] rounded-2xl shadow-2xl border border-white/10 p-8 w-[90vw] max-w-lg animate-in zoom-in-95 duration-200">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center gap-3">
						{dialogState.phase === "account_selection" ? (
							<button
								type="button"
								onClick={() => setDialogState({ phase: "logged_out" })}
								className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center ring-1 ring-white/10 hover:bg-white/10 transition-colors"
							>
								<ArrowLeft className="w-5 h-5 text-slate-300" />
							</button>
						) : (
							<div
								className={`w-10 h-10 rounded-full flex items-center justify-center ring-1 ${
									dialogState.phase === "connected"
										? "bg-emerald-500/20 ring-emerald-500/50"
										: "bg-orange-500/20 ring-orange-500/50"
								}`}
							>
								{dialogState.phase === "connected" ? (
									<Check className="w-5 h-5 text-emerald-400" />
								) : (
									<Settings2 className="w-5 h-5 text-orange-400" />
								)}
							</div>
						)}
						<div>
							<span className="text-lg font-bold text-slate-200 block">
								{dialogState.phase === "connected"
									? "Connected to Kaltura"
									: dialogState.phase === "account_selection"
										? "Select Account"
										: "Kaltura Connection"}
							</span>
							<span className="text-xs text-slate-500">
								{dialogState.phase === "connected" && "partnerId" in dialogState
									? `Partner ${dialogState.partnerId}`
									: dialogState.phase === "account_selection"
										? "Choose a Kaltura account to connect"
										: clickedSignup
											? "Welcome back \u2014 sign in with your new account"
											: "Sign in to your Kaltura account"}
							</span>
						</div>
					</div>
					{!isLoggingIn && !isConnecting && (
						<Button
							variant="ghost"
							size="icon"
							onClick={onClose}
							className="hover:bg-white/10 text-slate-400 hover:text-white rounded-full"
						>
							<X className="w-5 h-5" />
						</Button>
					)}
				</div>

				{/* Post-signup welcome banner */}
				{dialogState.phase === "logged_out" && clickedSignup && (
					<div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
						<div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
							<Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
							<p className="text-sm text-emerald-300 leading-relaxed">Account created? Sign in with your new credentials below.</p>
						</div>
					</div>
				)}

				{/* Error Message */}
				{dialogState.phase === "logged_out" && dialogState.error && (
					<div className="mb-4 animate-in slide-in-from-top-2">
						<div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
							<AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
							<p className="text-sm text-red-400 leading-relaxed">{dialogState.error}</p>
						</div>
					</div>
				)}

				{/* Login Form */}
				{(dialogState.phase === "logged_out" || dialogState.phase === "logging_in") && (
					<div className="space-y-4" onKeyDown={handleKeyDown}>
						<div>
							<label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
								Email
							</label>
							<input
								ref={emailInputRef}
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								disabled={isLoggingIn}
								placeholder="you@example.com"
								autoComplete="email"
								className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 disabled:opacity-50"
							/>
						</div>

						<div>
							<label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
								Password
							</label>
							<input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={isLoggingIn}
								placeholder="Enter your password"
								autoComplete="current-password"
								className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 disabled:opacity-50"
							/>
						</div>

						<div className="flex items-center justify-between pt-2">
							{clickedSignup ? (
								<span className="text-xs text-slate-500">
									After verifying your email, sign in here.
								</span>
							) : (
								<button
									type="button"
									onClick={handleSignup}
									className="text-xs text-slate-400 hover:text-orange-400 transition-colors flex items-center gap-1"
								>
									Don&apos;t have an account? Sign up free
									<ExternalLink className="w-3 h-3" />
								</button>
							)}
							<Button
								onClick={handleLogin}
								disabled={!email.trim() || !password.trim() || isLoggingIn}
								className="bg-orange-500 hover:bg-orange-600 text-white"
							>
								{isLoggingIn ? (
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
								) : null}
								Sign In
							</Button>
						</div>
					</div>
				)}

				{/* Account Selection */}
				{(dialogState.phase === "account_selection" || dialogState.phase === "connecting_partner") && (
					<div className="space-y-2 max-h-64 overflow-y-auto">
						{dialogState.phase === "account_selection" &&
							dialogState.partners.map((partner) => (
								<button
									key={partner.id}
									type="button"
									onClick={() => handleSelectPartner(partner.id)}
									className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-orange-500/30 transition-all flex items-center justify-between group"
								>
									<div>
										<span className="text-sm font-medium text-slate-200 block">
											{partner.name}
										</span>
										<span className="text-xs text-slate-500">
											Partner ID: {partner.id}
										</span>
									</div>
									<ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-orange-400 rotate-180 transition-colors" />
								</button>
							))}
						{isConnecting && (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
								<span className="ml-3 text-sm text-slate-400">Connecting...</span>
							</div>
						)}
					</div>
				)}

				{/* Connected State */}
				{dialogState.phase === "connected" && (
					<div className="space-y-4">
						<div className="space-y-3">
							<div className="flex items-center justify-between py-2 border-b border-white/5">
								<span className="text-xs text-slate-500 uppercase tracking-wider">Account</span>
								<span className="text-sm text-slate-200">
									{dialogState.partnerId}
								</span>
							</div>
							<div className="flex items-center justify-between py-2 border-b border-white/5">
								<span className="text-xs text-slate-500 uppercase tracking-wider">User</span>
								<span className="text-sm text-slate-200">
									{dialogState.displayName || dialogState.userId}
								</span>
							</div>
							{dialogState.displayName && (
								<div className="flex items-center justify-between py-2 border-b border-white/5">
									<span className="text-xs text-slate-500 uppercase tracking-wider">Email</span>
									<span className="text-sm text-slate-200">
										{dialogState.userId}
									</span>
								</div>
							)}
							<div className="flex items-center justify-between py-2 border-b border-white/5">
								<span className="text-xs text-slate-500 uppercase tracking-wider">Session</span>
								<span className="text-sm text-emerald-400 flex items-center gap-1.5">
									<span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
									Active
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
								Sign Out
							</Button>
							<Button
								onClick={handleSwitchAccount}
								variant="ghost"
								className="text-slate-400 hover:text-slate-200 hover:bg-white/10"
							>
								<RefreshCw className="w-4 h-4 mr-2" />
								Switch Account
							</Button>
							<div className="flex-1" />
							<Button
								onClick={onClose}
								className="bg-white/10 hover:bg-white/20 text-slate-200"
							>
								Done
							</Button>
						</div>
					</div>
				)}
			</div>
		</>
	);
}
