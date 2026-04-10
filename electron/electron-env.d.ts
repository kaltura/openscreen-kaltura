/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
	interface ProcessEnv {
		/**
		 * The built directory structure
		 *
		 * ```tree
		 * ├─┬─┬ dist
		 * │ │ └── index.html
		 * │ │
		 * │ ├─┬ dist-electron
		 * │ │ ├── main.js
		 * │ │ └── preload.js
		 * │
		 * ```
		 */
		APP_ROOT: string;
		/** /dist/ or /public/ */
		VITE_PUBLIC: string;
	}
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
	electronAPI: {
		getSources: (opts: Electron.SourcesOptions) => Promise<ProcessedDesktopSource[]>;
		switchToEditor: () => Promise<void>;
		switchToHud: () => Promise<void>;
		startNewRecording: () => Promise<{ success: boolean; error?: string }>;
		openSourceSelector: () => Promise<void>;
		selectSource: (source: ProcessedDesktopSource) => Promise<ProcessedDesktopSource | null>;
		getSelectedSource: () => Promise<ProcessedDesktopSource | null>;
		requestCameraAccess: () => Promise<{
			success: boolean;
			granted: boolean;
			status: string;
			error?: string;
		}>;
		getAssetBasePath: () => Promise<string | null>;
		storeRecordedVideo: (
			videoData: ArrayBuffer,
			fileName: string,
		) => Promise<{
			success: boolean;
			path?: string;
			session?: import("../src/lib/recordingSession").RecordingSession;
			message?: string;
			error?: string;
		}>;
		storeRecordedSession: (
			payload: import("../src/lib/recordingSession").StoreRecordedSessionInput,
		) => Promise<{
			success: boolean;
			path?: string;
			session?: import("../src/lib/recordingSession").RecordingSession;
			message?: string;
			error?: string;
		}>;
		getRecordedVideoPath: () => Promise<{
			success: boolean;
			path?: string;
			message?: string;
			error?: string;
		}>;
		setRecordingState: (recording: boolean) => Promise<void>;
		getCursorTelemetry: (videoPath?: string) => Promise<{
			success: boolean;
			samples: CursorTelemetryPoint[];
			message?: string;
			error?: string;
		}>;
		onStopRecordingFromTray: (callback: () => void) => () => void;
		openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
		saveExportedVideo: (
			videoData: ArrayBuffer,
			fileName: string,
		) => Promise<{ success: boolean; path?: string; message?: string; canceled?: boolean }>;
		openVideoFilePicker: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>;
		setCurrentVideoPath: (path: string) => Promise<{ success: boolean }>;
		setCurrentRecordingSession: (
			session: import("../src/lib/recordingSession").RecordingSession | null,
		) => Promise<{
			success: boolean;
			session?: import("../src/lib/recordingSession").RecordingSession;
		}>;
		getCurrentVideoPath: () => Promise<{ success: boolean; path?: string }>;
		getCurrentRecordingSession: () => Promise<{
			success: boolean;
			session?: import("../src/lib/recordingSession").RecordingSession;
		}>;
		readBinaryFile: (filePath: string) => Promise<{
			success: boolean;
			data?: ArrayBuffer;
			path?: string;
			message?: string;
			error?: string;
		}>;
		clearCurrentVideoPath: () => Promise<{ success: boolean }>;
		saveProjectFile: (
			projectData: unknown,
			suggestedName?: string,
			existingProjectPath?: string,
		) => Promise<{
			success: boolean;
			path?: string;
			message?: string;
			canceled?: boolean;
			error?: string;
		}>;
		loadProjectFile: () => Promise<{
			success: boolean;
			path?: string;
			project?: unknown;
			message?: string;
			canceled?: boolean;
			error?: string;
		}>;
		loadCurrentProjectFile: () => Promise<{
			success: boolean;
			path?: string;
			project?: unknown;
			message?: string;
			canceled?: boolean;
			error?: string;
		}>;
		onMenuLoadProject: (callback: () => void) => () => void;
		onMenuSaveProject: (callback: () => void) => () => void;
		onMenuSaveProjectAs: (callback: () => void) => () => void;
		getPlatform: () => Promise<string>;
		revealInFolder: (
			filePath: string,
		) => Promise<{ success: boolean; error?: string; message?: string }>;
		getShortcuts: () => Promise<Record<string, unknown> | null>;
		saveShortcuts: (shortcuts: unknown) => Promise<{ success: boolean; error?: string }>;
		hudOverlayHide: () => void;
		hudOverlayClose: () => void;
		setMicrophoneExpanded: (expanded: boolean) => void;
		setHasUnsavedChanges: (hasChanges: boolean) => void;
		onRequestSaveBeforeClose: (callback: () => Promise<boolean> | boolean) => () => void;
		setLocale: (locale: string) => Promise<void>;

		// --- Kaltura Integration ---
		kalturaLogin: (params: { serviceUrl: string; loginId: string; password: string }) => Promise<{
			success: boolean;
			error?: string;
			partners?: Array<{ id: number; name: string }>;
			state?: {
				connected: boolean;
				partnerId?: number;
				serviceUrl?: string;
				userId?: string;
				displayName?: string;
				ksExpiry?: number;
			};
		}>;
		kalturaSelectPartner: (params: { partnerId: number }) => Promise<{
			success: boolean;
			error?: string;
			state?: {
				connected: boolean;
				partnerId?: number;
				serviceUrl?: string;
				userId?: string;
				displayName?: string;
				ksExpiry?: number;
			};
		}>;
		kalturaListPartners: () => Promise<{
			success: boolean;
			partners?: Array<{ id: number; name: string }>;
			error?: string;
		}>;
		kalturaLogout: () => Promise<{ success: boolean }>;
		kalturaLoadSession: () => Promise<{
			success: boolean;
			state?: {
				connected: boolean;
				partnerId?: number;
				serviceUrl?: string;
				userId?: string;
				displayName?: string;
				ksExpiry?: number;
			};
		}>;
		kalturaGetSessionState: () => Promise<{
			connected: boolean;
			partnerId?: number;
			serviceUrl?: string;
			userId?: string;
			displayName?: string;
			ksExpiry?: number;
		}>;
		kalturaOpenSignup: () => Promise<{ success: boolean }>;
		kalturaUpload: (options: {
			filePath: string;
			name: string;
			description?: string;
			tags?: string;
			categoryIds?: string;
		}) => Promise<{
			success: boolean;
			entryId?: string;
			uploadId?: string;
			error?: string;
		}>;
		kalturaListCategories: () => Promise<{
			success: boolean;
			categories?: Array<{ id: number; name: string; fullName: string }>;
			error?: string;
		}>;
		onKalturaUploadProgress: (
			callback: (progress: {
				uploadId: string;
				phase: "uploading" | "processing" | "complete" | "error";
				percentage: number;
				entryId?: string;
				error?: string;
			}) => void,
		) => () => void;
		kalturaGetSessionInfo: () => Promise<{
			success: boolean;
			ks?: string;
			partnerId?: number;
			serviceUrl?: string;
		}>;
		kalturaDownload: (params: { entryId: string }) => Promise<{
			success: boolean;
			filePath?: string;
			error?: string;
		}>;
		onKalturaDownloadProgress: (
			callback: (progress: {
				phase: "downloading" | "complete" | "error";
				percentage: number;
				filePath?: string;
				error?: string;
			}) => void,
		) => () => void;
		openKalturaBrowse: () => Promise<void>;
		closeKalturaBrowse: () => Promise<void>;
		kalturaBrowseVideoLoaded: (filePath: string) => Promise<void>;
		onKalturaVideoLoaded: (callback: (filePath: string) => void) => () => void;
	};
}

interface ProcessedDesktopSource {
	id: string;
	name: string;
	display_id: string;
	thumbnail: string | null;
	appIcon: string | null;
}

interface CursorTelemetryPoint {
	timeMs: number;
	cx: number;
	cy: number;
}
