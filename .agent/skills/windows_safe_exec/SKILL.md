---
name: Windows Safe Execution
description: Instructions for checking and fixing trailing quote bugs in Windows command execution
---

# Windows Safe Execution Skill

## Problem
In some Windows environments, `run_command` calls may have an erroneous trailing double-quote appended to the command string (e.g., `dir` becomes `dir"`). This causes commands to fail with syntax errors or "command not found".

## Detection
If a simple command like `dir` fails with an error indicating `dir"` is not found, this bug is present.

## Solution
Append ` & REM` (or ` & echo ignore`) to the end of every command.
This neutralizes the trailing quote by turning it into a benign argument to the `REM` (remark/comment) command.

### Example
Instead of:
```cmd
git status
```
Use:
```cmd
git status & REM
```

## Usage
When this skill is active, the agent should automatically apply this suffix to `CommandLine` arguments in `run_command` calls if the environment is known to be affected.
