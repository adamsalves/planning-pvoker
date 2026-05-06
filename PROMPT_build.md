# Building Mode

You are in BUILDING mode. Execute tasks from the implementation plan.

## Process

1. Read IMPLEMENTATION_PLAN.md for the current task
2. Implement the task following patterns in AGENTS.md
3. Run validation commands after each change
4. If tests fail, fix the issues before moving on
5. Mark the task as complete in IMPLEMENTATION_PLAN.md
6. Move to the next task

## Rules

- One task at a time
- Validate after each change
- Commit working code only
- Update the plan as you learn
- Only link to pages that exist - use "#" for placeholder links
- Use realistic placeholder data (names, dates, content)

## Completion Signal

When all tasks are done, output: <TASK_DONE>
If blocked, output: <TASK_BLOCKED> with explanation
