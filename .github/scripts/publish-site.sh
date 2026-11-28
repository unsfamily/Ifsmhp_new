#!/usr/bin/env bash
# Builds the public site and publishes it. Does not change DNS or print secrets.
set -euo pipefail

: "${EC2_SSH_KEY:?Set the EC2_SSH_KEY secret}"
: "${HOSTINGER_FTP_USER:?Set the HOSTINGER_FTP_USER secret}"
: "${HOSTINGER_FTP_PASSWORD:?Set the HOSTINGER_FTP_PASSWORD secret}"

host="${HOSTINGER_FTP_HOST:-ftp.ifsmhp.com}"
remote_dir="${HOSTINGER_FTP_PATH:-public_html}"
api_host="100.52.212.133"
key_file="$(mktemp)"
trap 'rm -f "$key_file" "$HOME/.netrc"' EXIT

umask 077
printf '%s\n' "$EC2_SSH_KEY" | tr -d '\r' > "$key_file"
chmod 600 "$key_file"
printf 'machine %s\nlogin %s\npassword %s\n' "$host" "$HOSTINGER_FTP_USER" "$HOSTINGER_FTP_PASSWORD" > "$HOME/.netrc"
chmod 600 "$HOME/.netrc"

export VITE_API_BASE_URL="https://api.ifsmhp.com/api/v1"
npm ci
npm ci --prefix backend
npm ci --prefix frontend
npm --prefix frontend run build

if grep -R -q 'http://localhost:4000' frontend/dist; then
  echo "The production bundle contains the local API URL." >&2
  exit 1
fi
if ! grep -R -q 'https://api.ifsmhp.com/api/v1' frontend/dist; then
  echo "The production bundle is missing the public API URL." >&2
  exit 1
fi

install -m 700 -d "$HOME/.ssh"
ssh-keyscan -H "$api_host" >> "$HOME/.ssh/known_hosts"
rsync -az --delete \
  -e "ssh -i ${key_file} -o IdentitiesOnly=yes" \
  frontend/dist/ "ubuntu@${api_host}:/opt/ifsmhp/frontend/dist/"

# Hostinger's certificate is for its own FTP hostname, not ftp.ifsmhp.com.
lftp -e "set net:max-retries 2; set ftp:ssl-allow true; set ssl:verify-certificate no; set cmd:trace no; lcd frontend/dist; cd ${remote_dir}; mirror -R --parallel=2 .; bye" "$host"

echo "Published the site bundle to /opt/ifsmhp/frontend/dist and Hostinger ${remote_dir}."
