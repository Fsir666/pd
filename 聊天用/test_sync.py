import requests
import time
import threading

# ========== 配置区域 ==========
API_URL = "https://xjomnrsjaatpopxwpedl.supabase.co/auth/v1/otp"
PHONE = "13113354448"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqb21ucnNqYWF0cG9weHdwZWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA2NDE0OTksImV4cCI6MjAzNjIxNzQ5OX0.TeKJfbwvgMhud5c3mkoCZgiv4NClcjbkHdmV4cT4K6gja4MTQyNTM1MmMtmZo2i6pko5lHr3qrCo3Unqg0aUy4cXfyRY8bSlCIn5vbmR5"

CONCURRENT = 50
TOTAL = 200
# =============================

success = 0
failed = 0
limited = 0
lock = threading.Lock()

def send_code(idx):
    global success, failed, limited
    
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
        "apikey": TOKEN,
    }
    
    payload = {
        "phone": PHONE,
        "data": {},
        "create_user": True,
        "gotrue_meta_security": {},
        "channel": "sms"
    }
    
    try:
        resp = requests.post(API_URL, json=payload, headers=headers, timeout=10)
        with lock:
            if resp.status_code == 200:
                success += 1
                print(f"#{idx} OK")
            elif resp.status_code == 429:
                limited += 1
                print(f"#{idx} Limited")
            else:
                failed += 1
                print(f"#{idx} Fail {resp.status_code}")
    except Exception as e:
        with lock:
            failed += 1
            print(f"#{idx} Error: {e}")

def main():
    print("=" * 50)
    print("SMS Pressure Test (Sync)")
    print("=" * 50)
    print(f"URL: {API_URL}")
    print(f"Phone: {PHONE}")
    print(f"Concurrent: {CONCURRENT}, Total: {TOTAL}")
    print("=" * 50)
    
    start = time.time()
    
    for i in range(0, TOTAL, CONCURRENT):
        threads = []
        batch_end = min(i + CONCURRENT, TOTAL)
        for j in range(i, batch_end):
            t = threading.Thread(target=send_code, args=(j+1,))
            threads.append(t)
            t.start()
        
        for t in threads:
            t.join()
        
        print(f"--- Batch {i//CONCURRENT + 1} done ({batch_end}/{TOTAL}) ---")
    
    elapsed = time.time() - start
    print("\n" + "=" * 50)
    print("Result")
    print("=" * 50)
    print(f"Success: {success}")
    print(f"Limited: {limited}")
    print(f"Failed: {failed}")
    print(f"Time: {elapsed:.2f}s")
    print(f"QPS: {TOTAL/elapsed:.2f}")

if __name__ == "__main__":
    main()
