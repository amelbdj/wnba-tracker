#!/bin/sh
# Vercel "Ignored Build Step" (see ignoreCommand in vercel.json).
#   exit 0 -> skip this deployment
#   exit 1 -> build and deploy
#
# The deployment quota is limited, so a push that only touches files the site
# doesn't ship (README, tests, CI config, design sources) shouldn't use one.
#
# What changed is measured against the last commit that was actually deployed
# on this branch ($VERCEL_GIT_PREVIOUS_SHA), not just the latest commit: a
# single push can carry several commits, and judging only the last one could
# skip a deployment that contains real changes. Whenever that can't be worked
# out, build — a needless deployment is better than a missed one.

IGNORED='^(README\.md|design/.*|\.github/.*|vitest\.config\.js|.*\.test\.js)$'

[ -n "$VERCEL_GIT_PREVIOUS_SHA" ] || { echo "No previous deployment: building."; exit 1; }

# Vercel clones shallowly; try to bring in the previous commit if it's missing.
git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA^{commit}" 2>/dev/null ||
  git fetch --quiet --depth=200 origin "$VERCEL_GIT_PREVIOUS_SHA" 2>/dev/null
git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA^{commit}" 2>/dev/null ||
  { echo "Previous deployment not in this clone: building."; exit 1; }

CHANGED=$(git diff --name-only "$VERCEL_GIT_PREVIOUS_SHA" HEAD) ||
  { echo "Could not compare with the previous deployment: building."; exit 1; }

if [ -z "$CHANGED" ]; then
  echo "Nothing changed since the last deployment: skipping."
  exit 0
fi

if echo "$CHANGED" | grep -Evq "$IGNORED"; then
  echo "Files that ship with the site changed: building."
  exit 1
fi

echo "Only README, tests, CI or design files changed: skipping."
exit 0
