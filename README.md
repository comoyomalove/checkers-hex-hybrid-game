# Checkers + Hex

A two-player strategy game that combines the connection goal of Hex with the jump capture tactics of Checkers.

## The story

Checkers + Hex is a hybrid of two classic board games, designed by Naz Akgül. The rule of thumb was **inherit, don't invent**: keep rules from one parent game wherever they still work, blend them where both have something to offer, and add a new rule only when nothing else fits. The result:

- **Placement only** (from Hex) — you place a piece each turn; pieces never move except when capturing
- **Connection win** (from Hex) — join two opposite sides of the board
- **Jump capture along the diagonal axes** (from Checkers) — leap over an adjacent opponent piece
- **Mandatory capture** (from Checkers) — if you can capture, you must

## What v1 contains

This repository is **v1**, frozen as it was first released. It runs in the browser with no install and includes:

- a **rules engine** — legal moves, mandatory capture, capture chains, connection win
- a built-in **agent** to play against (connection-first)
- **replay** — step through any game, including forks when you rewind and play a different move
- **game logs** — download a full JSON record of every turn
- a **visualisation** of the hex board in `index.html`

The live game at <https://checkers-hex.nazakgul.games> has moved on since. v1 is here for anyone who wants to build on it.

Design notes: [Hybrid_GDD.md](Hybrid_GDD.md) · Full rules: [Player_Facing_Ruleset.md](Player_Facing_Ruleset.md)

## Rules tests

Run `npm test` with Node.js to check placement, mandatory captures, capture
chains and both connection axes without a browser or network access. The pure
engine lives in `rules.js`; the browser loads its `CheckersHexRules` namespace
before `app.js`. Keep both files when copying the game. Opening `index.html`
directly still works without a server or an install.

---

---

## How to play

### Step 1 — Download the game

1. Go to the repository page on GitHub
2. Click the green **Code** button
3. Click **Download ZIP**
4. Open your Downloads folder and double-click the ZIP file to unzip it
5. You will now have a folder called `checkers-hex-hybrid-game-main`

---

### Step 2 — Open the game

1. Open the `checkers-hex-hybrid-game-main` folder
2. Find the file called **`index.html`**
3. Double-click it
4. It opens automatically in your web browser — no installation needed

---

### Step 3 — Start a game

1. **Enter player names** (optional) — type your name in the Player 1 and Player 2 boxes, or leave them as-is
2. **Choose a game mode:**
   - **Human vs Human** — two people take turns on the same screen
   - **Human vs Agent** — you play against the computer
3. Click **▶ New Game**

---

## The goal

Connect **any two opposite sides** of the board with an unbroken line of your pieces.

The board has four sides:
- **Top and bottom** — marked with a green border
- **Left and right** — marked with a red border

You win the moment your pieces form a continuous path from one side to the opposite side — in any direction, any shape.

---

## How to place a piece

- Click any empty cell on the board to place your piece there
- Pieces are never moved after placement — **the only exception is a capture jump** (see below)

---

## Captures

You can capture an opponent's piece by **jumping over it**.

For a capture to happen:
1. Your piece must be on the board
2. An opponent's piece must be directly next to it **along a diagonal direction**
3. The cell on the other side of the opponent's piece must be **empty**
4. Your piece jumps over the opponent's piece and lands in that empty cell
5. The opponent's piece is removed from the board

### Captures are mandatory

If any of your pieces can capture at the start of your turn — you **must** capture. You cannot place a new piece instead.

**How to capture:**
- Pieces that must capture are highlighted in **purple**
- Click a purple piece to select it
- Valid landing cells appear in **bright green**
- Click a green cell to complete the jump
- If another jump is available from the landing cell, green cells appear again — keep clicking until the chain ends

### Capture chains

If your piece can jump again immediately after landing, you must continue jumping. The chain ends only when no further jump is available.

---

## Capture directions

Captures only work along two diagonal directions on the hex board:

- Northeast ↔ Southwest
- Northwest ↔ Southeast

The East ↔ West direction is **not** a capture direction.

All six directions still count for **connection** (winning path).

---

## Replay controls

After a game (or during one), you can review every move:

| Button | What it does |
|---|---|
| **▶ Play** | Auto-plays through all turns |
| **⏸ Pause** | Stops the auto-play |
| **← Prev Turn** | Steps back one turn |
| **Next Turn →** | Steps forward one turn |

If you go back during a game and make a different move, the game records it as a **fork** — a new branch from that point. All branches are saved.

---

## Download the game log

Click **↓ Download Game Log (JSON)** at any time to save a full record of the game to your computer.

The log includes:
- Every move made by both players
- Board state before and after each move
- Captures
- Date and time of each turn
- All branches and forks if you replayed and changed moves
- The winner

---

## Colour guide

| Colour | Meaning |
|---|---|
| Blue circle | Player 1's piece |
| Red circle | Player 2's piece |
| Purple cell | A piece that must capture this turn |
| Cyan cell | The piece you have selected |
| Bright green cell | A valid landing cell — click to jump |
| Orange cell | A piece that was just captured |
| Blue path | The winning connection |
| Green border | Top and bottom edges of the board |
| Red border | Left and right edges of the board |

---

## Rules summary

- 2 players
- Take turns placing one piece per turn
- Win by connecting any two opposite sides of the board
- Captures are jumps over adjacent opponent pieces — landing cell must be empty
- If a capture is available at the start of your turn, you must take it
- Chain captures continue until no further jump is available
- No piece promotion or kings
- Capturing all opponent pieces is not a win condition

---

## No installation required

The game runs entirely in your browser. You do not need to install anything.

---

---

## Room for improvement — ideas welcome

v1 is a starting point, not a finished game. Some things that would make it better: tests for the rules engine, agent-vs-agent play, a stronger agent, loading saved logs back into replay, keyboard and colour-blind-friendly play.

Ready-to-paste issue texts are in [docs/IDEAS.md](docs/IDEAS.md). Your own ideas are just as welcome — open an [issue](https://github.com/comoyomalove/checkers-hex-hybrid-game/issues).

## Contributing

Forks, experiments and pull requests are all welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) to get started. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md) (Contributor Covenant 2.1); questions and reports go through GitHub issues.

## Licence

[MIT](LICENSE) © 2026 Naz Akgül. Use it, change it, build on it — just keep the copyright and licence notice.

## Contact

Made by Naz Akgül — portfolio and other projects: [nazakgul.games](https://nazakgul.games). Play the current game: [checkers-hex.nazakgul.games](https://checkers-hex.nazakgul.games). Questions and ideas: [Discussions](https://github.com/comoyomalove/checkers-hex-hybrid-game/discussions).
