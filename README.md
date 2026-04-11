<p align="center">
  <img src="public/openscreen.png" alt="OpenScreen Logo" width="64" />
</p>

# <p align="center">OpenScreen + Kaltura</p>

<p align="center"><strong>Free, open-source screen recording — now with cloud save and load via Kaltura.</strong></p>

OpenScreen is a powerful free screen recorder and editor. This fork adds what the original was missing: **cloud storage**. Connect your [Kaltura](https://www.kaltura.com) account to save recordings to the cloud and load them back on any machine. No more local-only files — record, edit, save to cloud, and pick up where you left off from anywhere.

<p align="center">
	<img src="public/preview3.png" alt="OpenScreen App Preview" style="height: 0.2467; margin-right: 12px;" />
	<img src="public/preview4.png" alt="OpenScreen Editor Preview" style="height: 0.1678; margin-right: 12px;" />
</p>

## What's New in This Fork

### Cloud Save & Load
The original OpenScreen keeps everything on your local machine. This fork connects to **Kaltura's cloud** so you can:
- **Save to cloud** — upload finished recordings with title, description, tags, and categories. Track upload and processing progress in real time.
- **Load from cloud** — browse your entire Kaltura media library, search by name, and pull any video into the editor.

Your recordings stay local until you choose to save them. Once in the cloud, they're available from any machine where you sign in.

### End-to-End Workflow
```text
Record  →  Edit  →  Save to Cloud  →  Load Anywhere
```
Once uploaded, your videos benefit from Kaltura's transcoding, adaptive streaming, analytics, and AI features.

### Kaltura Account Integration
- **Sign in** directly from the editor — multi-account support included.
- **Switch accounts** without re-entering credentials.
- **Create a free Kaltura account** from within the app and start publishing immediately.

## Core Features

Everything from OpenScreen, plus the Kaltura integration:

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
- **Save to Kaltura cloud** with metadata and categories.
- **Load from Kaltura cloud** — browse, search, and edit any video from your library.

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

## Connecting to Kaltura

1. Open the editor and click the **Kaltura Settings** button in the toolbar.
2. Sign in with your Kaltura credentials (or create a free account).
3. If your login is associated with multiple accounts, select the one you want to use.
4. You're connected — upload and browse buttons are now active.

Your session is persisted locally (encrypted) so you stay connected across app restarts.

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

Contributions are welcome! For Kaltura-specific features, open an issue or PR in this fork. For core recording/editing improvements, consider contributing upstream to [OpenScreen](https://github.com/siddharthvaddem/openscreen).

## License

This project is licensed under the [MIT License](./LICENSE).
