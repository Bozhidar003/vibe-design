# Vibe Design — Claude Code Skill

When you see "design task" or are pointed at DESIGN_TASK.md:

1. Read `.vibe/tasks/DESIGN_TASK.md` fully — intent section first
2. If screenshots are present, view them to understand the visual problem
3. Read relevant skills:
   - `.vibe/skills/TAILWIND.md` — always read for Tailwind projects
   - `.vibe/skills/COMPONENTS.md` — read if component library detected
   - `.vibe/skills/CONVENTIONS.md` — always read
4. Open the target file at the specified line
5. Consider the enrichment context and computed styles
6. Make the minimal change that satisfies the design intent
7. Respect all constraints listed in the task
8. If the component is shared (used in multiple files):
   - Check that the change works across all usage locations
   - If change would break other usages, create a variant instead
9. After changes:
   - Update DESIGN_TASK.md status to "done"
   - Add "Changes Made" section describing what changed and why
   - Note any convention violations that were fixed
10. Never change component APIs (props interface) without noting it
11. Prefer project conventions (semantic tokens, CVA patterns) over ad-hoc classes
