#!/usr/bin/env bash
# Smoke test script for ZakupPro API
# Validates core create -> update -> delete workflow
# Usage: bash scripts/smoke-test.sh
# Environment variables:
#   FASTAPI_URL - API base URL (default: http://localhost:8000)

set -euo pipefail

# Configuration
FASTAPI_URL="${FASTAPI_URL:-http://localhost:8000}"
LOGIN_USER="${LOGIN_USER:-admin}"
LOGIN_PASS="${LOGIN_PASS:-admin123}"

echo "=== ZakupPro Smoke Test ==="
echo "API URL: $FASTAPI_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper function for HTTP requests with error handling
api_request() {
    local method="$1"
    local url="$2"
    local data="$3"
    local token="$4"
    local expected_status="$5"

    if [ -n "$token" ]; then
        auth_header="-H \"Authorization: Bearer $token\""
    else
        auth_header=""
    fi

    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            $auth_header \
            -d "$data" \
            "$url" 2>&1) || true
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            $auth_header \
            "$url" 2>&1) || true
    fi

    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status_code" != "$expected_status" ]; then
        echo -e "${RED}✗ Failed: Expected status $expected_status, got $status_code${NC}"
        echo "Response: $body"
        return 1
    fi

    echo "$body"
    return 0
}

# Step 1: Login to get JWT token
echo "1. Testing login endpoint..."
login_response=$(api_request \
    "POST" \
    "$FASTAPI_URL/api/auth/login" \
    "{\"username\": \"$LOGIN_USER\", \"password\": \"$LOGIN_PASS\"}" \
    "" \
    "200") || exit 1

access_token=$(echo "$login_response" | jq -r '.access_token // empty')
role=$(echo "$login_response" | jq -r '.role // empty')

if [ -z "$access_token" ] || [ "$access_token" = "null" ]; then
    echo -e "${RED}✗ Login failed: No access token in response${NC}"
    echo "Response: $login_response"
    exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo "  Role: $role"
echo ""

# Step 2: Create a project
echo "2. Testing project creation..."
project_data='{
    "name": "Smoke Test Project",
    "description": "Automated smoke test project",
    "status": "active"
}'

create_response=$(api_request \
    "POST" \
    "$FASTAPI_URL/api/projects" \
    "$project_data" \
    "$access_token" \
    "201") || exit 1

project_id=$(echo "$create_response" | jq -r '.id // empty')

if [ -z "$project_id" ] || [ "$project_id" = "null" ]; then
    echo -e "${RED}✗ Project creation failed: No project ID in response${NC}"
    echo "Response: $create_response"
    exit 1
fi

echo -e "${GREEN}✓ Project created${NC}"
echo "  ID: $project_id"
echo "  Name: $(echo "$create_response" | jq -r '.name')"
echo ""

# Step 3: Get the project to verify creation
echo "3. Testing project retrieval..."
get_response=$(api_request \
    "GET" \
    "$FASTAPI_URL/api/projects/$project_id" \
    "" \
    "$access_token" \
    "200") || exit 1

retrieved_name=$(echo "$get_response" | jq -r '.name')
retrieved_status=$(echo "$get_response" | jq -r '.status')

if [ "$retrieved_name" != "Smoke Test Project" ]; then
    echo -e "${RED}✗ Project retrieval failed: Name mismatch${NC}"
    echo "Expected: Smoke Test Project, Got: $retrieved_name"
    exit 1
fi

echo -e "${GREEN}✓ Project retrieved${NC}"
echo "  Status: $retrieved_status"
echo ""

# Step 4: Update project status
echo "4. Testing project update..."
update_data='{
    "status": "completed",
    "description": "Updated by smoke test"
}'

update_response=$(api_request \
    "PUT" \
    "$FASTAPI_URL/api/projects/$project_id" \
    "$update_data" \
    "$access_token" \
    "200") || exit 1

updated_status=$(echo "$update_response" | jq -r '.status')
updated_description=$(echo "$update_response" | jq -r '.description')

if [ "$updated_status" != "completed" ]; then
    echo -e "${RED}✗ Project update failed: Status not updated${NC}"
    echo "Expected: completed, Got: $updated_status"
    exit 1
fi

echo -e "${GREEN}✓ Project updated${NC}"
echo "  New status: $updated_status"
echo "  New description: $updated_description"
echo ""

# Step 5: Verify status change with GET
echo "5. Verifying status change..."
verify_response=$(api_request \
    "GET" \
    "$FASTAPI_URL/api/projects/$project_id" \
    "" \
    "$access_token" \
    "200") || exit 1

verify_status=$(echo "$verify_response" | jq -r '.status')

if [ "$verify_status" != "completed" ]; then
    echo -e "${RED}✗ Status verification failed${NC}"
    echo "Expected: completed, Got: $verify_status"
    exit 1
fi

echo -e "${GREEN}✓ Status change verified${NC}"
echo ""

# Step 6: Delete the project
echo "6. Testing project deletion..."
delete_response=$(api_request \
    "DELETE" \
    "$FASTAPI_URL/api/projects/$project_id" \
    "" \
    "$access_token" \
    "204") || exit 1

echo -e "${GREEN}✓ Project deleted${NC}"
echo ""

# Step 7: Verify deletion (expect 404)
echo "7. Verifying deletion..."
verify_delete_response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $access_token" \
    "$FASTAPI_URL/api/projects/$project_id" 2>&1) || true

delete_status_code=$(echo "$verify_delete_response" | tail -n1)

if [ "$delete_status_code" != "404" ]; then
    echo -e "${RED}✗ Deletion verification failed: Expected 404, got $delete_status_code${NC}"
    echo "Response: $(echo "$verify_delete_response" | sed '$d')"
    exit 1
fi

echo -e "${GREEN}✓ Deletion verified (404 response)${NC}"
echo ""

# All tests passed
echo "=== All Smoke Tests Passed ==="
echo -e "${GREEN}✓ Core workflow validated${NC}"
exit 0
