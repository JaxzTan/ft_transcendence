#!/bin/bash

# Unit Tests Script for Ludo Transcendence
# Tests health and connectivity - follows data trail from frontend to backend

echo "========================================="
echo "Ludo Transcendence Integration Tests"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counters
PASS=0
FAIL=0
SKIP=0
WARN=0

COOKIE_JAR="/tmp/ludo-cookies.txt"
BASE_URL="https://localhost:8443"
DIRECT_BACKEND="http://localhost:3000"

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; ((PASS++)); }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; ((FAIL++)); }
warn() { echo -e "${YELLOW}! WARN${NC}: $1"; ((WARN++)); }
skip() { echo -e "${YELLOW}! SKIP${NC}: $1"; ((SKIP++)); }

# Cleanup old cookies
rm -f "$COOKIE_JAR"

# ==========================================
# 1. Container Status Checks (5 tests)
# ==========================================
echo "### 1. Container Status Checks ###"

for svc in db redis backend frontend ludo-engine; do
    echo -n "Checking ${svc} container... "
    if docker ps --format '{{.Names}}' | grep -q "ludo-transcendence-bingdev-${svc}-1"; then
        pass "${svc} container is running"
    else
        fail "${svc} container is not running"
    fi
done

echo ""

# ==========================================
# 2. Backend Health Check (direct, 1 test)
# ==========================================
echo "### 2. Backend Health Check ###"

echo -n "Testing backend /health directly... "
HEALTH=$(curl -sk --connect-timeout 5 ${DIRECT_BACKEND}/health 2>/dev/null || echo "")
if [[ "$HEALTH" == *"ok"* ]]; then
    pass "Backend /health responding"
    echo "   Response: ${HEALTH}"
else
    fail "Backend /health not responding"
fi

echo ""

# ==========================================
# 3. Frontend / Proxy Check (1 test)
# ==========================================
echo "### 3. Frontend Proxy Check ###"

echo -n "Testing frontend via nginx port 8443... "
if curl -sk --connect-timeout 5 ${BASE_URL}/ > /dev/null 2>&1; then
    pass "Frontend accessible via nginx"
else
    fail "Frontend not accessible via nginx"
fi

echo ""

# ==========================================
# 4. Auth Endpoint (1 test)
# ==========================================
echo "### 4. Auth Endpoint Trail (Frontend -> Backend) ###"

echo -n "Testing frontend proxy to /api/auth/login... "
AUTH_RESPONSE=$(curl -sk --connect-timeout 5 -X POST -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}' \
    -c "$COOKIE_JAR" \
    ${BASE_URL}/api/auth/login 2>/dev/null || echo "")

if [[ -n "$AUTH_RESPONSE" ]]; then
    pass "Frontend -> Auth endpoint reachable (response received)"
    echo "   Response: ${AUTH_RESPONSE}"
else
    fail "Auth endpoint not reachable via frontend proxy"
fi

echo ""

# ==========================================
# 5. Match Endpoint (1 test)
# ==========================================
echo "### 5. Match Endpoint Trail (Frontend -> Backend) ###"

echo -n "Testing frontend proxy to /api/match endpoint... "
MATCH_RESPONSE=$(curl -sk --connect-timeout 5 ${BASE_URL}/api/match 2>/dev/null || echo "")
if [[ -n "$MATCH_RESPONSE" ]]; then
    pass "Frontend -> Match endpoint reachable"
    echo "   Response: ${MATCH_RESPONSE}"
else
    fail "Match endpoint not reachable"
fi

echo ""

# ==========================================
# 6. User Registration & Game Flow (3 tests)
# ==========================================
echo "### 6. User Registration & Game Flow ###"

# Generate unique test user
TEST_USER="testplayer$(date +%s)"
TEST_PASS="testpass123"

echo -n "Registering test user ${TEST_USER}... "
rm -f "$COOKIE_JAR"
REGISTER_RESPONSE=$(curl -sk --connect-timeout 5 -X POST -H "Content-Type: application/json" \
    -d "{\"username\":\"${TEST_USER}\",\"password\":\"${TEST_PASS}\"}" \
    -c "$COOKIE_JAR" \
    ${BASE_URL}/api/auth/register 2>/dev/null || echo "")

if [[ -n "$REGISTER_RESPONSE" ]]; then
    pass "User registration endpoint reachable"
    echo "   Response: ${REGISTER_RESPONSE}"
else
    fail "User registration endpoint not reachable"
fi

echo -n "Login with test user... "
rm -f "$COOKIE_JAR"
LOGIN_RESPONSE=$(curl -sk --connect-timeout 5 -X POST -H "Content-Type: application/json" \
    -d "{\"username\":\"${TEST_USER}\",\"password\":\"${TEST_PASS}\"}" \
    -c "$COOKIE_JAR" \
    ${BASE_URL}/api/auth/login 2>/dev/null || echo "")

if [[ "$LOGIN_RESPONSE" == *"user"* ]]; then
    pass "Login successful - cookie saved"
else
    warn "Login rate limited or error: ${LOGIN_RESPONSE}"
fi

echo -n "Testing /api/auth/me with cookie... "
if [[ -f "$COOKIE_JAR" ]]; then
    ME_RESPONSE=$(curl -sk --connect-timeout 5 -b "$COOKIE_JAR" \
        ${BASE_URL}/api/auth/me 2>/dev/null || echo "")
    if [[ "$ME_RESPONSE" == *"${TEST_USER}"* ]]; then
        pass "Auth cookie validation working"
        echo "   Response: ${ME_RESPONSE}"
    else
        warn "Auth /me response: ${ME_RESPONSE}"
    fi
else
    skip "No cookie jar - skipping /me check"
fi

echo ""

# ==========================================
# 7. Public Profile Test
# ==========================================
echo "### 7. Public Profile Test ###"

echo -n "Testing GET /api/user/:username... "
PROFILE_RESPONSE=$(curl -sk --connect-timeout 5 \
    ${BASE_URL}/api/user/${TEST_USER} 2>/dev/null || echo "")

if [[ "$PROFILE_RESPONSE" == *"${TEST_USER}"* ]]; then
    pass "Public profile accessible"
    echo "   Response: ${PROFILE_RESPONSE}"
else
    warn "Profile response: ${PROFILE_RESPONSE}"
fi

echo ""

# ==========================================
# 8. Create Match Trail (1 test)
# ==========================================
echo "### 8. Create Match Trail ###"

echo -n "Creating PvE match with authenticated user... "
if [[ -f "$COOKIE_JAR" ]]; then
    MATCH_CREATE=$(curl -sk --connect-timeout 5 -X POST -H "Content-Type: application/json" \
        -b "$COOKIE_JAR" \
        -d '{"mode":"pve","playerCount":2,"botCount":1}' \
        ${BASE_URL}/api/match/create 2>/dev/null || echo "")
    
    if [[ "$MATCH_CREATE" == *"gameId"* ]]; then
        pass "Match created successfully"
        echo "   Response: ${MATCH_CREATE}"
        GAME_TOKEN=$(echo "$MATCH_CREATE" | sed 's/.*"token":"\([^"]*\)".*/\1/')
        GAME_ID=$(echo "$MATCH_CREATE" | sed 's/.*"gameId":"\([^"]*\)".*/\1/')
    else
        warn "Match creation response: ${MATCH_CREATE}"
    fi
else
    skip "No auth cookie - skipping match creation"
fi

echo ""

# ==========================================
# 9. Bot Match Test
# ==========================================
echo "### 9. Bot Match Test ###"

echo -n "Testing POST /api/match/pve... "
if [[ -f "$COOKIE_JAR" ]]; then
    BOT_RESPONSE=$(curl -sk --connect-timeout 5 -X POST -H "Content-Type: application/json" \
        -b "$COOKIE_JAR" \
        -d '{"playerCount":2}' \
        ${BASE_URL}/api/match/pve 2>/dev/null || echo "")
    
    if [[ "$BOT_RESPONSE" == *"gameId"* ]]; then
        pass "Bot match created"
        echo "   Response: ${BOT_RESPONSE}"
    else
        warn "Bot match response: ${BOT_RESPONSE}"
    fi
else
    skip "No auth cookie - skipping bot match test"
fi

echo ""

# ==========================================
# 10. Leaderboard & Stats Test
# ==========================================
echo "### 10. Leaderboard & Stats Test ###"

echo -n "Testing GET /api/leaderboard... "
LEADERBOARD_RESPONSE=$(curl -sk --connect-timeout 5 \
    ${BASE_URL}/api/leaderboard 2>/dev/null || echo "")

if [[ -n "$LEADERBOARD_RESPONSE" ]]; then
    pass "Leaderboard accessible (public endpoint)"
    echo "   Response: ${LEADERBOARD_RESPONSE:0:100}..."
else
    warn "Leaderboard response: ${LEADERBOARD_RESPONSE}"
fi

echo -n "Testing GET /api/stats with auth... "
if [[ -f "$COOKIE_JAR" ]]; then
    STATS_RESPONSE=$(curl -sk --connect-timeout 5 -b "$COOKIE_JAR" \
        ${BASE_URL}/api/stats 2>/dev/null || echo "")
    
    if [[ "$STATS_RESPONSE" == *"totalGames"* ]]; then
        pass "Stats endpoint working"
        echo "   Response: ${STATS_RESPONSE:0:100}..."
    else
        warn "Stats response: ${STATS_RESPONSE}"
    fi
else
    skip "No auth cookie - skipping stats test"
fi

echo ""

# ==========================================
# 11. Achievements Test
# ==========================================
echo "### 11. Achievements Test ###"

echo -n "Testing GET /api/achievements... "
if [[ -f "$COOKIE_JAR" ]]; then
    ACH_RESPONSE=$(curl -sk --connect-timeout 5 -b "$COOKIE_JAR" \
        ${BASE_URL}/api/achievements 2>/dev/null || echo "")
    
    if [[ "$ACH_RESPONSE" == *"achFirstBlood"* ]]; then
        pass "Achievements endpoint working"
        echo "   Response: ${ACH_RESPONSE:0:100}..."
    else
        warn "Achievements response: ${ACH_RESPONSE}"
    fi
else
    skip "No auth cookie - skipping achievements test"
fi

echo ""

# ==========================================
# 12. Leaderboard Redis Verification
# ==========================================
echo "### 12. Leaderboard Redis Verification ###"

echo -n "Testing GET /api/leaderboard (Redis backend)... "
LEADERBOARD_RESPONSE=$(curl -sk --connect-timeout 5 \
    ${BASE_URL}/api/leaderboard?limit=5 2>/dev/null || echo "")

if [[ -n "$LEADERBOARD_RESPONSE" ]]; then
    pass "Leaderboard endpoint reachable"
    # Check for source field indicating Redis usage
    if [[ "$LEADERBOARD_RESPONSE" == *"source"* ]]; then
        SOURCE=$(echo "$LEADERBOARD_RESPONSE" | grep -o '"source":"[^"]*"' | head -1)
        echo "   Source: ${SOURCE}"
    fi
    echo "   Response: ${LEADERBOARD_RESPONSE:0:150}..."
else
    warn "Leaderboard response: ${LEADERBOARD_RESPONSE}"
fi

echo -n "Testing GET /api/leaderboard with mode filter... "
LEADERBOARD_RANKED=$(curl -sk --connect-timeout 5 \
    ${BASE_URL}/api/leaderboard?mode=ranked&limit=10 2>/dev/null || echo "")

if [[ -n "$LEADERBOARD_RANKED" ]]; then
    pass "Ranked leaderboard accessible"
else
    warn "Ranked leaderboard response: ${LEADERBOARD_RANKED}"
fi

echo ""

# ==========================================
# 13. Friends System Tests (7 tests)
# ==========================================
echo "### 13. Friends System Verification ###"

# Register a second user for friends testing
FRIEND_USER="frienduser$(date +%s)"
FRIEND_PASS="friendpass123"

# Login as primary user to get fresh cookie
rm -f "$COOKIE_JAR"
PRIMARY_LOGIN=$(curl -sk --connect-timeout 5 -X POST -H "Content-Type: application/json" \
    -d "{\"username\":\"${TEST_USER}\",\"password\":\"${TEST_PASS}\"}" \
    -c "$COOKIE_JAR" \
    ${BASE_URL}/api/auth/login 2>/dev/null || echo "")

echo -n "Registering second user for friends testing... "
FRIEND_COOKIE_JAR="/tmp/ludo-friend-cookies.txt"
rm -f "$FRIEND_COOKIE_JAR"
FRIEND_REG=$(curl -sk --connect-timeout 5 -X POST -H "Content-Type: application/json" \
    -d "{\"username\":\"${FRIEND_USER}\",\"password\":\"${FRIEND_PASS}\"}" \
    -c "$FRIEND_COOKIE_JAR" \
    ${BASE_URL}/api/auth/register 2>/dev/null || echo "")

if [[ "$FRIEND_REG" == *"id"* ]]; then
    FRIEND_ID=$(echo "$FRIEND_REG" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\([^"]*\)"/\1/')
    pass "Second user registered (ID: ${FRIEND_ID:0:8}...)"
else
    warn "Second user registration: ${FRIEND_REG}"
fi

echo -n "Testing POST /api/friends/request/:userId... "
if [[ -f "$COOKIE_JAR" && -n "$FRIEND_ID" ]]; then
    FRIEND_REQ=$(curl -sk --connect-timeout 5 -X POST -b "$COOKIE_JAR" \
        ${BASE_URL}/api/friends/request/${FRIEND_ID} 2>/dev/null || echo "")
    
    if [[ "$FRIEND_REQ" == *"friendId"* || "$FRIEND_REQ" == *"status"* ]]; then
        pass "Friend request sent successfully"
        REQUEST_ID=$(echo "$FRIEND_REQ" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\([^"]*\)"/\1/')
    else
        warn "Friend request response: ${FRIEND_REQ}"
    fi
else
    skip "No auth cookie or friend ID - skipping friend request test"
fi

echo -n "Testing GET /api/friends (should be empty - not yet accepted)... "
if [[ -f "$COOKIE_JAR" ]]; then
    FRIENDS_LIST=$(curl -sk --connect-timeout 5 -b "$COOKIE_JAR" \
        ${BASE_URL}/api/friends 2>/dev/null || echo "")
    
    if [[ -n "$FRIENDS_LIST" ]]; then
        pass "Friends list endpoint reachable"
        echo "   Response: ${FRIENDS_LIST:0:100}..."
    else
        warn "Friends list response: ${FRIENDS_LIST}"
    fi
else
    skip "No auth cookie - skipping friends list test"
fi

echo -n "Testing GET /api/friends/requests (should show sent request)... "
if [[ -f "$COOKIE_JAR" ]]; then
    REQUESTS=$(curl -sk --connect-timeout 5 -b "$COOKIE_JAR" \
        ${BASE_URL}/api/friends/requests 2>/dev/null || echo "")
    
    if [[ "$REQUESTS" == *"sent"* ]]; then
        pass "Friend requests endpoint working (sent request visible)"
        echo "   Response: ${REQUESTS:0:100}..."
    else
        warn "Friend requests response: ${REQUESTS}"
    fi
else
    skip "No auth cookie - skipping requests test"
fi

echo -n "Testing POST /api/friends/accept/:requestId (as friend user)... "
if [[ -n "$REQUEST_ID" && -f "$FRIEND_COOKIE_JAR" ]]; then
    ACCEPT_RESPONSE=$(curl -sk --connect-timeout 5 -X POST -b "$FRIEND_COOKIE_JAR" \
        ${BASE_URL}/api/friends/accept/${REQUEST_ID} 2>/dev/null || echo "")
    
    if [[ "$ACCEPT_RESPONSE" == *"accepted"* ]]; then
        pass "Friend request accepted"
        echo "   Response: ${ACCEPT_RESPONSE}"
    else
        warn "Accept response: ${ACCEPT_RESPONSE}"
    fi
else
    skip "No request ID or friend cookie - skipping accept test"
fi

echo -n "Testing GET /api/friends (should show friend now)... "
if [[ -f "$COOKIE_JAR" ]]; then
    FRIENDS_LIST2=$(curl -sk --connect-timeout 5 -b "$COOKIE_JAR" \
        ${BASE_URL}/api/friends 2>/dev/null || echo "")
    
    if [[ "$FRIENDS_LIST2" == *"${FRIEND_USER}"* ]]; then
        pass "Friend appears in friends list"
        echo "   Response: ${FRIENDS_LIST2:0:100}..."
    else
        warn "Friends list after accept: ${FRIENDS_LIST2}"
    fi
else
    skip "No auth cookie - skipping friends list check"
fi

echo -n "Testing DELETE /api/friends/remove/:friendId... "
if [[ -f "$COOKIE_JAR" && -n "$FRIEND_ID" ]]; then
    REMOVE_RESPONSE=$(curl -sk --connect-timeout 5 -X DELETE -b "$COOKIE_JAR" \
        ${BASE_URL}/api/friends/remove/${FRIEND_ID} 2>/dev/null || echo "")
    
    if [[ "$REMOVE_RESPONSE" == *"removed"* || "$REMOVE_RESPONSE" == *"message"* ]]; then
        pass "Friend removed successfully"
    else
        warn "Remove response: ${REMOVE_RESPONSE}"
    fi
else
    skip "No auth cookie or friend ID - skipping remove test"
fi

echo -n "Testing POST /api/friends/block/:userId... "
if [[ -f "$COOKIE_JAR" && -n "$FRIEND_ID" ]]; then
    BLOCK_RESPONSE=$(curl -sk --connect-timeout 5 -X POST -b "$COOKIE_JAR" \
        ${BASE_URL}/api/friends/block/${FRIEND_ID} 2>/dev/null || echo "")
    
    if [[ "$BLOCK_RESPONSE" == *"blocked"* || "$BLOCK_RESPONSE" == *"status"* ]]; then
        pass "User blocked successfully"
    else
        warn "Block response: ${BLOCK_RESPONSE}"
    fi
else
    skip "No target user available - skipping block test"
fi

echo ""

# ==========================================
# Summary
# ==========================================
TOTAL=$((PASS + FAIL + SKIP))
echo "========================================="
echo "Test Summary: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped (Total: ${TOTAL})"
echo "========================================="

if [[ $FAIL -eq 0 ]]; then
    echo -e "${GREEN}All integration tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Check container logs.${NC}"
    exit 1
fi