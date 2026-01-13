#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"
EMAIL="test_user_$(date +%s)@example.com"
PASSWORD="Password123!"

echo "1. Registering user: $EMAIL"
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\", \"first_name\": \"Test\", \"last_name\": \"User\", \"country\": \"Malaysia\", \"user_type\": \"trader\"}" \
  > register_resp.json

echo "Register Response:"
cat register_resp.json
echo ""

# 1.5 Manually Verify Email in Keycloak DB
echo "1.5 Verifying email in Keycloak DB (Clearing required actions)..."
docker exec brokerage-postgres-dev psql -U postgres_hedgetechs -d keycloak_dev -c "DELETE FROM user_required_action WHERE user_id IN (SELECT id FROM user_entity WHERE email = '$EMAIL');"
docker exec brokerage-postgres-dev psql -U postgres_hedgetechs -d keycloak_dev -c "UPDATE user_entity SET email_verified = true WHERE email = '$EMAIL';"

# Restart Keycloak to clear cache
echo "Restarting Keycloak to apply DB changes..."
docker compose -f docker-compose.dev.yml restart keycloak
echo "Waiting for Keycloak to start (30s)..."
sleep 30

# 2. Login
echo "2. Logging in..."
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" \
  > login_resp.json

echo "Login Response:"
cat login_resp.json
echo ""

# Extract Token (simple grep approach if jq not available, assuming json structure)
TOKEN=$(cat login_resp.json | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to extract token. Login might have failed."
  exit 1
fi

echo "Got Token: ${TOKEN:0:10}..."

# 3. Update Profile
echo "3. Updating Profile..."
curl -s -X PUT "$BASE_URL/user/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"first_name\": \"Updated\", \"last_name\": \"Name\", \"phone_number\": \"+60123456789\", \"country\": \"Singapore\"}" \
  > update_resp.json

echo "Update Response:"
cat update_resp.json
echo ""

# Check for success
if grep -q "Profile updated successfully" update_resp.json; then
  echo "✅ Backend Implementation Verified: Update successful"
else
  echo "❌ Backend Implementation Failed. Check update_resp.json"
  if grep -q "404 page not found" update_resp.json; then
     echo "   (Error 404: Endpoint not found. Backend likely not rebuilt/restarted properly)"
  fi
fi
