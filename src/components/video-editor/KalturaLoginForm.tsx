import { AlertCircle, ArrowLeft, Check, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useScopedT } from "@/contexts/I18nContext";

interface KalturaPartner {
	id: number;
	name: string;
}

interface KalturaLoginFormProps {
	/** Called when login succeeds. Receives the API result for the caller to handle. */
	onLoginSuccess: (result: {
		partners?: KalturaPartner[];
		state?: {
			connected: boolean;
			partnerId?: number;
			serviceUrl?: string;
			userId?: string;
			displayName?: string;
			ksExpiry?: number;
		};
	}) => void;
	/** Called when partner selection succeeds. */
	onPartnerSelected: (result: {
		state?: {
			connected: boolean;
			partnerId?: number;
			serviceUrl?: string;
			userId?: string;
			displayName?: string;
			ksExpiry?: number;
		};
	}) => void;
	/** Called when an error occurs during login or partner selection. */
	onError: (error: string) => void;
	/** Error message to display, if any. */
	error?: string;
	/** Partner list — when provided, shows account selection instead of login form. */
	partners?: KalturaPartner[];
	/** Called to go back from account selection to login form. */
	onBack?: () => void;
}

export function KalturaLoginForm({
	onLoginSuccess,
	onPartnerSelected,
	onError,
	error,
	partners,
	onBack,
}: KalturaLoginFormProps) {
	const t = useScopedT("kaltura");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [clickedSignup, setClickedSignup] = useState(false);
	const [loggingIn, setLoggingIn] = useState(false);
	const [selectingPartner, setSelectingPartner] = useState(false);
	const emailInputRef = useRef<HTMLInputElement>(null);

	const handleLogin = useCallback(async () => {
		if (!email.trim() || !password.trim()) return;

		setLoggingIn(true);

		try {
			const result = await window.electronAPI.kalturaLogin({
				serviceUrl: "https://www.kaltura.com",
				loginId: email.trim(),
				password: password.trim(),
			});

			setPassword("");
			setLoggingIn(false);

			if (!result.success) {
				onError(result.error || t("login.loginFailed"));
				return;
			}

			onLoginSuccess(result);
		} catch (err) {
			setPassword("");
			setLoggingIn(false);
			onError(String(err));
		}
	}, [email, password, t, onLoginSuccess, onError]);

	const handleSelectPartner = useCallback(
		async (partnerId: number) => {
			setSelectingPartner(true);

			try {
				const result = await window.electronAPI.kalturaSelectPartner({ partnerId });

				setSelectingPartner(false);

				if (!result.success) {
					onError(result.error || t("login.failedSelectAccount"));
					return;
				}

				setPassword("");
				onPartnerSelected(result);
			} catch (err) {
				setSelectingPartner(false);
				onError(String(err));
			}
		},
		[t, onPartnerSelected, onError],
	);

	const handleSignup = useCallback(async () => {
		await window.electronAPI.kalturaOpenSignup();
		setClickedSignup(true);
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && !loggingIn) {
				handleLogin();
			}
		},
		[loggingIn, handleLogin],
	);

	// Auto-focus email input when user returns from signup
	useEffect(() => {
		if (!clickedSignup) return;
		const onFocus = () => {
			setTimeout(() => emailInputRef.current?.focus(), 100);
		};
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [clickedSignup]);

	if (loggingIn || selectingPartner) {
		return (
			<div className="flex items-center justify-center py-8">
				<Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
				<span className="ml-3 text-sm text-slate-400">
					{loggingIn ? t("connection.signingIn") : t("connection.connecting")}
				</span>
			</div>
		);
	}

	if (partners && partners.length > 0) {
		return (
			<div className="space-y-3">
				{onBack && (
					<button
						type="button"
						onClick={onBack}
						className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-2"
					>
						<ArrowLeft className="w-4 h-4" />
						{t("connection.backToLogin")}
					</button>
				)}
				<div className="space-y-2 max-h-64 overflow-y-auto">
					{partners.map((partner) => (
						<button
							key={partner.id}
							type="button"
							onClick={() => handleSelectPartner(partner.id)}
							className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-orange-500/30 transition-all flex items-center justify-between group"
						>
							<div>
								<span className="text-sm font-medium text-slate-200 block">{partner.name}</span>
								<span className="text-xs text-slate-500">
									{t("connection.partnerId", { id: partner.id })}
								</span>
							</div>
							<ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-orange-400 rotate-180 transition-colors" />
						</button>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4" onKeyDown={handleKeyDown}>
			{/* Post-signup welcome banner */}
			{clickedSignup && (
				<div className="animate-in fade-in slide-in-from-top-2 duration-300">
					<div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
						<Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
						<p className="text-sm text-emerald-300 leading-relaxed">{t("login.signupSuccess")}</p>
					</div>
				</div>
			)}

			{/* Error message */}
			{error && (
				<div className="animate-in slide-in-from-top-2">
					<div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
						<AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
						<p className="text-sm text-red-400 leading-relaxed">{error}</p>
					</div>
				</div>
			)}

			<div>
				<label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
					{t("login.email")}
				</label>
				<Input
					ref={emailInputRef}
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					disabled={loggingIn}
					placeholder={t("login.emailPlaceholder")}
					autoComplete="email"
					className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 disabled:opacity-50"
				/>
			</div>

			<div>
				<label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
					{t("login.password")}
				</label>
				<Input
					type="password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					disabled={loggingIn}
					placeholder={t("login.passwordPlaceholder")}
					autoComplete="current-password"
					className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 disabled:opacity-50"
				/>
			</div>

			<div className="flex items-center justify-between pt-2">
				{clickedSignup ? (
					<span className="text-xs text-slate-500">{t("login.signupVerify")}</span>
				) : (
					<button
						type="button"
						onClick={handleSignup}
						className="text-xs text-slate-400 hover:text-orange-400 transition-colors flex items-center gap-1"
					>
						{t("login.signupPrompt")}
						<ExternalLink className="w-3 h-3" />
					</button>
				)}
				<Button
					onClick={handleLogin}
					disabled={!email.trim() || !password.trim() || loggingIn}
					className="bg-orange-500 hover:bg-orange-600 text-white"
				>
					{loggingIn ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
					{t("connection.signIn")}
				</Button>
			</div>
		</div>
	);
}
