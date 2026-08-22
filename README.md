# paste

SvelteKit app running on the [Bun](https://bun.sh) runtime.

## Prerequisites

- [Bun](https://bun.sh) >= 1.4 (enforced via `engines` + `preinstall` guard; npm/pnpm/yarn installs are rejected)

## Developing

Install dependencies and start a development server:

```sh
bun install
bun run dev

# or start the server and open the app in a new browser tab
bun run dev -- --open
```

## Building

To create a production version of your app:

```sh
bun run build
```

You can preview the production build with `bun run preview`.

## Running the production server

The app builds to a standalone Node-compatible server (`@sveltejs/adapter-node`) executed by Bun:

```sh
bun run build
bun run start
```

## Tooling

```sh
bun run check        # svelte-check + TypeScript
bun run lint         # oxlint
bun run lint:fix
bun run fmt          # oxfmt
bun run fmt:check
```
