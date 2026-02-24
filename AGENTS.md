# AGENTS Instructions for liar-game

## Purpose
- This repository stores project-local Codex skills under `.codex/skills`.
- Codex Web and desktop should use the same project-local skill files.

## Skills
### Available project-local skills
- `ui-ux-pro-max`: UI/UX design and implementation helper.
  - file: `.codex/skills/ui-ux-pro-max/SKILL.md`

## Skill usage rules
- If the user explicitly mentions `$ui-ux-pro-max`, use that skill for the turn.
- If the task is clearly UI/UX design-system work, prefer this local skill first.
- Resolve any relative paths from the skill directory.
- Keep generated artifacts and edits inside this repository unless requested otherwise.

## Commit policy for this repository
- When a task unit is complete, create a separate, detailed commit message per unit.
- Keep app code commits and docs/skills commits separated when possible.
