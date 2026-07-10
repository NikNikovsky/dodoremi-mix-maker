# DoDoReMi Mix Maker Assets + Editor

This repository now contains extracted game assets:

- `songs/` (existing songs, config/locales/backing audio)
- `instruments/` (instrument configuration and locale metadata)

## Song Interpreter + Editor

Open `docs/index.html` to:

- interpret existing songs from `songs/*/config.json`
- edit existing songs or build new song configs
- export a game-ready folder (`songs/<slug>/...`) with `config.json` + locale files
- convert selected audio to `backing.ogg` in-browser (when browser APIs support it)

## GitHub Pages

A deployment workflow is included at `.github/workflows/deploy-editor.yml`.

On pushes to `main`, it publishes a static site that includes:

- the editor (from `docs/`)
- extracted `songs/`
- extracted `instruments/`
