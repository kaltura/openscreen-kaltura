import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { app, safeStorage, shell } from "electron";

// kaltura-client is a CJS module — use createRequire to load it in ESM context
const require = createRequire(import.meta.url);
// biome-ignore lint: kaltura-client has no type declarations
const kaltura = require("kaltura-client");

// --- Constants ---

const KALTURA_SESSION_FILE = path.join(app.getPath("userData"), "kaltura-session.json");
const KS_EXPIRY_SECONDS = 2592000; // 30 days
const PASSWORD_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — needed for account switching
const SIGNUP_URL =
	"https://subscription.kaltura.com/get-started/kmc-free-trial-free?utm_source=trendemon&utm_medium=promotion&utm_campaign=an-2026-03-pathfactory&utm_content=popup-desktop";

// --- Interfaces ---

export interface KalturaStoredSession {
	serviceUrl: string;
	partnerId: number;
	ks: string;
	ksExpiry: number; // unix timestamp in seconds
	userId: string;
	displayName?: string;
}

export interface KalturaSessionState {
	connected: boolean;
	partnerId?: number;
	serviceUrl?: string;
	userId?: string;
	displayName?: string;
	ksExpiry?: number;
}

export interface KalturaPartner {
	id: number;
	name: string;
}

export interface LoginResult {
	success: boolean;
	error?: string;
	partners?: KalturaPartner[];
	state?: KalturaSessionState;
}

export interface SelectPartnerResult {
	success: boolean;
	error?: string;
	state?: KalturaSessionState;
}

// --- Module State ---

let currentKs: string | null = null;
let currentSession: KalturaStoredSession | null = null;

// Password cache (in-memory only, never persisted)
let cachedPassword: string | null = null;
let cachedLoginId: string | null = null;
let cachedServiceUrl: string | null = null;
let passwordCacheTimer: ReturnType<typeof setTimeout> | null = null;

function cachePassword(serviceUrl: string, loginId: string, password: string) {
	cachedServiceUrl = serviceUrl;
	cachedLoginId = loginId;
	cachedPassword = password;
	if (passwordCacheTimer) clearTimeout(passwordCacheTimer);
	passwordCacheTimer = setTimeout(clearPasswordCache, PASSWORD_CACHE_TTL_MS);
}

function clearPasswordCache() {
	cachedPassword = null;
	cachedLoginId = null;
	cachedServiceUrl = null;
	if (passwordCacheTimer) {
		clearTimeout(passwordCacheTimer);
		passwordCacheTimer = null;
	}
}

// --- Kaltura REST API (direct fetch, not kaltura-client) ---

async function loginByLoginId(
	serviceUrl: string,
	loginId: string,
	password: string,
	partnerId?: number,
): Promise<string> {
	const url = `${serviceUrl.replace(/\/+$/, "")}/api_v3/service/user/action/loginByLoginId`;
	const params = new URLSearchParams({
		format: "1",
		loginId,
		password,
		expiry: String(KS_EXPIRY_SECONDS),
	});
	if (partnerId) {
		params.set("partnerId", String(partnerId));
	}

	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: params.toString(),
	});

	const text = await response.text();

	// The API returns a plain string KS on success, or JSON error
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		// Plain string KS (success)
		if (text && !text.includes("KalturaAPIException")) {
			return text.replace(/^"|"$/g, "");
		}
		throw new Error("Unexpected response from Kaltura API");
	}

	if (parsed && typeof parsed === "object" && "objectType" in (parsed as Record<string, unknown>)) {
		const err = parsed as { objectType: string; message: string; code: string };
		if (err.objectType === "KalturaAPIException") {
			const friendlyMessages: Record<string, string> = {
				USER_NOT_FOUND: "User not found. Check your email address.",
				LOGIN_DATA_NOT_FOUND: "Invalid email or password.",
				USER_WRONG_PASSWORD: "Invalid email or password.",
				INVALID_PARTNER_ID: "Invalid account. Please try again.",
				LOGIN_BLOCKED: "Too many failed attempts. Please try again later.",
				PASSWORD_STRUCTURE_INVALID: "Invalid password format.",
			};
			throw new Error(friendlyMessages[err.code] || err.message || "Login failed");
		}
	}

	// If parsed is a string (JSON-encoded KS)
	if (typeof parsed === "string") {
		return parsed;
	}

	throw new Error("Unexpected response from Kaltura API");
}

async function loginByKs(
	serviceUrl: string,
	ks: string,
	partnerId: number,
): Promise<string> {
	const url = `${serviceUrl.replace(/\/+$/, "")}/api_v3/service/user/action/loginByKs`;
	const params = new URLSearchParams({
		format: "1",
		ks,
		requestedPartnerId: String(partnerId),
		expiry: String(KS_EXPIRY_SECONDS),
	});

	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: params.toString(),
	});

	const data = await response.json();

	if (data?.objectType === "KalturaAPIException") {
		throw new Error(data.message || "Failed to switch account");
	}

	// loginByKs returns { partnerId, ks } — extract the KS
	if (data?.ks && typeof data.ks === "string") {
		return data.ks;
	}

	throw new Error("Unexpected response from Kaltura API");
}

async function listPartnersForUser(
	serviceUrl: string,
	ks: string,
): Promise<KalturaPartner[]> {
	const url = `${serviceUrl.replace(/\/+$/, "")}/api_v3/service/partner/action/listPartnersForUser?format=1&clientTag=openscreen`;
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			ks,
			partnerFilter: {
				objectType: "KalturaPartnerFilter",
				statusEqual: 1,
			},
			pager: {
				objectType: "KalturaFilterPager",
				pageSize: 500,
			},
		}),
	});

	const data = await response.json();

	if (data?.objectType === "KalturaAPIException") {
		throw new Error(data.message || "Failed to list accounts");
	}

	return (data.objects || []).map((p: { id: number; name: string }) => ({
		id: p.id,
		name: p.name,
	}));
}

async function getUserInfo(
	serviceUrl: string,
	ks: string,
): Promise<{ id: string; fullName: string }> {
	const url = `${serviceUrl.replace(/\/+$/, "")}/api_v3/service/user/action/get`;
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ format: "1", ks }).toString(),
	});

	const data = await response.json();

	if (data?.objectType === "KalturaAPIException") {
		throw new Error(data.message || "Failed to get user info");
	}

	return {
		id: data.id || data.email || "",
		fullName: data.fullName || data.firstName || "",
	};
}

// --- Session Persistence ---

async function saveSession(session: KalturaStoredSession): Promise<void> {
	const encrypted = safeStorage.isEncryptionAvailable()
		? safeStorage.encryptString(session.ks).toString("base64")
		: session.ks;

	const stored = {
		serviceUrl: session.serviceUrl,
		partnerId: session.partnerId,
		ks: encrypted,
		ksExpiry: session.ksExpiry,
		userId: session.userId,
		displayName: session.displayName,
		encrypted: safeStorage.isEncryptionAvailable(),
	};

	await fs.writeFile(KALTURA_SESSION_FILE, JSON.stringify(stored, null, 2), "utf-8");
}

export async function loadSession(): Promise<{ success: boolean; state?: KalturaSessionState }> {
	try {
		// Clean up old config file from app-token auth
		const oldConfigFile = path.join(app.getPath("userData"), "kaltura-config.json");
		try {
			await fs.unlink(oldConfigFile);
		} catch {
			// doesn't exist, fine
		}

		const content = await fs.readFile(KALTURA_SESSION_FILE, "utf-8");
		const stored = JSON.parse(content);

		const ks = stored.encrypted
			? safeStorage.decryptString(Buffer.from(stored.ks, "base64"))
			: stored.ks;

		const session: KalturaStoredSession = {
			serviceUrl: stored.serviceUrl,
			partnerId: stored.partnerId,
			ks,
			ksExpiry: stored.ksExpiry,
			userId: stored.userId,
			displayName: stored.displayName,
		};

		// Check if session is still valid
		if (Date.now() / 1000 >= session.ksExpiry) {
			// Expired, clear it
			await clearSession();
			return { success: false };
		}

		currentSession = session;
		currentKs = session.ks;

		return { success: true, state: getSessionState() };
	} catch {
		return { success: false };
	}
}

async function clearSession(): Promise<void> {
	try {
		await fs.unlink(KALTURA_SESSION_FILE);
	} catch {
		// file may not exist
	}
	currentSession = null;
	currentKs = null;
}

// --- Public API ---

export function getSessionState(): KalturaSessionState {
	if (!currentSession || !currentKs) {
		return { connected: false };
	}
	return {
		connected: Date.now() / 1000 < currentSession.ksExpiry,
		partnerId: currentSession.partnerId,
		serviceUrl: currentSession.serviceUrl,
		userId: currentSession.userId,
		displayName: currentSession.displayName,
		ksExpiry: currentSession.ksExpiry,
	};
}

export async function login(
	serviceUrl: string,
	loginId: string,
	password: string,
): Promise<LoginResult> {
	try {
		// Step 1: Login without partnerId to get a multi-partner KS
		const ks = await loginByLoginId(serviceUrl, loginId, password);

		// Cache password for partner switching
		cachePassword(serviceUrl, loginId, password);

		// Step 2: List available partners
		const partners = await listPartnersForUser(serviceUrl, ks);

		if (partners.length === 0) {
			clearPasswordCache();
			return { success: false, error: "No accounts found for this user." };
		}

		if (partners.length === 1) {
			// Single partner: auto-select and complete login
			const result = await completeLogin(serviceUrl, loginId, password, partners[0].id);
			return result;
		}

		// Multiple partners: return list for user to choose
		return { success: true, partners };
	} catch (error) {
		clearPasswordCache();
		console.error("Kaltura login failed:", error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function listPartners(): Promise<{ success: boolean; partners?: KalturaPartner[]; error?: string }> {
	try {
		// Use the current session's KS to list partners — no password needed
		if (currentSession?.ks && currentSession.serviceUrl) {
			const partners = await listPartnersForUser(currentSession.serviceUrl, currentSession.ks);
			return { success: true, partners };
		}
		// Fallback: try cached credentials
		if (cachedPassword && cachedLoginId && cachedServiceUrl) {
			const ks = await loginByLoginId(cachedServiceUrl, cachedLoginId, cachedPassword);
			const partners = await listPartnersForUser(cachedServiceUrl, ks);
			return { success: true, partners };
		}
		return { success: false, error: "No active session. Please sign in again." };
	} catch (error) {
		console.error("Kaltura list partners failed:", error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function selectPartner(partnerId: number): Promise<SelectPartnerResult> {
	try {
		const svcUrl = cachedServiceUrl || currentSession?.serviceUrl;
		const loginId = cachedLoginId || currentSession?.userId;

		// Prefer password-based login if available
		if (cachedPassword && loginId && svcUrl) {
			return await completeLogin(svcUrl, loginId, cachedPassword, partnerId);
		}

		// Fall back to KS-based partner switch (no password needed)
		if (currentSession?.ks && currentSession.serviceUrl) {
			const newKs = await loginByKs(currentSession.serviceUrl, currentSession.ks, partnerId);
			const userId = loginId || currentSession.userId;

			let displayName: string | undefined;
			try {
				const userInfo = await getUserInfo(currentSession.serviceUrl, newKs);
				displayName = userInfo.fullName || undefined;
			} catch {
				// Non-critical
			}

			const session: KalturaStoredSession = {
				serviceUrl: currentSession.serviceUrl,
				partnerId,
				ks: newKs,
				ksExpiry: Math.floor(Date.now() / 1000) + KS_EXPIRY_SECONDS,
				userId: userId,
				displayName,
			};

			currentSession = session;
			currentKs = newKs;
			await saveSession(session);

			return { success: true, state: getSessionState() };
		}

		return { success: false, error: "Session expired. Please sign in again." };
	} catch (error) {
		console.error("Kaltura partner selection failed:", error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

async function completeLogin(
	serviceUrl: string,
	loginId: string,
	password: string,
	partnerId: number,
): Promise<LoginResult> {
	// Login with specific partner
	const ks = await loginByLoginId(serviceUrl, loginId, password, partnerId);

	// Get user display name
	let displayName: string | undefined;
	try {
		const userInfo = await getUserInfo(serviceUrl, ks);
		displayName = userInfo.fullName || undefined;
	} catch {
		// Non-critical, continue without display name
	}

	// Build and save session
	const session: KalturaStoredSession = {
		serviceUrl,
		partnerId,
		ks,
		ksExpiry: Math.floor(Date.now() / 1000) + KS_EXPIRY_SECONDS,
		userId: loginId,
		displayName,
	};

	currentSession = session;
	currentKs = ks;
	await saveSession(session);

	return { success: true, state: getSessionState() };
}

export async function logout(): Promise<{ success: boolean }> {
	await clearSession();
	clearPasswordCache();
	return { success: true };
}

export function openSignup(): void {
	shell.openExternal(SIGNUP_URL);
}

// --- Kaltura Client for Upload/Categories ---

function createKalturaClientInstance(serviceUrl: string) {
	const clientConfig = new kaltura.Configuration();
	clientConfig.serviceUrl = serviceUrl;
	return new kaltura.Client(clientConfig);
}

async function getAuthenticatedClient() {
	if (!currentSession || !currentKs) {
		throw new Error("Not signed in. Please sign in to your Kaltura account.");
	}

	// Check if KS is expired
	if (Date.now() / 1000 >= currentSession.ksExpiry) {
		// Try silent re-login if password is cached
		if (cachedPassword && cachedLoginId && cachedServiceUrl) {
			const result = await completeLogin(
				cachedServiceUrl,
				cachedLoginId,
				cachedPassword,
				currentSession.partnerId,
			);
			if (!result.success) {
				throw new Error("Session expired. Please sign in again.");
			}
		} else {
			await clearSession();
			throw new Error("Session expired. Please sign in again.");
		}
	}

	const client = createKalturaClientInstance(currentSession.serviceUrl);
	client.setKs(currentKs!);
	return client;
}

// Helper to promisify kaltura service calls
function execKaltura<T>(serviceAction: unknown, client: unknown): Promise<T> {
	return new Promise((resolve, reject) => {
		(serviceAction as { execute: (client: unknown, cb: (ok: boolean, res: unknown) => void) => void })
			.execute(client, (success: boolean, results: unknown) => {
				if (success && results) {
					resolve(results as T);
				} else {
					reject(new Error(`Kaltura API call failed: ${JSON.stringify(results)}`));
				}
			});
	});
}

// --- Upload ---

export interface UploadOptions {
	filePath: string;
	name: string;
	description?: string;
	tags?: string;
	categoryIds?: string;
}

export interface UploadProgress {
	phase: "uploading" | "processing" | "complete" | "error";
	percentage: number;
	entryId?: string;
	error?: string;
}

type ProgressCallback = (progress: UploadProgress) => void;

export async function uploadToKaltura(
	options: UploadOptions,
	onProgress?: ProgressCallback,
): Promise<{
	success: boolean;
	entryId?: string;
	error?: string;
}> {
	try {
		const client = await getAuthenticatedClient();

		onProgress?.({ phase: "uploading", percentage: 0 });

		// 1. Create upload token
		const uploadToken = new kaltura.objects.UploadToken();
		const createdToken = await execKaltura<{ id: string }>(
			kaltura.services.uploadToken.add(uploadToken),
			client,
		);

		if (!createdToken?.id) {
			throw new Error("Failed to create upload token");
		}

		onProgress?.({ phase: "uploading", percentage: 10 });

		// 2. Upload file (kaltura-client handles the file path directly)
		const fileStats = await fs.stat(options.filePath);
		const fileSize = fileStats.size;
		const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

		if (fileSize <= CHUNK_SIZE) {
			// Single upload for small files
			await execKaltura(
				kaltura.services.uploadToken.upload(
					createdToken.id,
					options.filePath,
					false, // resume
					true, // finalChunk
					-1, // resumeAt
				),
				client,
			);
			onProgress?.({ phase: "uploading", percentage: 80 });
		} else {
			// Chunked upload for large files
			const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
			const fileBuffer = await fs.readFile(options.filePath);

			for (let i = 0; i < totalChunks; i++) {
				const start = i * CHUNK_SIZE;
				const end = Math.min(start + CHUNK_SIZE, fileSize);
				const chunk = fileBuffer.subarray(start, end);
				const isFinal = i === totalChunks - 1;

				// Write chunk to temp file
				const tempChunkPath = path.join(
					app.getPath("temp"),
					`kaltura-chunk-${createdToken.id}-${i}`,
				);
				await fs.writeFile(tempChunkPath, chunk);

				try {
					await execKaltura(
						kaltura.services.uploadToken.upload(
							createdToken.id,
							tempChunkPath,
							i > 0, // resume
							isFinal, // finalChunk
							start, // resumeAt
						),
						client,
					);
				} finally {
					await fs.unlink(tempChunkPath).catch(() => {});
				}

				const uploadPct = 10 + Math.round(((i + 1) / totalChunks) * 70);
				onProgress?.({ phase: "uploading", percentage: uploadPct });
			}
		}

		onProgress?.({ phase: "processing", percentage: 85 });

		// 3. Create media entry
		const mediaEntry = new kaltura.objects.MediaEntry();
		mediaEntry.name = options.name;
		mediaEntry.mediaType = kaltura.enums.MediaType.VIDEO;
		if (options.description) mediaEntry.description = options.description;
		if (options.tags) mediaEntry.tags = options.tags;

		const createdEntry = await execKaltura<{ id: string }>(
			kaltura.services.media.add(mediaEntry),
			client,
		);

		if (!createdEntry?.id) {
			throw new Error("Failed to create media entry");
		}

		onProgress?.({ phase: "processing", percentage: 90 });

		// 4. Associate uploaded file with entry
		const resource = new kaltura.objects.UploadedFileTokenResource();
		resource.token = createdToken.id;

		await execKaltura(
			kaltura.services.media.addContent(createdEntry.id, resource),
			client,
		);

		onProgress?.({ phase: "processing", percentage: 95 });

		// 5. Add to categories if specified
		if (options.categoryIds) {
			const categoryIds = options.categoryIds.split(",").map((id) => id.trim());
			for (const categoryId of categoryIds) {
				try {
					const categoryEntry = new kaltura.objects.CategoryEntry();
					categoryEntry.categoryId = Number.parseInt(categoryId, 10);
					categoryEntry.entryId = createdEntry.id;
					await execKaltura(
						kaltura.services.categoryEntry.add(categoryEntry),
						client,
					);
				} catch (catError) {
					console.warn(`Failed to add entry to category ${categoryId}:`, catError);
				}
			}
		}

		onProgress?.({
			phase: "complete",
			percentage: 100,
			entryId: createdEntry.id,
		});

		return { success: true, entryId: createdEntry.id };
	} catch (error) {
		console.error("Kaltura upload failed:", error);
		const errorMsg = String(error);
		onProgress?.({ phase: "error", percentage: 0, error: errorMsg });
		return { success: false, error: errorMsg };
	}
}

// --- Session Info (for renderer to embed media manager) ---

export function getSessionInfo(): {
	success: boolean;
	ks?: string;
	partnerId?: number;
	serviceUrl?: string;
} {
	if (!currentSession || !currentKs) {
		return { success: false };
	}
	if (Date.now() / 1000 >= currentSession.ksExpiry) {
		return { success: false };
	}
	return {
		success: true,
		ks: currentKs,
		partnerId: currentSession.partnerId,
		serviceUrl: currentSession.serviceUrl,
	};
}

// --- Download from Kaltura ---

export interface DownloadProgress {
	phase: "downloading" | "complete" | "error";
	percentage: number;
	filePath?: string;
	error?: string;
}

type DownloadProgressCallback = (progress: DownloadProgress) => void;

export async function downloadFromKaltura(
	entryId: string,
	onProgress?: DownloadProgressCallback,
): Promise<{ success: boolean; filePath?: string; error?: string }> {
	if (!currentSession || !currentKs) {
		return { success: false, error: "Not signed in." };
	}

	// Validate entryId format to prevent path traversal
	if (!/^[0-9]_[a-zA-Z0-9]+$/.test(entryId)) {
		return { success: false, error: "Invalid entry ID format." };
	}

	const { serviceUrl, partnerId } = currentSession;
	const ks = currentKs;

	// Build playManifest download URL
	const downloadUrl =
		`${serviceUrl}/p/${partnerId}/sp/${partnerId}00/playManifest/entryId/${entryId}/format/download/protocol/https?ks=${ks}`;

	const recordingsDir = path.join(app.getPath("userData"), "recordings");

	// Ensure recordings directory exists
	const { mkdirSync } = await import("node:fs");
	mkdirSync(recordingsDir, { recursive: true });

	const destPath = path.join(recordingsDir, `kaltura-${entryId}-${Date.now()}.mp4`);

	// Validate resolved path stays within recordings dir
	const resolvedDest = path.resolve(destPath);
	const resolvedDir = path.resolve(recordingsDir);
	if (!resolvedDest.startsWith(resolvedDir + path.sep)) {
		return { success: false, error: "Invalid download path." };
	}

	onProgress?.({ phase: "downloading", percentage: 0 });

	try {
		const response = await fetch(downloadUrl, { redirect: "follow" });

		if (!response.ok) {
			throw new Error(`Download failed: HTTP ${response.status}`);
		}

		const contentLength = Number(response.headers.get("content-length") || 0);
		const body = response.body;

		if (!body) {
			throw new Error("No response body");
		}

		const { createWriteStream } = await import("node:fs");
		const fileStream = createWriteStream(destPath);
		let downloaded = 0;

		const reader = body.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				fileStream.write(Buffer.from(value));
				downloaded += value.byteLength;

				if (contentLength > 0) {
					const pct = Math.round((downloaded / contentLength) * 100);
					onProgress?.({ phase: "downloading", percentage: pct });
				}
			}
		} finally {
			fileStream.end();
			await new Promise<void>((resolve, reject) => {
				fileStream.on("finish", resolve);
				fileStream.on("error", reject);
			});
		}

		onProgress?.({ phase: "complete", percentage: 100, filePath: destPath });
		return { success: true, filePath: destPath };
	} catch (error) {
		// Clean up partial file
		try {
			await fs.unlink(destPath);
		} catch {
			// may not exist
		}
		const errorMsg = error instanceof Error ? error.message : String(error);
		onProgress?.({ phase: "error", percentage: 0, error: errorMsg });
		return { success: false, error: errorMsg };
	}
}

// --- Categories ---

export async function listCategories(): Promise<{
	success: boolean;
	categories?: Array<{ id: number; name: string; fullName: string }>;
	error?: string;
}> {
	try {
		const client = await getAuthenticatedClient();

		const filter = new kaltura.objects.CategoryFilter();
		const pager = new kaltura.objects.FilterPager();
		pager.pageSize = 500;

		const result = await execKaltura<{
			objects: Array<{ id: number; name: string; fullName: string }>;
		}>(kaltura.services.category.listAction(filter, pager), client);

		const categories = (result.objects || []).map((cat) => ({
			id: cat.id,
			name: cat.name,
			fullName: cat.fullName,
		}));

		return { success: true, categories };
	} catch (error) {
		console.error("Failed to list categories:", error);
		return { success: false, error: String(error) };
	}
}
