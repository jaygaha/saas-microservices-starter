#!/usr/bin/env bash
set -euo pipefail

# Change values as necessary according to config
B=${BASE:-http://localhost:8020}/api/auth
OWNER=${OWNER:-alice@example.com}
OWNER_PASS=${OWNER_PASS:-supersecret}
OUT=${OUT:-bob@example.com}
OUT_PASS=${OUT_PASS:-supersecret}
SLUG=${SLUG:-acme-inc}
CT='Content-Type: application/json'
DC="docker compose -f infra/compose.yaml --env-file .env"

login() {
    curl -s -X POST "$B/login" -H "$CT" \
        -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
        | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'
}

psql_q() {
    $DC exec -T postgres psql -U saas_admin -d saas_platform_db -tAc "$1"
}

# gcode URL [BEARER] -> HTTP status of a GET
gcode() {
    local a=(-s -o /dev/null -w '%{http_code}' "$1")
    [ -n "${2:-}" ] && a+=(-H "Authorization: Bearer $2")
    curl "${a[@]}"
}

owner=$(login "$OWNER" "$OWNER_PASS")
[ -n "$owner" ] || { echo "owner login failed"; exit 1; }

# ensure a non-member exists, then log them in
curl -s -o /dev/null -X POST "$B/register" -H "$CT" \
-d "{\"email\":\"$OUT\",\"password\":\"$OUT_PASS\",\"full_name\":\"Outsider\"}" || true
outsider=$(login "$OUT" "$OUT_PASS")

TID=$(psql_q "SELECT id FROM teams WHERE slug='$SLUG' LIMIT 1;" | tr -d '[:space:]')
[ -n "$TID" ] || { echo "no team with slug '$SLUG' — create one first"; exit 1; }
echo "team: $TID ($SLUG)"

M="$B/teams/$TID/members"
echo "list (owner):    $(gcode "$M" "$owner")   (want 200)"
echo "  members: $(curl -s "$M" -H "Authorization: Bearer $owner")"
echo "list (outsider): $(gcode "$M" "$outsider")   (want 403)"
echo "list (no token): $(gcode "$M")   (want 401)"
