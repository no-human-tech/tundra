# Security Policy

Tundra is an **early source-available foundation**. The monorepo, package boundaries,
and domain contracts are still being established, and there is **no hardened
production security posture yet**. Authentication and authorization are
intentionally stubbed at this stage (the model defines the seams, but enforcement
is deferred). Please keep this in mind when evaluating or deploying Tundra: it is
not yet intended for handling sensitive or production data.

## Supported versions

Tundra has not reached a stable release. There are no long-term supported
versions during the pre-release/foundation phase.

| Version                           | Supported   |
| --------------------------------- | ----------- |
| `main` (pre-release / foundation) | Best effort |
| Tagged releases                   | None yet    |

Security fixes, when applicable, are applied to the `main` branch.

## Reporting a vulnerability

Please report security issues **privately**. Do **not** open a public issue,
pull request, or discussion for a suspected vulnerability.

- **Email:** admin@no-human.tech

Include as much detail as you can:

- a description of the issue and its potential impact,
- the affected component or file path,
- steps to reproduce (a minimal proof of concept is ideal), and
- any suggested remediation if you have one.

### What to expect

- We aim to **acknowledge** your report within a few business days.
- We will investigate and keep you informed of progress.
- Because Tundra is a volunteer-driven, pre-release project, response and fix
  timelines are best-effort and may vary.
- Please give us a reasonable opportunity to address the issue before any public
  disclosure, and we will credit you (if you wish) once a fix is available.

## No secrets in the repository

Tundra has a strict **no-secrets-in-the-repo** policy:

- Never commit credentials, API tokens, private keys, or any real secret.
- Local configuration goes in a `.env` file, which is **git-ignored**.
- The committed `.env.example` is the documented template: it lists every
  required environment variable with safe, non-secret local defaults. Copy it to
  `.env` (`cp .env.example .env`) and fill in local values there.

If you discover a committed secret, treat it as a vulnerability: report it
privately using the contact above, and assume the secret must be rotated.

## Scope and expectations

This policy covers the code in this repository. Because Tundra is an early
foundation:

- there is no production deployment, managed infrastructure, or secrets-management
  story in scope yet;
- security hardening (real auth/authz enforcement, sandboxing of untrusted
  modules, observability) is future work;
- reports that help shape a stronger baseline are very welcome.
