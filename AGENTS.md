<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AI Coding Assistant Rule: `.second brain` Memory Protocol

## 1. Mandatory Setup (First Task)
If the `.second brain` folder does not yet exist in the root directory of this project, immediately execute the following setup before writing any application code:
1. Create a directory in the project root named `.second brain` (exact name, including the leading dot and space).
2. Inside `.second brain`, create the initial progress log file named `000_init.md` documenting the project initialization, architecture overview (from `PROJECT_SPEC.md`), and the immediate next task.

---

## 2. Start-of-Session Rule (Mandatory Read)
At the beginning of **every** new session, before answering questions, planning, or modifying any files:
1. List and read **all** `.md` files inside the `.second brain/` directory in chronological/numerical order (`000_*.md`, `001_*.md`, `002_*.md`, etc.).
2. Use the contents of `.second brain/` as the single source of truth for:
   - What features and database schemas have already been built.
   - Architectural decisions, environment variables, and known edge cases.
   - The exact next task queued up for the current session.
3. Briefly acknowledge the last recorded session state before starting work so the user knows context has been restored.

---

## 3. End-of-Session Rule (Mandatory Write)
At the end of **every** session—or immediately after completing a major feature, milestone, or debugging task—you **MUST** create a new Markdown log file inside `.second brain/`.

### Naming Convention
Use a zero-padded sequential 3-digit prefix followed by a concise kebab-case topic description:
- `001_nextjs-prisma-setup.md`
- `002_auth-and-onboarding.md`
- `003_event-types-crud.md`
- `004_availability-and-slots.md`

### Required Log Template
Every new file created in `.second brain/` must follow this exact structure:

```markdown
# Session [NNN] - [Short Descriptive Title]
**Date:** YYYY-MM-DD
**Status:** [Completed / In Progress / Blocked]

## Files Created or Modified
- `path/to/file1.ts` — Brief note on what changed
- `path/to/file2.tsx` — Brief note on what changed

## Summary of Progress
- Bullet points detailing features implemented, database migrations run, or bugs resolved.

## Architectural Decisions & Important Notes
- Record any library choices, schema constraints, timezone/UTC conventions, or `.env` keys added so future sessions stay consistent.

## Next Steps (Queue for Next Session)
1. [Exact first task the next session should execute]
2. [Second task]
```

---

## 4. Editor Compatibility Note
- This file (`AGENTS.md`) serves as the universal instruction file for agentic AI tools.
- If using an editor that requires a specific rule path, mirror or symlink this file to `.cursor/rules/second-brain.mdc`, `.github/copilot-instructions.md`, or `.gemini/GEMINI.md`.
