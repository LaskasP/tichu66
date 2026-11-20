# tichu66

tichu66 is a mobile-friendly Tichu scorekeeper for a table of 4–6 friends. Play with two fixed pairs and no rotation for 4 players, four active players and one rotating rest for 5 players, or choose between three fixed pairs taking turns and rotating partnerships with two players resting for 6 players. Track hands, match scores, team or individual standings, and match time across named game sessions. There is no backend, so player data is not stored on a server; games are saved in browser sessions and can be exported as local JSON files to keep or resume them. Built with plain HTML, CSS and JavaScript, it requires no runtime dependencies or build step.

## Run locally

```sh
python3 -m http.server 8000
```

On Windows, use `py -m http.server 8000` if needed. Open http://localhost:8000.



## Game data

On a fresh visit, **New game** opens automatically. Create a game or use **Import JSON** in that dialog to continue a backup; successful creation or import closes the dialog. Until then, no placeholder game is saved. Returning visits resume the saved game.

Use **New game** to create a named session. A session contains completed matches and the current unfinished match. Switch sessions with **Saved game**; scores and entered hand drafts stay with their session. **Edit setup** is available until the first hand is recorded. Session and player names remain editable later. Choose each match's 500/1000 target before its first hand.

| Players | Mode | After a completed match | Standings |
| --- | --- | --- | --- |
| 4 | Fixed pairs | Same pairs play again | Pairs |
| 5 | Rotating | Existing one-player rotation | Individuals |
| 6 | Fixed pairs | Three pairs cycle A–B, B–C, C–A | Pairs |
| 6 | Rotating | Four play, two rest; balanced 15-match cycle | Individuals |

In the six-player rotating cycle, everyone plays 10 matches, rests 5, and partners each other player twice. The next lineup is shown below the board. Rotation happens after a match reaches the target with a lead, never after individual hands. Undo reopens a completed match with its original lineup and target.

For 5 or 6 players, change the sitting-out player or a team selector anytime, including during a match. Team scores and hand drafts stay in place. Fixed six-player pairs move together. The lineup that finishes the match receives its full points and win/loss result; players sitting out at the finish receive none. Past match results remain unchanged by later substitutions.

Sessions automatically save in browser localStorage under `tichu-sessions-v1`. Each **Export JSON** downloads just the selected session as schema version 3, with a stable ID and editable name. Import adds a session; a matching ID offers update or copy. New exports require the updated app.

To move your ongoing game, export a backup in the original app and import it here. Keep the same local address and port to reuse browser storage. Data does not sync between devices or origins. If saved data cannot be loaded, it is left untouched and the app reports the problem rather than overwriting it. Browser storage is not a substitute for an exported backup.

## Files

- index.html: layout and controls
- style.css: responsive design
- `app.js` starts the app and connects draft input events.
- `match.js` handles scoring, lineup changes, undo, and the match timer.
- `sessions.js` manages game setup, browser storage, and JSON backups.
- `views.js` renders the game, standings, and history and handles navigation.
- `dropdowns.js` provides the option picker used by the form controls.
- engine.js: save validation, migration and match rotation
- engine.test.js: rules and save compatibility checks (`node --test engine.test.js`)

Features include automatic opposing scores in normal mode, independent ±100 adjustments, team or personal standings, match history, undo and JSON backups.
