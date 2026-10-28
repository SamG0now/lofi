<p align="center">
  <img height="64" src="https://raw.githubusercontent.com/dvx/lofi/master/icon.png">
</p>

<h1 align="center"><strong>Lofi: a tiny Spotify player</strong></h1>

<p align="center">
  <a target="_blank" href="https://www.lofi.rocks">Website</a> • <a target="_blank" href="https://www.lofi.rocks/help">FAQ</a> • <a target="_blank" href="https://discord.gg/YuH9UJk">Discord</a>
</p>

<table width="100%">
  <tr>
    <td width="50%"><img width="100%" src="https://www.lofi.rocks/min.jpg"></td>
    <td width="50%"><img width="100%" src="https://www.lofi.rocks/vis.gif"></td>
  </tr>
</table>

Lofi is a mini Spotify player with visualizations. It is _not_ a replacement for the Spotify Desktop app, nor does it play music independently of the Spotify app; instead, Lofi works alongside it to provide a more intuitive and pleasant access to common features. Lofi also displays cover art and track info stylishly and it facilitates WebGL-powered audio visualizations for both Windows, MacOS and Linux. In other words, it's a "tiny Spotify player" or a "mini mode" to enhance the Spotify desktop app.

## Design goals

- A small player depicting album art, resizable to any shape, with controls on hover
- An always-on-top "widget-like" app
- Minimalist (no extraneous controls)
- Multiple-screen capable
- Windows, MacOS and Linux compatible
- Visualization-ready (WebGL)
- ≤ 100MB memory footprint

# Connecting to Spotify

Spotify no longer lets apps share a client ID, so Lofi connects through a Spotify app that you register yourself (it's free, but Spotify requires the app owner to have Premium):

1. Create an app on the [Spotify developer dashboard](https://developer.spotify.com/dashboard) and select **Web API**.
2. Add `http://127.0.0.1:41419` as a redirect URI, exactly as written (no trailing slash, and `127.0.0.1` rather than `localhost`), then **Save** the app.
3. Start Lofi, open **Settings → Account**, paste the app's client ID and click **Log in with Spotify**.

`redirect_uri: Not matching configuration` means the redirect URI saved on the app doesn't exactly match the one above.

# Building

You'll need Node.js 22 or newer, [pnpm](https://pnpm.io), Python 3 and a C++ compiler (Microsoft Build Tools on Windows, Xcode on macOS). On Linux, the visualizations also need the PulseAudio client headers, which work with PipeWire too:

| Distribution  | Package                      |
| ------------- | ---------------------------- |
| Arch          | `libpulse`                   |
| Debian/Ubuntu | `libpulse-dev`               |
| Fedora        | `pulseaudio-libs-devel`      |

Then install the dependencies, which also builds the native modules:

```
$ pnpm install
```

# Development

```
$ pnpm run development
$ pnpm start
```

# Distribution

To **create a setup file**, run `pnpm run dist`. The output will be located in `./dist`. On Linux this builds an AppImage, a `.deb` and a pacman package; the latter two need `libxcrypt-compat` on Arch-based systems.

```
$ pnpm run dist
```

# Linux notes

- Lofi positions its own windows and stays on top, which native Wayland windows aren't allowed to do, so it runs through XWayland. The desktop entry passes `--ozone-platform=x11`, and Lofi relaunches itself with it when started any other way.
- Visualizations react to whatever plays on the default output device, captured through PulseAudio or PipeWire only while a visualization is shown.

# Bugs, issues, and contributing

Found a 🐛? Have a feature request? Feel free to open an [issue](https://github.com/dvx/lofi/issues) or [contribute](https://github.com/dvx/lofi).

As always, you are more than welcome join our [Discord](https://discord.gg/YuH9UJk) 🎤 server. The more the merrier! 🎉

Don't forget to ⭐ and/or fork this repo.

# License

MIT
