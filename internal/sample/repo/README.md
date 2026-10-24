# Tally

A tiny to-do list for the browser: add things, tick them off, see how many are left.
It's AgentBox's sample project, small enough to read in a minute and with a few gaps
left in on purpose, so there's real work for agents to do.

## Run it

You need Node.js 18 or newer, and nothing else: there are no dependencies.

```bash
npm start
```

Then open http://localhost:3000. `PORT=8080 npm start` serves it on another port.

## How it's built

- `server.js` serves `public/` with Node's own `http` module.
- `public/todos.js` holds the list's logic as plain functions, with no DOM in them.
- `public/app.js` draws the list and wires up the form; `public/style.css` styles it.
- The list is kept in the browser's `localStorage`, so it survives a reload.

## What's missing

- There's no dark mode: the page is light whatever the system's theme.
- There are no tests: `npm test` has nothing to run.
- Someone reported that the "items left" count in the footer looks wrong.
