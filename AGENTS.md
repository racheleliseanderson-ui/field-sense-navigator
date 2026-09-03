# Agent instructions — Field Sense Navigator

The instructions for this repository live in **[`AGENTS.project.md`](./AGENTS.project.md)**.
Read that file before changing anything here.

This file exists because some tools look for `AGENTS.md` by name and stop when
they find it. It was empty, so those tools found nothing and carried on with no
instructions at all — worse than an absent file, because it looked answered.

Two rules are worth repeating here so nobody has to open a second file to learn
them:

- `src/lib/hth-packet.ts` and `src/lib/fleet.ts` are **copied verbatim into
  seven repositories**. They take no imports outside the standard library, and a
  change to either is a fleet-wide change: edit it here, re-copy it, and update
  `docs/PACKET-CONTRACT.md`. Both must stay prettier-clean.
- Every user-facing string is governed by `docs/HUNTER-VOICE-AUTHORITY.md`.
  Read it before writing copy, not after.
