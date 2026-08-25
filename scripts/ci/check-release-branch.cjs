#!/usr/bin/env node
/**
 * Guard against running the local `release*` npm scripts (standard-version + tag + push)
 * from anything other than the `develop` release branch.
 *
 * Why this exists: the GitHub Actions workflow (.github/workflows/develop-release.yml) has
 * always correctly restricted itself to `push: branches: [develop]`, but nothing stopped a
 * developer from running `npm run release:BE` (etc.) locally while sitting on a feature
 * branch. That's exactly what happened on `develop-av-currency-filter`, which picked up
 * `chore(release): 1.1.0-beta.36` / `beta.37` commits and burned real version numbers on
 * work that was never merged into `develop`.
 *
 * In CI (this same script also fronts `release:BE:version:as`, which the workflow calls
 * after checking out a throwaway `ci/release-<run_id>` branch off `develop`), we trust the
 * workflow's own `on.push.branches: [develop]` trigger and skip the branch-name check.
 */
'use strict';

const { execSync } = require('child_process');

const RELEASE_BRANCH = 'develop';

function currentBranch() {
  return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
}

// GitHub Actions (and most CI providers) set CI=true. The workflow that drives this script
// already gates on `push.branches: [develop]`, so trust it here instead of re-deriving the
// original branch from the throwaway `ci/release-<run_id>` branch it checks out.
if (process.env.CI === 'true' || process.env.CI === '1') {
  process.exit(0);
}

const branch = currentBranch();
if (branch !== RELEASE_BRANCH) {
  console.error(
    `\nRefusing to release from branch "${branch}".\n` +
      `Releases (version bump, tag, push) must be run from "${RELEASE_BRANCH}" — ` +
      `not from a feature branch.\n` +
      `Checkout "${RELEASE_BRANCH}" first, or let the develop-release.yml workflow ` +
      `handle it on push.\n`
  );
  process.exit(1);
}
