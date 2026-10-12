# Agent instructions

## Declare the skills you use

At the start of every task, read `.agents/skills/declaring-skill-usage/SKILL.md` and follow it. It requires declaring which Agent Skills you will use and confirming that plan before starting, announcing any skill added mid-task, and reporting every skill used with its concrete impact when finishing.

## Skills

Team skills live in `.agents/skills/<slug>/SKILL.md` — a cross-agent location, so Codex, Cursor, Claude Code, and amp all read the same set. See `.agents/skills/README.md` for why that path and what belongs there.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues on `Amurion97/vocab-app`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical labels, each string equal to its role name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
