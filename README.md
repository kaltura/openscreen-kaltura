<p align="center">
  <img src="public/openscreen.png" alt="OpenScreen Logo" width="64" />
</p>

# <p align="center">OpenScreen + Kaltura</p>

<p align="center"><strong>Free, open-source screen recording — with opt-in cloud sharing via Kaltura.</strong></p>

<p align="center">
	<img src="public/preview3.png" alt="OpenScreen App Preview" style="height: 0.2467; margin-right: 12px;" />
	<img src="public/preview4.png" alt="OpenScreen Editor Preview" style="height: 0.1678; margin-right: 12px;" />
</p>

## About This Fork

This is a community fork of [OpenScreen](https://github.com/siddharthvaddem/openscreen) that adds **cloud sharing** — the ability to save recordings to a cloud provider and load them back on any machine. The app has a provider-agnostic **Cloud** menu in the toolbar; [Kaltura](https://www.kaltura.com) ships as the included provider. The app works fully offline — cloud is entirely opt-in. Nothing changes if you never configure a provider.

This fork stays in sync with upstream OpenScreen for core recording and editing improvements.

## Cloud Sharing

The Cloud menu in the editor toolbar lets you save and load recordings from a cloud provider without leaving the app.

- **Save to cloud** — upload finished recordings with title, description, tags, and categories. Track upload and processing progress in real time.
- **Load from cloud** — browse your cloud media library, search by name, and pull any video into the editor.

Your recordings stay local until you choose to save them. Cloud is a publishing step, not a dependency — the editor never requires a network connection.

```text
Record  →  Edit  →  Save to Cloud  →  Load Anywhere
```

## Core Features

- Record specific windows or your whole screen.
- Add automatic or manual zooms (adjustable depth levels) and customize their duration and position.
- Record microphone and system audio.
- Crop video recordings to hide parts.
- Choose between wallpapers, solid colors, gradients, or a custom background.
- Motion blur for smoother pan and zoom effects.
- Add annotations (text, arrows, images).
- Trim sections of the clip.
- Customize the speed of different segments.
- Export in different aspect ratios and resolutions.
- **Cloud menu** — save to and load from a cloud provider (Kaltura included).

## Installation

Download the latest installer for your platform from the [Releases](../../releases) page.

### macOS

If macOS Gatekeeper blocks the app (since it's not signed with a developer certificate), run:

```bash
xattr -rd com.apple.quarantine /Applications/Openscreen.app
```

> Give your terminal Full Disk Access in **System Settings > Privacy & Security** first.

Then grant "Screen Recording" and "Accessibility" permissions in **System Preferences > Security & Privacy** and launch the app.

### Windows

Run the `.exe` installer from the releases page. Works out of the box.

### Linux

Download the `.AppImage`, make it executable, and run:

```bash
chmod +x Openscreen-Linux-*.AppImage
./Openscreen-Linux-*.AppImage
```

If the app fails to launch due to a sandbox error:
```bash
./Openscreen-Linux-*.AppImage --no-sandbox
```

### Platform Notes

System audio capture relies on Electron's [desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer):

- **macOS**: Requires macOS 13+. On macOS 14.2+ you'll be prompted to grant audio capture permission.
- **Windows**: Works out of the box.
- **Linux**: Needs PipeWire (default on Ubuntu 22.04+, Fedora 34+). Older PulseAudio-only setups may not support system audio.

## Using the Kaltura Provider

Kaltura is the cloud provider included with this fork. To connect:

1. Open the editor and click **Cloud > Kaltura Settings** in the toolbar.
2. Sign in with your Kaltura credentials (or create a free account from within the app).
3. If your login is associated with multiple accounts, select the one you want to use.
4. You're connected — the **Upload to Kaltura** and **Load from Kaltura** options are now active in the Cloud menu.

Your session is persisted locally (encrypted) so you stay connected across app restarts. Once uploaded, your videos benefit from Kaltura's transcoding, adaptive streaming, analytics, and AI features.

## Adding a Cloud Provider

The cloud integration is designed so that new providers can be added without touching existing code. Each provider follows the same pattern:

1. **Service layer** (`electron/<provider>/`) — API calls, session management, upload/download logic.
2. **IPC bridge** (`electron/<provider>/<provider>-ipc.ts`) — thin handler layer connecting renderer to service.
3. **Preload bridge** (`electron/preload.ts`) — expose methods to `window.electronAPI` via `contextBridge`.
4. **UI components** (`src/components/video-editor/`) — dialogs for login, settings, upload, browse.
5. **i18n strings** (`src/i18n/locales/{locale}/`) — all user-facing text.

The Kaltura implementation is the reference. See [KALTURA.md](./KALTURA.md) for the full architecture walkthrough, IPC channel map, security model, and step-by-step extension guide. Use it as a template when adding a new provider.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Type-check
npx tsc --noEmit

# Build for distribution
npm run build
```

## Built With

- [Electron](https://www.electronjs.org/) — cross-platform desktop app
- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) — UI
- [Vite](https://vitejs.dev/) — build tooling
- [PixiJS](https://pixijs.com/) — canvas rendering for video effects
- [kaltura-client](https://www.npmjs.com/package/kaltura-client) — Kaltura API SDK
- [dnd-timeline](https://github.com/samuelarbibe/dnd-timeline) — drag-and-drop timeline

## Credits

This project is a fork of [OpenScreen](https://github.com/siddharthvaddem/openscreen) by [@siddharthvaddem](https://github.com/siddharthvaddem). The original project is a free, open-source alternative to Screen Studio — all credit for the core recording and editing engine goes to the original author and contributors.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

- **Cloud features and new providers** — open an issue or PR in this fork.
- **Core recording and editing improvements** — consider contributing upstream to [OpenScreen](https://github.com/siddharthvaddem/openscreen) so everyone benefits.

## License

This project is licensed under the [MIT License](./LICENSE).
