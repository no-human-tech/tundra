# ADR-0017: Image publishing on GitHub Actions, Jenkins retired

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The container image was built and pushed by a Jenkins multibranch pipeline
(`no-human.tech/tundra`, root `Jenkinsfile`). Getting it to work surfaced a
chain of friction that GitHub-hosted CI simply does not have:

- GHCR does not let GitHub App installation tokens **create** packages, and a
  PAT-created package does not grant the App **write** — both had to be fixed
  manually (one-time PAT push, then per-package repository access).
- The Jenkins controller and workers are internal infrastructure that needed
  worker prerequisites, JCasC job definitions and GitHub App credentials kept
  in sync for a single repository's build.
- Quality gates already ran twice (GitHub Actions `ci.yml` and the Jenkins
  Walidacja stage).

Meanwhile the intended Jenkins CD stage (migrate → set image → rollout) never
activated, because the scoped deployer kubeconfig was never provisioned to the
workers.

## Decision

`.github/workflows/docker.yml` builds `infra/docker/Dockerfile.app` on every
push and pull request and pushes `latest` + `sha-<12>` tags to
`ghcr.io/no-human-tech/tundra/app` on pushes to `main`, authenticating with
the workflow's `GITHUB_TOKEN` (the repository has Write access on the
package). PR runs build without pushing, which still exercises the Docker
build, the Vite production build and both `tsc` gates.

The `Jenkinsfile` is deleted and the `no-human.tech/tundra` multibranch job is
removed from the infra JCasC definition.

Cluster rollout stays manual (infra repo README sequence) until a deploy path
that can reach the internal API server exists — a pull-based operator
(Flux/Argo) or a self-hosted runner with the `tundra-deployer`
ServiceAccount; that choice is deferred.

## Consequences

- One CI system: every gate and the image build are visible on the PR itself.
- No credentials to maintain for CI: `GITHUB_TOKEN` is scoped to the run and
  the package access is declared once in package settings.
- Jenkins keeps serving repositories that need internal-network access;
  Tundra no longer depends on it.
- Deploys are not yet continuous — the rollout runbook is the infra repo
  README until the deferred CD decision lands.
