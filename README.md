# DoDoReMi Mix Maker Assets + Editor
[![AI Slop Inside](https://sladge.net/badge.svg)](https://sladge.net)
This repository now contains extracted game assets:

- `songs/` (existing songs, config/locales/backing audio)
- `instruments/` (instrument configuration and locale metadata)

## Song Interpreter + Editor

Open `docs/index.html` to:

- interpret existing songs from `songs/*/config.json`
- edit existing songs or build new song configs
- edit beatmaps with a graphical piano-tile style lane editor per beatmap/instrument set
- export a game-ready folder (`songs/<slug>/...`) with `config.json` + locale files
- convert selected audio to `backing.ogg` in-browser (when browser APIs support it)

## GitHub Pages

A deployment workflow is included at `.github/workflows/deploy-editor.yml`.

On pushes to `main`, it publishes a static site that includes:

- the editor (from `docs/`)
- extracted `songs/`
- extracted `instruments/`

## Editor verification screenshots

- `docs/screenshots/editor-load-existing-song.png`
- `docs/screenshots/editor-upload-and-edit-example.png`
- `docs/screenshots/editor-graphical-tiles-loaded.png`
- `docs/screenshots/editor-graphical-tiles-edited.png`

## Link
https://niknikovsky.github.io/dodoremi-mix-maker/
