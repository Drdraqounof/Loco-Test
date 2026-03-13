# OpenClaw Notes

> **Last Updated:** March 9, 2026 at 2:02 PM

## Overview

This document records why OpenClaw was added to the workflow, how it was installed on this machine, what it is useful for, and what remains to finish setup.

OpenClaw was discussed as an additional AI assistant option alongside Loco. It is not currently wired into Loco as a chat provider. At this point it should be treated as a separate assistant/runtime that can be used in parallel with this project.

## Why It Was Added

OpenClaw was added for evaluation as a more general-purpose personal agent workflow.

Reasons it was added:
- To test a second assistant environment outside the current Loco chat flow.
- To evaluate persistent memory, tool use, and multi-channel assistant workflows.
- To compare OpenClaw's personal-agent model against Loco's in-app coding assistant design.
- To keep the option open for future integration work if a stable adapter or supported API path becomes available.

## Installation Status

OpenClaw was installed successfully on Windows using the official PowerShell installer.

Installer path used:

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

Observed result:
- Windows detected successfully.
- Node.js v22.19.0 was already available.
- `openclaw@latest` installed successfully.
- Installed version reported: `OpenClaw 2026.3.8 (3caab92)`.

Important note:
- The onboarding wizard launched after installation.
- Setup was cancelled at the security confirmation prompt.
- This means the CLI is installed, but onboarding and gateway configuration were not completed in that run.

## Windows Guidance

OpenClaw's documentation recommends running it through WSL2 on Windows rather than relying on native Windows execution.

Key points from the official docs:
- WSL2 with Ubuntu is the recommended Windows path.
- `wsl --install` is the recommended starting point if WSL is not already set up.
- Gateway/service setup is expected to run inside WSL.
- Native Windows may work for some cases, but the docs explicitly describe it as trickier.

Relevant documentation:
- Getting started: `https://docs.openclaw.ai/start/getting-started`
- Windows guide: `https://docs.openclaw.ai/platforms/windows`

## What OpenClaw Is Useful For

Based on the product/docs reviewed during setup, OpenClaw is aimed at broader personal-agent tasks than Loco's current in-app assistant model.

Common uses:
- Persistent personal assistant workflows.
- Browser control and web tasks.
- File access and shell execution.
- Calendar and inbox style automation.
- Chat through external channels such as WhatsApp, Telegram, Discord, Slack, Signal, or iMessage.
- Running a gateway and browser dashboard/control UI.

Useful commands mentioned in the docs:

```bash
openclaw onboard --install-daemon
openclaw gateway status
openclaw dashboard
openclaw doctor
openclaw security audit --deep
openclaw security audit --fix
```

## Security Note

The onboarding flow presents a strong warning that OpenClaw is personal-by-default and not a hardened multi-user boundary unless it is explicitly locked down.

That matters because OpenClaw can be configured to:
- Read files.
- Run commands.
- Use tools with real side effects.

Practical implication:
- Do not expose a tool-enabled OpenClaw instance casually.
- Treat it as a trusted local/personal agent unless proper access control and sandboxing are configured.

## Relationship To Loco

Current status:
- OpenClaw is installed separately.
- Loco still uses its own existing provider flow.
- No OpenClaw adapter has been added to Loco yet.

Why that matters:
- Loco continues to operate normally with its existing chat and calendar logic.
- OpenClaw can be explored independently without changing Loco's runtime behavior.
- Any future OpenClaw-to-Loco integration should be treated as a separate implementation task.

## Next Steps

If setup continues later, the recommended path is:

1. Install or verify WSL2 on Windows.
2. Run OpenClaw inside WSL if following the documented Windows path.
3. Complete onboarding with `openclaw onboard --install-daemon`.
4. Verify gateway health with `openclaw gateway status`.
5. Open the dashboard with `openclaw dashboard`.
6. Decide whether OpenClaw should remain a separate assistant or whether Loco should eventually integrate with it.

## Summary

OpenClaw was added as a separate assistant option for evaluation. The CLI install succeeded, but onboarding was cancelled before gateway setup was completed. On Windows, the official recommendation is to run the full OpenClaw workflow through WSL2.