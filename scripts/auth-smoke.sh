#!/usr/bin/env bash
  set -euo pipefail

  B=${BASE:-http://localhost:8020}/api/auth
  EMAIL=${EMAIL:-alice@example.com}
  PASS=${PASS:-supersecret}
  CT='Content-Type: application/json'

  # status METHOD URL [JSON]  ->  prints the HTTP status code
  status() {
        if [ -n "${3:-}" ]; then
                curl -s -o /dev/null -w '%{http_code}' -X "$1" "$2" -H "$CT" -d "$3"
        else
                curl -s -o /dev/null -w '%{http_code}' -X "$1" "$2"
        fi
  }

  login=$(curl -s -X POST "$B/login" -H "$CT" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
  access=$(printf '%s' "$login"  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
  refresh=$(printf '%s' "$login" | sed -n 's/.*"refresh_token":"\([^"]*\)".*/\1/p')
  [ -n "$access" ] || { echo "login FAILED: $login"; exit 1; }
  echo "login:        ok"

  echo "me (token):   $(curl -s "$B/me" -H "Authorization: Bearer $access")"
  echo "me (none):    $(status GET "$B/me")   (want 401)"

  new=$(curl -s -X POST "$B/refresh" -H "$CT" -d "{\"refresh_token\":\"$refresh\"}")
  printf '%s' "$new" | grep -q access_token && echo "refresh:      ok (rotated)" || { echo "refresh
  FAILED: $new"; exit 1; }
  newref=$(printf '%s' "$new" | sed -n 's/.*"refresh_token":"\([^"]*\)".*/\1/p')

  echo "reuse old:    $(status POST "$B/refresh" "{\"refresh_token\":\"$refresh\"}")   (want 401)"
  echo "logout:       $(status POST "$B/logout" "{\"refresh_token\":\"$newref\"}")   (want 204)"
  echo "after logout: $(status POST "$B/refresh" "{\"refresh_token\":\"$newref\"}")   (want 401)"
  