
import requests
import json
import time

BASE_URL = "http://localhost:8080/api/v1"

def run_verification():
    print("Starting verification...")
    email = f"test_user_{int(time.time())}@example.com"
    password = "Password123!"

    # 1. Register
    print(f"Registering user: {email}")
    resp = requests.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "password": password,
        "first_name": "Test",
        "last_name": "User",
        "country": "Malaysia",
        "user_type": "trader"
    })
    print(f"Register status: {resp.status_code}")
    if resp.status_code != 201:
        print(f"Registration failed: {resp.text}")
        return

    # 2. Login
    print("Logging in...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    print(f"Login status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        return
    
    data = resp.json()
    token = data.get("token")
    if not token:
        print("No token received")
        return
    print(f"Got token: {token[:10]}...")

    # 3. Update Profile
    print("Updating profile...")
    new_first_name = "Updated"
    new_last_name = "Name"
    new_phone = "+60123456789"
    new_country = "Singapore"

    resp = requests.put(f"{BASE_URL}/user/profile", 
        headers={"Authorization": f"Bearer {token}"},
        json={
            "first_name": new_first_name,
            "last_name": new_last_name,
            "phone_number": new_phone,
            "country": new_country
        }
    )
    print(f"Update status: {resp.status_code}")
    print(f"Update response: {resp.text}")

    if resp.status_code == 200:
        print("✅ Backend Implementation Verified: Update successful")
    elif resp.status_code == 404:
        print("❌ Backend Implementation Failed: Endpoint not found (404). Did the backend rebuild?")
    else:
        print(f"❌ Backend Implementation Failed: Error {resp.status_code}")

if __name__ == "__main__":
    run_verification()
