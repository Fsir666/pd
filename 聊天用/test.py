import http.client
import json
import time
import threading
import ssl

API_URL = "xjomnrsjaatpopxwpedl.supabase.co"
API_PATH = "/auth/v1/otp"
PHONE = "13113354448"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqb21ucnNqYWF0cG9weHdwZWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA2NDE0OTksImV4cCI6MjAzNjIxNzQ5OX0.TeKJfbwvgMhud5c3mkoCZgiv4NClcjbkHdmV4cT4K6gja4MTQyNTM1MmMtmZo2i6pko5lHr3qrCo3Unqg0aUy4cXfyRY8bSlCIn5vbmR5"

CONCURRENT = 10
TOTAL = 30

success = 0
failed = 0
limited = 0
lock = threading.Lock()
results = []

def send_code(idx):
    global success, failed, limited
    
    payload = json.dumps({
        "phone": PHONE,
        "data": {},
        "create_user": True,
        "gotrue_meta_security": {},
        "channel": "sms"
    })
    
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
        "apikey": TOKEN,
    }
    
    try:
        context = ssl.create_default_context()
        conn = http.client.HTTPSConnection(API_URL, 443, context=context)
        conn.request("POST", API_PATH, payload, headers)
        resp = conn.getresponse()
        status = resp.status
        body = resp.read().decode("utf-8")
        conn.close()
        
        with lock:
            if status == 200:
                success += 1
                results.append(f"#{idx} OK")
            elif status == 429:
                limited += 1
                results.append(f"#{idx} Limited (429)")
            else:
                failed += 1
                results.append(f"#{idx} Fail {status}")
    except Exception as e:
        with lock:
            failed += 1
            results.append(f"#{idx} Error: {e}")

def main():
    output = []
    output.append("=" * 50)
    output.append("SMS Pressure Test (No Dependencies)")
    output.append("=" * 50)
    output.append(f"URL: https://{API_URL}{API_PATH}")
    output.append(f"Phone: {PHONE}")
    output.append(f"Concurrent: {CONCURRENT}, Total: {TOTAL}")
    output.append("=" * 50)
    
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
        
        output.append(f"--- Batch {i//CONCURRENT + 1} done ({batch_end}/{TOTAL}) ---")
    
    elapsed = time.time() - start
    output.extend(results)
    output.append("")
    output.append("=" * 50)
    output.append("Result")
    output.append("=" * 50)
    output.append(f"Success: {success}")
    output.append(f"Limited: {limited}")
    output.append(f"Failed: {failed}")
    output.append(f"Time: {elapsed:.2f}s")
    output.append(f"QPS: {TOTAL/elapsed:.2f}")
    
    with open("final_result.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(output))
    
    print("Done! Check final_result.txt")

if __name__ == "__main__":
    main()
