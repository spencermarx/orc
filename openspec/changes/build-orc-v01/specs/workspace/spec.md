## ADDED Requirements

### Requirement: NX Monorepo Structure
The system SHALL use an NX integrated monorepo with pnpm workspaces. The root SHALL contain `nx.json`, `package.json` (private, `packageManager: pnpm`), and `pnpm-workspace.yaml` pointing to `packages/*`.

#### Scenario: pnpm install succeeds from root
- **WHEN** `pnpm install` is run from the repository root
- **THEN** all workspace packages are linked without errors

#### Scenario: NX recognizes both packages
- **WHEN** `nx show projects` is run from the repository root
- **THEN** both `@orc/cli` and `@orc/personas` are listed as recognized projects

### Requirement: CLI Package
The system SHALL provide a `packages/cli/` package with its own `package.json` (name: `@orc/cli`). The package has no build step — it contains bash scripts directly.

#### Scenario: package.json exists with correct name
- **WHEN** `packages/cli/package.json` is read
- **THEN** the `name` field equals `@orc/cli`

#### Scenario: No build targets defined
- **WHEN** the NX project configuration for `@orc/cli` is inspected
- **THEN** no `build` target is defined for the package

### Requirement: Personas Package
The system SHALL provide a `packages/personas/` package with its own `package.json` (name: `@orc/personas`). The package has no build step — it contains markdown files directly.

#### Scenario: package.json exists with correct name
- **WHEN** `packages/personas/package.json` is read
- **THEN** the `name` field equals `@orc/personas`

#### Scenario: No build targets defined
- **WHEN** the NX project configuration for `@orc/personas` is inspected
- **THEN** no `build` target is defined for the package

### Requirement: Gitignore Configuration
The system SHALL gitignore machine-specific state: `config.local.toml`, `projects.toml`, `node_modules/`, and project-level ephemeral directories (`.worktrees/`, `.beads/`).

#### Scenario: config.local.toml is gitignored
- **WHEN** a `config.local.toml` file is created anywhere in the repository
- **THEN** `git status` reports it as untracked and ignored

#### Scenario: projects.toml is gitignored
- **WHEN** a `projects.toml` file is created anywhere in the repository
- **THEN** `git status` reports it as untracked and ignored
