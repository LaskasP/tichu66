# tichu66

A Tichu scorekeeper for 4–6 players. Plain HTML, CSS and JavaScript; no runtime dependencies or build step.

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

Use **New game** to create a named session. A session contains completed matches and the current unfinished match. Switch sessions with **Saved game**; scores and entered hand drafts stay with their session. **Edit setup** is available until the first hand is recorded. Session and player names remain editable later. Choose each match's 500/1000 target before its first hand.

| Players | Mode | After a completed match | Standings |
| --- | --- | --- | --- |
| 4 | Fixed pairs | Same pairs play again | Pairs |
| 5 | Rotating | Existing one-player rotation | Individuals |
| 6 | Fixed pairs | Three pairs cycle A–B, B–C, C–A | Pairs |
| 6 | Rotating | Four play, two rest; balanced 15-match cycle | Individuals |

In the six-player rotating cycle, everyone plays 10 matches, rests 5, and partners each other player twice. The next lineup is shown below the board. Rotation happens after a match reaches the target with a lead, never after individual hands. Undo reopens a completed match with its original lineup and target.

Sessions automatically save in browser localStorage under `tichu-sessions-v1`. Each **Export JSON** downloads just the selected session as schema version 3, with a stable ID and editable name. Import adds a session; a matching ID offers update or copy. New exports require the updated app.

Existing version-2 JSON backups import as five-player sessions while preserving players, history, unfinished hands, target and current rotation. Earlier `rounds` backups retain their legacy hand records separately. Existing browser data under `tichu-five-v1` is automatically migrated when no new session library exists; that original storage entry is left untouched. Migration never copies records from another active session.

To move your ongoing game, export a backup in the original app and import it here. Keep the same local address and port to reuse browser storage. Data does not sync between devices or origins. If saved data cannot be loaded, it is left untouched and the app reports the problem rather than overwriting it. Browser storage is not a substitute for an exported backup.

## Files

- index.html: layout and controls
- style.css: responsive design
- app.js: scoring controls, sessions, statistics, navigation and persistence
- engine.js: save validation, migration and match rotation
- engine.test.js: rules and save compatibility checks (`node --test engine.test.js`)

Features include automatic opposing scores, independent ±100 adjustments, double victory, team or personal standings, match history, undo and JSON backups.

The package excludes the original deployment identity, Git credentials and personal game data.
