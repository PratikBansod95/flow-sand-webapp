# Flow Sand Web App

A minimal falling-sand style drawing experience for the browser. Drag on the canvas to "pour" colorful sand that falls under gravity and builds layered, rainbow mountains.

## Running locally

1. Install dependencies (Node 18+ recommended):

```bash
npm install
```

2. Start a simple dev server:

```bash
npm start
```

3. Open the printed URL (usually `http://127.0.0.1:8080`) in your browser.

## Controls

- **Drag on canvas**: Pour sand.
- **Rainbow wheel**: Use a shifting rainbow gradient (default).
- **Color dots**: Switch to a fixed color for new sand.
- **Clear**: Reset the canvas.
- **Share**: Export the current canvas as a PNG (uses native Web Share API if available, falls back to download).

The layout is tuned for a phone-like viewport but will also work on desktop. Touch and mouse input are both supported.

