#!/usr/bin/env bash
# Runs on the IFSMHP API server. Uses the server's existing environment.
# Does not print secrets, seed the database, or change DNS.
set -euo pipefail

cd /opt/ifsmhp

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "The server checkout has tracked changes. Refusing to deploy." >&2
  exit 1
fi

before="$(git rev-parse HEAD)"
git fetch origin main
git checkout main
git merge --ff-only origin/main
after="$(git rev-parse HEAD)"

npm ci --prefix backend

if git diff --name-only "$before" "$after" | grep -q '^backend/database/prisma/migrations/'; then
  echo "Prisma migrations changed. Applying db:deploy."
  npm --prefix backend run db:deploy
else
  echo "No Prisma migration in this range. Skipping db:deploy."
fi

npm --prefix backend run build

while IFS= read -r asset; do
  if [ ! -f "$asset" ]; then
    echo "Runtime asset missing after checkout: $asset" >&2
    exit 1
  fi
done < <(git ls-files backend/assets)

sudo -n systemctl restart ifsmhp-api
echo "API service restarted at $after"
