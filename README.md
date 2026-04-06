# CS-Themed Imposter

A static, pass-and-play web game based on **Imposter** where everyone except the imposter sees the same secret computer science term, players give clues in turn, then discuss and vote. This version is built for **Marist Computer Society** styling and runs entirely in the browser—no backend.

The app is plain **HTML**, **CSS**, and a small **JavaScript** module. Word lists live as **JSON** files under `wordsets/` and are loaded at runtime with `fetch`, using paths relative to `app.js` so it works on **GitHub Pages** (including project URLs like `/your-repo/`) and local dev servers.

## Running locally

Opening `index.html` directly from disk often blocks loading JSON; use any static file server from the project root, for example:

```bash
npx serve .
```

Then open the URL shown in the terminal (for example `http://localhost:3000`).

## Adding a new wordset

Each wordset is **one JSON file**. Each file must be a **JSON array of strings** (the secret words or phrases). The game picks **one random entry** when a round starts.

### 1. Add the JSON file

Create a file in `wordsets/` named `{id}.json`, where `{id}` is a short identifier with no spaces (for example `cs500.json` or `linux.json`).

Example `wordsets/cs500.json`:

```json
[
  "Quantum Computing",
  "Homomorphic Encryption",
  "Z System"
]
```

Rules the code expects:

- Valid JSON (double quotes around strings, commas between items, no trailing comma after the last element).
- A **non-empty array**; every item should be a string (non-strings are coerced to strings in code, but keeping everything as strings is clearest).
- Use UTF-8 if you include accented or special characters.

### 2. Register the wordset in the menu

Open `index.html` and find the `<select id="wordset">` block. Add an `<option>` whose **`value` matches `{id}`** exactly (the filename without `.json`):

```html
<option value="cs500">CS 500 — Your label here</option>
```

The **label** (text between the tags) is what players see in the dropdown; the **`value`** must match the file base name so `app.js` can load `wordsets/{id}.json`.

You do **not** need to change `app.js` for a new wordset as long as the file name and option `value` stay in sync.

### 3. Deploy

Commit the new `wordsets/*.json` file and your updated `index.html`

## Project layout (short)

| Path | Role |
|------|------|
| `index.html` | Setup UI, game UI, wordset `<select>` |
| `styles.css` | Layout and theme |
| `app.js` | Game logic, timer, `loadWordset(id)` → `wordsets/${id}.json` |
| `wordsets/*.json` | Word lists (arrays of strings) |
| `.nojekyll` | Tells GitHub Pages not to run Jekyll (static files as-is) |

## License / credits
Copyright and club links are in the site footer; adjust `index.html` as needed for your deployment.
