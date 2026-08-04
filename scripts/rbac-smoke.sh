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

# gcode URL [BEARER] -> GET status
gcode() {
    local a=(-s -o /dev/null -w '%{http_code}' "$1")
    [ -n "${2:-}" ] && a+=(-H "Authorization: Bearer $2")
    curl "${a[@]}"
}

# pcode BEARER JSON -> POST status to $M
pcode() {
    curl -s -o /dev/null -w '%{http_code}' -X POST "$M" \
            -H "Authorization: Bearer $1" -H "$CT" -d "$2"
}

owner=$(login "$OWNER" "$OWNER_PASS")
[ -n "$owner" ] || { echo "owner login failed"; exit 1; }

curl -s -o /dev/null -X POST "$B/register" -H "$CT" \
    -d "{\"email\":\"$OUT\",\"password\":\"$OUT_PASS\",\"full_name\":\"Outsider\"}" || true
outsider=$(login "$OUT" "$OUT_PASS")

TID=$(psql_q "SELECT id FROM teams WHERE slug='$SLUG' LIMIT 1;" | tr -d '[:space:]')
M="$B/teams/$TID/members"
echo "team: $TID ($SLUG)"

# reset: ensure the outsider is NOT a member yet (deterministic reruns)
OID=$(psql_q "SELECT id FROM users WHERE email='$OUT' LIMIT 1;" | tr -d '[:space:]')
psql_q "DELETE FROM team_members WHERE team_id='$TID' AND user_id='$OID';" >/dev/null

echo "-- list --"
echo "  owner:      $(gcode "$M" "$owner")   (want 200)"
echo "  members:    $(curl -s "$M" -H "Authorization: Bearer $owner")"
echo "  outsider:   $(gcode "$M" "$outsider")   (want 403)"
echo "  no token:   $(gcode "$M")   (want 401)" 

echo "-- add member --"
c1=$(pcode "$owner" "{\"email\":\"$OUT\",\"role\":\"member\"}")
c2=$(pcode "$owner" "{\"email\":\"$OUT\",\"role\":\"member\"}")
c3=$(pcode "$owner" '{"email":"nobody@example.com","role":"member"}')
c4=$(pcode "$owner" '{"email":"carol@example.com","role":"owner"}')
c5=$(pcode "$outsider" "{\"email\":\"$OWNER\",\"role\":\"member\"}")
echo "  owner adds:  $c1   (want 201)"
echo "  dup add:     $c2   (want 409)"
echo "  unknown:     $c3   (want 404)"
echo "  role=owner:  $c4   (want 400)"
echo "  member adds: $c5   (want 403)"