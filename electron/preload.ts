import { contextBridge, ipcRenderer } from "electron";
import type { RecordingSession, StoreRecordedSessionInput } from "../src/lib/recordingSession";

contextBridge.exposeInMainWorld("electronAPI", {
	hudOverlayHide: () => {
		ipcRenderer.send("hud-overlay-hide");
	},
	hudOverlayClose: () => {
		ipcRenderer.send("hud-overlay-close");
	},
	getAssetBasePath: async () => {
		// ask main process for the correct base path (production vs dev)
		return await ipcRenderer.invoke("get-asset-base-path");
	},
	getSources: async (opts: Electron.SourcesOptions) => {
		return await ipcRenderer.invoke("get-sources", opts);
	},
	switchToEditor: () => {
		return ipcRenderer.invoke("switch-to-editor");
	},
	switchToHud: () => {
		return ipcRenderer.invoke("switch-to-hud");
	},
	startNewRecording: () => {
		return ipcRenderer.invoke("start-new-recording");
	},
	openSourceSelector: () => {
		return ipcRenderer.invoke("open-source-selector");
	},
	selectSource: (source: ProcessedDesktopSource) => {
		return ipcRenderer.invoke("select-source", source);
	},
	getSelectedSource: () => {
		return ipcRenderer.invoke("get-selected-source");
	},
	requestCameraAccess: () => {
		return ipcRenderer.invoke("request-camera-access");
	},

	storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => {
		return ipcRenderer.invoke("store-recorded-video", videoData, fileName);
	},
	storeRecordedSession: (payload: StoreRecordedSessionInput) => {
		return ipcRenderer.invoke("store-recorded-session", payload);
	},

	getRecordedVideoPath: () => {
		return ipcRenderer.invoke("get-recorded-video-path");
	},
	setRecordingState: (recording: boolean) => {
		return ipcRenderer.invoke("set-recording-state", recording);
	},
	getCursorTelemetry: (videoPath?: string) => {
		return ipcRenderer.invoke("get-cursor-telemetry", videoPath);
	},
	onStopRecordingFromTray: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("stop-recording-from-tray", listener);
		return () => ipcRenderer.removeListener("stop-recording-from-tray", listener);
	},
	openExternalUrl: (url: string) => {
		return ipcRenderer.invoke("open-external-url", url);
	},
	saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => {
		return ipcRenderer.invoke("save-exported-video", videoData, fileName);
	},
	openVideoFilePicker: () => {
		return ipcRenderer.invoke("open-video-file-picker");
	},
	setCurrentVideoPath: (path: string) => {
		return ipcRenderer.invoke("set-current-video-path", path);
	},
	setCurrentRecordingSession: (session: RecordingSession | null) => {
		return ipcRenderer.invoke("set-current-recording-session", session);
	},
	getCurrentVideoPath: () => {
		return ipcRenderer.invoke("get-current-video-path");
	},
	getCurrentRecordingSession: () => {
		return ipcRenderer.invoke("get-current-recording-session");
	},
	readBinaryFile: (filePath: string) => {
		return ipcRenderer.invoke("read-binary-file", filePath);
	},
	clearCurrentVideoPath: () => {
		return ipcRenderer.invoke("clear-current-video-path");
	},
	saveProjectFile: (projectData: unknown, suggestedName?: string, existingProjectPath?: string) => {
		return ipcRenderer.invoke("save-project-file", projectData, suggestedName, existingProjectPath);
	},
	loadProjectFile: () => {
		return ipcRenderer.invoke("load-project-file");
	},
	loadCurrentProjectFile: () => {
		return ipcRenderer.invoke("load-current-project-file");
	},
	onMenuLoadProject: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("menu-load-project", listener);
		return () => ipcRenderer.removeListener("menu-load-project", listener);
	},
	onMenuSaveProject: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("menu-save-project", listener);
		return () => ipcRenderer.removeListener("menu-save-project", listener);
	},
	onMenuSaveProjectAs: (callback: () => void) => {
		const listener = () => callback();
		ipcRenderer.on("menu-save-project-as", listener);
		return () => ipcRenderer.removeListener("menu-save-project-as", listener);
	},
	getPlatform: () => {
		return ipcRenderer.invoke("get-platform");
	},
	revealInFolder: (filePath: string) => {
		return ipcRenderer.invoke("reveal-in-folder", filePath);
	},
	getShortcuts: () => {
		return ipcRenderer.invoke("get-shortcuts");
	},
	saveShortcuts: (shortcuts: unknown) => {
		return ipcRenderer.invoke("save-shortcuts", shortcuts);
	},
	setLocale: (locale: string) => {
		return ipcRenderer.invoke("set-locale", locale);
	},
	setMicrophoneExpanded: (expanded: boolean) => {
		ipcRenderer.send("hud:setMicrophoneExpanded", expanded);
	},
	setHasUnsavedChanges: (hasChanges: boolean) => {
		ipcRenderer.send("set-has-unsaved-changes", hasChanges);
	},

	// --- Kaltura Integration ---
	kalturaLogin: (params: { serviceUrl: string; loginId: string; password: string }) => {
		return ipcRenderer.invoke("kaltura-login", params);
	},
	kalturaSelectPartner: (params: { partnerId: number }) => {
		return ipcRenderer.invoke("kaltura-select-partner", params);
	},
	kalturaListPartners: () => {
		return ipcRenderer.invoke("kaltura-list-partners");
	},
	kalturaLogout: () => {
		return ipcRenderer.invoke("kaltura-logout");
	},
	kalturaLoadSession: () => {
		return ipcRenderer.invoke("kaltura-load-session");
	},
	kalturaGetSessionState: () => {
		return ipcRenderer.invoke("kaltura-get-session-state");
	},
	kalturaOpenSignup: () => {
		return ipcRenderer.invoke("kaltura-open-signup");
	},
	kalturaUpload: (options: {
		filePath: string;
		name: string;
		description?: string;
		tags?: string;
		categoryIds?: string;
	}) => {
		return ipcRenderer.invoke("kaltura-upload", options);
	},
	kalturaListCategories: () => {
		return ipcRenderer.invoke("kaltura-list-categories");
	},
	onKalturaUploadProgress: (callback: (progress: unknown) => void) => {
		const listener = (_: unknown, progress: unknown) => callback(progress);
		ipcRenderer.on("kaltura-upload-progress", listener);
		return () => ipcRenderer.removeListener("kaltura-upload-progress", listener);
	},
	kalturaGetSessionInfo: () => {
		return ipcRenderer.invoke("kaltura-get-session-info");
	},
	kalturaDownload: (params: { entryId: string }) => {
		return ipcRenderer.invoke("kaltura-download", params);
	},
	onKalturaDownloadProgress: (callback: (progress: unknown) => void) => {
		const listener = (_: unknown, progress: unknown) => callback(progress);
		ipcRenderer.on("kaltura-download-progress", listener);
		return () => ipcRenderer.removeListener("kaltura-download-progress", listener);
	},
	openKalturaBrowse: () => {
		return ipcRenderer.invoke("open-kaltura-browse");
	},
	closeKalturaBrowse: () => {
		return ipcRenderer.invoke("close-kaltura-browse");
	},
	kalturaBrowseVideoLoaded: (filePath: string) => {
		return ipcRenderer.invoke("kaltura-browse-video-loaded", filePath);
	},
	onKalturaVideoLoaded: (callback: (filePath: string) => void) => {
		const listener = (_: unknown, filePath: string) => callback(filePath);
		ipcRenderer.on("kaltura-video-loaded", listener);
		return () => ipcRenderer.removeListener("kaltura-video-loaded", listener);
	},

	onRequestSaveBeforeClose: (callback: () => Promise<boolean> | boolean) => {
		const listener = async () => {
			try {
				const shouldClose = await callback();
				ipcRenderer.send("save-before-close-done", shouldClose);
			} catch {
				ipcRenderer.send("save-before-close-done", false);
			}
		};
		ipcRenderer.on("request-save-before-close", listener);
		return () => ipcRenderer.removeListener("request-save-before-close", listener);
	},
});
