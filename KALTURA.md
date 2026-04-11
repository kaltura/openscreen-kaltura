# Kaltura Integration

This document describes how the Kaltura cloud integration works, how to extend it, and how it fits into OpenScreen's architecture. For end-user setup instructions, see [Connecting to Kaltura](README.md#connecting-to-kaltura) in the README.

## Overview

The integration adds three capabilities to OpenScreen:

1. **Authentication** — sign in with Kaltura credentials, select from multiple accounts, persist sessions across restarts.
2. **Upload** — save edited videos to Kaltura with metadata (title, description, tags, category). Chunked uploads with real-time progress.
3. **Browse & Download** — embed Kaltura's media manager to search, browse, and load any video from the user's library into the editor.

All Kaltura functionality is opt-in. The UI surfaces upload/browse buttons only when relevant, and the settings dialog is reachable from the toolbar without blocking any existing workflow.

## Architecture

```text
Renderer (React)                    Main Process (Node)
─────────────────                   ───────────────────
KalturaSettingsDialog ──┐
KalturaUploadDialog   ──┤── IPC ──► kaltura-ipc.ts ──► kaltura-service.ts ──► Kaltura REST API
KalturaBrowseDialog   ──┘              (handlers)           (business logic)
     │
     └── preload.ts (contextBridge)
```

### File Layout

```text
electron/
  kaltura/
    kaltura-service.ts   # All Kaltura API calls, session management, upload/download logic
    kaltura-ipc.ts       # IPC handler registration — thin bridge between renderer and service
  preload.ts             # contextBridge exposing kaltura* methods to window.electronAPI

src/components/video-editor/
  KalturaLoginForm.tsx        # Shared login form (email/password, account selection, signup)
  KalturaSettingsDialog.tsx   # Connection status, logout, account switching
  KalturaUploadDialog.tsx     # Upload form with metadata fields and progress
  KalturaBrowseDialog.tsx     # Embedded media manager for browsing and downloading

src/i18n/locales/{en,es,zh-CN}/
  kaltura.json           # All Kaltura UI strings (connection, login, upload, browse, toolbar)
```

### IPC Channel Map

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `kaltura-login` | renderer → main | Authenticate with email/password |
| `kaltura-select-partner` | renderer → main | Choose account after multi-account login |
| `kaltura-list-partners` | renderer → main | Re-fetch partner list (for account switching) |
| `kaltura-logout` | renderer → main | Clear session and credentials |
| `kaltura-load-session` | renderer → main | Restore persisted session on app start |
| `kaltura-get-session-state` | renderer → main | Get current connection state |
| `kaltura-open-signup` | renderer → main | Open Kaltura signup URL in browser |
| `kaltura-upload` | renderer → main | Upload a video file with metadata |
| `kaltura-upload-progress` | main → renderer | Real-time upload/processing progress |
| `kaltura-list-categories` | renderer → main | Fetch category tree for upload form |
| `kaltura-get-session-info` | renderer → main | Get KS + partnerId for media manager |
| `kaltura-download` | renderer → main | Download a video by entry ID |
| `kaltura-download-progress` | main → renderer | Download progress updates |
| `open-kaltura-browse` | renderer → main | Open the browse window |
| `close-kaltura-browse` | renderer → main | Close the browse window |
| `kaltura-browse-video-loaded` | renderer → main | Notify that a downloaded video is ready |
| `kaltura-video-loaded` | main → renderer | Forward loaded video path to editor |

## Session Management

Sessions are persisted to `{userData}/kaltura-session.json`. The file stores:

- `serviceUrl`, `partnerId`, `userId`, `displayName`
- `ks` (Kaltura Session token) — encrypted via Electron's `safeStorage`
- `ksExpiry` — unix timestamp; tokens are generated with a 30-day TTL

On app start, `kalturaLoadSession` reads and decrypts the stored session. If the KS has expired, the user is prompted to sign in again.

Passwords are cached in-memory (never persisted) for up to 24 hours to support account switching without re-prompting. The cache is cleared on logout and on a timer.

## Upload Flow

1. User fills in metadata (name, description, tags, optional category) in `KalturaUploadDialog`.
2. Renderer calls `kaltura-upload` with the video file path and metadata.
3. `kaltura-service.ts` validates the file exists and is readable.
4. Creates an upload token via Kaltura REST API.
5. Reads the file in 10 MB chunks using streaming `fs.open` / `fileHandle.read` (avoids loading full file into memory).
6. Uploads each chunk, reporting progress back to the renderer via `kaltura-upload-progress`.
7. Creates a media entry and attaches the upload token.
8. Optionally assigns a category.
9. Returns the entry ID on success.

Progress phases: `uploading` (0-80%) → `processing` (80-95%) → `complete` (100%).

## Browse & Download Flow

1. User opens the browse dialog from the toolbar or launch window.
2. `KalturaBrowseDialog` fetches session info (KS, partnerId) and loads Kaltura's Unisphere media manager via script injection.
3. The media manager renders inside a container div, allowing the user to search and browse their library.
4. When the user selects an entry, `kalturaDownload` is called with the entry ID.
5. `kaltura-service.ts` fetches the download URL via `playManifest` and streams the file to the app recordings directory (`userData/recordings`).
6. Progress is reported back via `kaltura-download-progress`.
7. On completion, the file path is forwarded to the editor window via `kaltura-video-loaded`.

## Security

- **Context isolation**: all Kaltura windows use `contextIsolation: true`. No direct Node access from the renderer.
- **Session encryption**: the KS token is encrypted with `safeStorage.encryptString()` before writing to disk and decrypted on read.
- **File path validation**: upload and download operations validate file paths. The `isPathAllowed` check and `approvedPaths` Set prevent path traversal.
- **Password handling**: passwords are cleared from React component state immediately after use and cached only in the main process memory with a TTL.
- **Fetch timeouts**: all Kaltura API calls use a 60-second timeout via `AbortSignal.timeout()` to prevent hanging requests.

## Internationalization

All user-facing strings use the `kaltura` i18n namespace via `useScopedT("kaltura")`. Translation files are in `src/i18n/locales/{locale}/kaltura.json`.

To add a new string:

1. Add the key to `src/i18n/locales/en/kaltura.json`.
2. Add translations to `es/kaltura.json` and `zh-CN/kaltura.json`.
3. Use `t("section.key")` in the component (where `t = useScopedT("kaltura")`).
4. Run `npm run i18n:check` to verify all locales are in sync.

## Extending

### Adding a new API call

1. Add the function to `kaltura-service.ts` following the existing pattern (use `fetchWithTimeout`, return `{ success, error?, ... }`).
2. Register the IPC handler in `kaltura-ipc.ts`.
3. Add the preload bridge in `preload.ts`.
4. Add the TypeScript type to `src/types/electron.d.ts` (if it exists) or rely on the preload's inline types.
5. Call `window.electronAPI.yourNewMethod()` from the renderer.

### Adding UI

Kaltura UI components live in `src/components/video-editor/`. They follow the project's patterns:

- **shadcn/ui** for Dialog, Input, Select, Button.
- **Tailwind** for styling with the dark theme (`bg-[#09090b]`, `text-slate-200`, etc.).
- **`useScopedT("kaltura")`** for all strings — no hardcoded text.
- **Biome** for formatting (tabs, double quotes, 100-char width). Run `npm run lint:fix` before committing.
