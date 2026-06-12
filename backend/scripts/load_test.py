import asyncio
import httpx
import time

URL = "http://localhost:8000/api/auth/login"
CONCURRENT_REQUESTS = 50

async def send_request(client, index):
    # Depending on the backend, login might expect form data or JSON.
    # FastAPI OAuth2PasswordRequestForm expects form data. We'll use form data here.
    # We will also try JSON if form data fails.
    data = {
        "username": f"user{index}@example.com",
        "password": "dummy_password"
    }
    try:
        # Try sending as form data first
        response = await client.post(URL, data=data)
        return response.status_code
    except Exception as e:
        return f"Error: {e}"

async def main():
    print(f"Sending {CONCURRENT_REQUESTS} concurrent requests to {URL}...")
    
    start_time = time.time()
    
    # We use a custom transport if needed, but default is fine.
    async with httpx.AsyncClient() as client:
        tasks = [send_request(client, i) for i in range(CONCURRENT_REQUESTS)]
        results = await asyncio.gather(*tasks)
        
    end_time = time.time()
    
    print(f"Finished in {end_time - start_time:.2f} seconds")
    
    status_counts = {}
    for result in results:
        status_counts[result] = status_counts.get(result, 0) + 1
        
    print("\nStatus code counts:")
    for status, count in status_counts.items():
        print(f"  {status}: {count}")
        
    if 429 in status_counts:
        print("\nSuccess: Received HTTP 429 Too Many Requests. Rate limiting is working!")
    else:
        print("\nWarning: Did not receive any HTTP 429 status codes.")
        print("Either the rate limit is not working, the server is down, or the endpoint URL is incorrect.")

if __name__ == "__main__":
    asyncio.run(main())
