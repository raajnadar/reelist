#!/usr/bin/env bash
# Checks a running proxy: the paths that must work, and the ones that must not.
#
# Usage:
#   ./smoke.sh                                  # tests http://localhost:3000/api/tmdb
#   ./smoke.sh https://your-app.vercel.app/api/tmdb
#
# Works against a local `vercel dev` and against a deployed URL.

set -u
BASE="${1:-http://localhost:3000/api/tmdb}"
pass=0
fail=0

check() {
  local want="$1" query="$2" label="$3"
  local got
  got=$(curl -s -o /tmp/smoke-body.json -w '%{http_code}' --max-time 20 "$BASE?$query")
  if [ "$got" = "$want" ]; then
    printf '  ok    %-34s %s\n' "$label" "$got"
    pass=$((pass + 1))
  else
    printf '  FAIL  %-34s got %s, wanted %s\n' "$label" "$got" "$want"
    head -c 120 /tmp/smoke-body.json
    echo
    fail=$((fail + 1))
  fi
}

echo "Testing $BASE"
echo

# Check the setup first. Without this, a missing or wrong key shows up as six
# confusing failures further down instead of one clear line here.
setup=$(curl -s -o /tmp/smoke-setup.json -w '%{http_code}' --max-time 20 \
  "$BASE?path=/movie/popular")
case "$setup" in
  500)
    echo 'The proxy has no TMDB_API_KEY.'
    echo 'Put it in proxy/.env.local as TMDB_API_KEY=<your key>, then restart'
    echo 'the server. For a deployment, run: vercel env add TMDB_API_KEY production'
    exit 1
    ;;
  401)
    echo 'TMDB refused the key. Check it at themoviedb.org/settings/api.'
    echo 'Use the v3 API key, which is 32 characters, not the longer v4 token.'
    exit 1
    ;;
  000)
    echo "Nothing answered at $BASE. Is the server running?"
    exit 1
    ;;
esac

echo "These must work:"
check 200 'path=/trending/movie/week' 'trending'
check 200 'path=/movie/popular' 'popular'
check 200 'path=/movie/top_rated' 'top rated'
check 200 'path=/movie/550' 'one film'
check 200 'path=/search/movie&query=dune' 'search'

echo
echo "These must be refused:"
check 403 'path=/account' 'a path the app does not use'
check 403 'path=/authentication/token/new' 'an auth endpoint'
check 403 'path=/movie/550/../../account' 'a traversal attempt'
check 403 'path=/movie/abc' 'a non-numeric id'
check 400 '' 'no path'
check 404 'path=/movie/99999999' 'a film that does not exist'

echo
echo "The rate limit:"
# Sends more requests than the per-minute allowance and expects a 429. Each one
# uses a different query so the edge cache cannot answer it — a cached response
# never reaches the function, so it is never counted.
#
# This is skipped against localhost. `vercel dev` sets no client IP header, so
# the limit deliberately does not count there. Run it against a deployment.
case "$BASE" in
  *localhost*|*127.0.0.1*)
    echo '  skip  not counted locally — vercel dev sets no IP header'
    ;;
  *)
    limited=0
    for i in $(seq 1 40); do
      code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
        "$BASE?path=/search/movie&query=ratelimitprobe$i")
      if [ "$code" = "429" ]; then
        limited=1
        break
      fi
    done
    if [ "$limited" = "1" ]; then
      printf '  ok    %-34s refused after %s requests\n' 'over the limit' "$i"
      pass=$((pass + 1))
    else
      echo '  FAIL  40 requests were all allowed — is UPSTASH_REDIS_REST_URL set?'
      echo '        The limit fails open by design when Redis is not configured.'
      fail=$((fail + 1))
    fi
    ;;
esac

echo
echo "The key must not come back:"
# The proxy answers with TMDB data, which never contains the key. A 32-character
# hex string in the body would mean the key leaked into the response.
#
# The status is checked first. A Vercel error page carries a hex request id of
# the same shape — bom1::965jp-1786839904867-e9d6d398eaba — so scanning the body
# of a failed request reports a leak that is not there. That false alarm cost
# real time once; the guard below is why it will not happen again.
keybody=$(curl -s -o /tmp/smoke-key.txt -w '%{http_code}' --max-time 20 \
  "$BASE?path=/movie/popular")
body=$(cat /tmp/smoke-key.txt)
if [ "$keybody" != "200" ]; then
  echo "  skip  the request failed with $keybody — fix that first, then re-run"
  echo '        (a Vercel error page has a hex id that looks like a key)'
elif echo "$body" | grep -qE '[0-9a-f]{32}'; then
  echo '  FAIL  a 32-character hex string came back — check for a leak'
  fail=$((fail + 1))
else
  echo '  ok    no key-shaped string in the response'
  pass=$((pass + 1))
fi

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
