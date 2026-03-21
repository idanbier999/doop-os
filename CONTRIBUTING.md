# Contributing to Doop

Thank you for your interest in contributing to Doop! This guide will help you get started.

## Table of Contents

- [Development Environment](#development-environment)
- [Getting Started](#getting-started)
- [Database](#database)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Running Checks](#running-checks)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)

## Development Environment

Before you begin, make sure you have the following installed:

- **Node.js 20+** (see `.nvmrc` for the exact version)
- **npm** (comes with Node.js)

No Docker or external database required — the dev server starts an embedded PostgreSQL automatically.

## Getting Started

1. **Fork** the repository on GitHub.

2. **Clone** your fork locally:

   ```bash
   git clone https://github.com/<your-username>/doop-os.git
   cd doop-os
   ```

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Start the development server:**

   ```bash
   npm run dev
   ```

   The dev server automatically starts an embedded PostgreSQL instance, runs all migrations, and seeds initial data. The app will be available at [http://localhost:3000](http://localhost:3000).

## Database

Doop uses [Drizzle ORM](https://orm.drizzle.team/) with PostgreSQL. The schema is defined in `src/lib/db/schema.ts`.

### Creating a new migration

When you need to change the database schema:

1. Edit the schema in `src/lib/db/schema.ts`
2. Generate a migration:

   ```bash
   npx drizzle-kit generate
   ```

   This creates a new timestamped SQL file in `drizzle/`.

### Applying migrations

Migrations are applied automatically when the dev server starts. To apply manually:

```bash
npx drizzle-kit migrate
```

### Using an external database

To develop against an external PostgreSQL instance instead of the embedded one:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/doop npm run dev
```

## Branch Naming

Use the following prefixes for your branches:

| Prefix   | Purpose                           |
| -------- | --------------------------------- |
| `feat/`  | New features                      |
| `fix/`   | Bug fixes                         |
| `chore/` | Maintenance, refactoring, tooling |

Examples: `feat/add-agent-bulk-actions`, `fix/webhook-retry-loop`, `chore/update-deps`.

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`.

Examples:

```
feat(agents): add bulk tag assignment
fix(webhooks): prevent duplicate delivery on retry
docs: update architecture diagram
chore: upgrade vitest to v4
```

## Running Checks

Before submitting a pull request, make sure all checks pass locally:

| Command                | Purpose                      |
| ---------------------- | ---------------------------- |
| `npm test`             | Run the test suite (Vitest)  |
| `npm run lint`         | Lint the codebase (ESLint)   |
| `npm run typecheck`    | TypeScript type checking     |
| `npm run format`       | Auto-format with Prettier    |
| `npm run format:check` | Verify formatting is correct |

A pre-commit hook (via Husky + lint-staged) will automatically format staged files when you commit.

## Pull Request Process

1. **Create a branch** from `main` using the naming convention above.
2. **Make your changes** in small, focused commits.
3. **Run all checks** locally (tests, lint, typecheck, format).
4. **Push your branch** to your fork.
5. **Open a pull request** against the `main` branch of the upstream repository.
6. **Fill out the PR template** with a clear description of what changed and why.
7. **Address review feedback** promptly. Push additional commits rather than force-pushing.

### What we look for in a PR

- All CI checks pass.
- New features include tests.
- No unrelated changes are bundled in.
- Code follows existing patterns and conventions.

## Code Style

- **Prettier** handles all formatting automatically. Do not override Prettier rules.
- Follow existing patterns in the codebase. If you are unsure about a convention, look at similar files for guidance.
- Use TypeScript strictly -- avoid `any` types where possible.
- Colocate tests next to the files they test (e.g., `foo.ts` and `foo.test.ts` in the same directory).
- React components use functional components with hooks.
- Server Actions live in `actions.ts` files alongside their route pages.

---

If you have questions, feel free to open a discussion or reach out via GitHub Issues. We appreciate every contribution!
