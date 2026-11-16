# Tichu Five

A Tichu scorekeeper for five rotating players. Plain HTML, CSS and JavaScript; no dependencies or build step.

## Run locally

```sh
python3 -m http.server 8000
```

On Windows, use `py -m http.server 8000` if needed. Open http://localhost:8000.

## Create a repository

Create an empty GitHub repository, extract this archive, then run in the extracted folder:

```sh
git init
git add .
git commit -m "Initial Tichu scorekeeper"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

## Hosting

Serve the root folder on any static web host. For GitHub Pages: Settings → Pages → Deploy from a branch → main → / (root).

## Game data

Records are stored in browser localStorage under `tichu-five-v1`, JSON schema version 2. To move your ongoing game, export a backup from Menu → Players in the original app and import it in your local app. Keep the same local address and port to reuse browser storage. Game data does not sync between devices or origins.

## Files

- index.html: layout and controls
- style.css: responsive design
- app.js: game rules, rotation, statistics, navigation and persistence

Features include 500/1000-point games, automatic opposing scores, independent ±100 adjustments, double victory, five-player rotation after game wins, personal standings, history, undo and JSON backups.

The package excludes the original deployment identity, Git credentials and personal game data.
