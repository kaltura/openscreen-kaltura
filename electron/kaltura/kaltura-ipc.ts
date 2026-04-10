import { ipcMain } from "electron";
import {
	downloadFromKaltura,
	type DownloadProgress,
	getSessionInfo,
	getSessionState,
	listCategories,
	listPartners,
	loadSession,
	login,
	logout,
	openSignup,
	selectPartner,
	uploadToKaltura,
	type UploadOptions,
	type UploadProgress,
} from "./kaltura-service";

// Keep track of active upload progress listeners
const uploadProgressListeners = new Map<string, (progress: UploadProgress) => void>();

export function registerKalturaIpcHandlers() {
	// --- Auth ---
	ipcMain.handle("kaltura-login", async (_, params: { serviceUrl: string; loginId: string; password: string }) => {
		return login(params.serviceUrl, params.loginId, params.password);
	});

	ipcMain.handle("kaltura-select-partner", async (_, params: { partnerId: number }) => {
		return selectPartner(params.partnerId);
	});

	ipcMain.handle("kaltura-list-partners", async () => {
		return listPartners();
	});

	ipcMain.handle("kaltura-logout", async () => {
		return logout();
	});

	ipcMain.handle("kaltura-load-session", async () => {
		return loadSession();
	});

	ipcMain.handle("kaltura-get-session-state", () => {
		return getSessionState();
	});

	ipcMain.handle("kaltura-open-signup", () => {
		openSignup();
		return { success: true };
	});

	// --- Upload ---
	ipcMain.handle("kaltura-upload", async (event, options: UploadOptions) => {
		const uploadId = `upload-${Date.now()}`;

		const onProgress = (progress: UploadProgress) => {
			// Send progress to the renderer via the webContents
			try {
				event.sender.send("kaltura-upload-progress", { uploadId, ...progress });
			} catch {
				// sender may have been destroyed
			}
		};

		uploadProgressListeners.set(uploadId, onProgress);

		try {
			const result = await uploadToKaltura(options, onProgress);
			return { ...result, uploadId };
		} finally {
			uploadProgressListeners.delete(uploadId);
		}
	});

	// --- Categories ---
	ipcMain.handle("kaltura-list-categories", async () => {
		return listCategories();
	});

	// --- Session Info (for media manager embedding) ---
	ipcMain.handle("kaltura-get-session-info", () => {
		return getSessionInfo();
	});

	// --- Download ---
	ipcMain.handle("kaltura-download", async (event, params: { entryId: string }) => {
		const onProgress = (progress: DownloadProgress) => {
			try {
				event.sender.send("kaltura-download-progress", progress);
			} catch {
				// sender may have been destroyed
			}
		};
		return downloadFromKaltura(params.entryId, onProgress);
	});
}
