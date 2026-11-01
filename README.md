# Neurelium

A study planner built around categories, topics, tasks, weekly planning, milestones, and activity history.

## Stack

- SvelteKit 3 and Svelte 5
- Tailwind CSS 4
- Appwrite (Auth, TablesDB)
- Bun
- Static adapter

## Local setup

```bash
bun install
cp .env.example .env
bun run dev
```

Set the Appwrite values in `.env`:

```env
PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
PUBLIC_APPWRITE_PROJECT_ID=neurelium
PUBLIC_APPWRITE_DATABASE_ID=neurelium
```

## Appwrite schema

The schema is defined in `src/lib/infrastructure/appwrite/schema.ts`.

To create or update the database and tables, add a server API key to `.env` and run:

```bash
APPWRITE_API_KEY=... bun run db:setup
```

The setup script is idempotent and adds missing columns to existing tables.

## Scripts

```bash
bun run dev       # development server
bun run check     # Svelte/TypeScript checks
bun test          # unit tests
bun run build     # static production build
bun run preview   # preview the build
```

## Deploy

The app uses `@sveltejs/adapter-static` with an `index.html` fallback. Deploy the `build` directory to any static host. Configure the host to serve `index.html` for client-side routes.
