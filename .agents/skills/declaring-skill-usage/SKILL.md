---
name: declaring-skill-usage
description: Requires the agent to declare which Agent Skills it intends to use before starting work, confirm that plan with the user, announce any skill loaded later in the task, and report every skill actually used with its concrete impact when the work is done. Applies to every task in this repository, including plan mode, review tasks, and subagent work.
---

# Declaring Skill Usage

Three mandatory gates around every task: declare before, announce during, report after. The point is that the user always knows which skills shaped the output, so an unhelpful or stale skill can be caught instead of silently steering the work.

This skill governs the *process*, never the content of the task. It does not override any other skill or rule.

## Scope

Applies to every task in this repository, including plan mode and work delegated to subagents.

Two intensities:

- **Work that writes or changes anything** (edits, new files, commands with side effects, deploys, PRs, plans that will be executed): all three gates apply, and Gate 1 blocks until the user answers.
- **Pure read-only answers** (explaining code, answering a question, single-file lookups): declare skills inline in the first sentences and skip the blocking confirmation. Gate 3 still applies if any skill was used.

## Gate 1: Declare and confirm before starting

Before the first edit or side-effecting command, analyze the request and the relevant code, then enumerate the candidate skills.

Survey every available source, not just one: skills in `.agents/skills/`, user-level skills the harness lists, and skills bundled with plugins or MCP servers. List candidates by their exact `name` from the frontmatter.

Report in this format:

```markdown
**Skills for this task**

Will use:
- `<skill-name>` — <why it applies to this specific request, one line>

Considered but skipping:
- `<skill-name>` — <why it does not apply>

Nothing matched: <state this explicitly if the "Will use" list is empty>
```

Then ask the user to confirm, using the structured question tool if one is available, otherwise a direct question. Offer at minimum: proceed as declared, add a skill, or drop a skill.

Rules for this gate:

- MUST list every skill planned, including ones already read while analyzing the request.
- MUST state "nothing matched" explicitly rather than staying silent. Silence is indistinguishable from forgetting.
- MUST NOT edit files or run side-effecting commands before the user answers. Reading and searching to build the declaration is expected.
- MUST NOT pad the list with skills that are only loosely related. A declaration the user has to prune is worse than a short accurate one.

## Gate 2: Announce skills added mid-task

Tasks reveal their real shape as they progress. When a skill becomes relevant that was not declared in Gate 1, announce it in the next message before applying it:

```markdown
**Adding skill**: `<skill-name>` — <what in the task surfaced the need>
```

No confirmation needed, but it must appear in the transcript before the skill's guidance changes any output. Dropping a declared skill gets the same one-line treatment.

## Gate 3: Report usage and impact when finishing

End every task that used at least one skill with a usage report. Place it after the summary of the work, not instead of it.

```markdown
**Skills used**

- `<skill-name>` — <concrete impact>
```

An impact line must name what is observably different because the skill was loaded: a decision it settled, a file or function it shaped, a default it overrode, a mistake it prevented. If nothing changed, say so — that is the most useful signal in the whole report.

Good impact lines:

- `vercel-react-best-practices` — moved the badge list fetch into the server component, so the client bundle no longer ships the formatting helpers.
- `deploy-to-production` — supplied the exact `confirm=deploy` input; the first dispatch would have failed with a 422 without it.
- `web-design-guidelines` — read in full, but the diff touched no markup, so it changed nothing.

Bad impact lines, and why:

- "Followed React best practices." — restates the skill's name instead of naming a change.
- "Used for guidance." — true of every skill ever loaded; carries no information.
- "Improved code quality." — unfalsifiable; the user cannot check it against the diff.

When a subagent did the work, its skills belong in the report too, attributed to it.

## Interaction with other instructions

- If another rule or skill conflicts with this one, follow the other one and note the conflict in the Gate 3 report.
- If the user says to skip the gates for a task, skip them for that task and do not re-litigate it.
