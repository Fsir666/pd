import asyncio
import aiohttp
import time
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class TestConfig:
    api_url: str = "http://ohmybead.cn/api/send-code"
    phone: str = "你的测试手机号"
    concurrent_requests: int = 50
    total_requests: int = 200
    delay_between_batches: float = 0.1
    timeout: int = 10

@dataclass
class TestResults:
    success: int = 0
    failed: int = 0
    rate_limited: int = 0
    server_error: int = 0
    timeout_count: int = 0
    errors: list = field(default_factory=list)
    response_times: list = field(default_factory=list)

class SMSPressureTester:
    def __init__(self, config: TestConfig):
        self.config = config
        self.results = TestResults()
    
    async def send_request(self, session: aiohttp.ClientSession, request_id: int) -> dict:
        payload = {"phone": self.config.phone}
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
        }
        
        start_time = time.time()
        result = {
            "request_id": request_id,
            "timestamp": datetime.now().strftime("%H:%M:%S.%f")[:-3],
        }
        
        try:
            async with session.post(
                self.config.api_url,
                json=payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=self.config.timeout)
            ) as response:
                elapsed = time.time() - start_time
                result["elapsed"] = round(elapsed, 3)
                result["status_code"] = response.status
                self.results.response_times.append(elapsed)
                
                try:
                    result["response"] = await response.json()
                except:
                    result["response"] = await response.text()
                
                if response.status == 200:
                    self.results.success += 1
                elif response.status == 429:
                    self.results.rate_limited += 1
                elif response.status >= 500:
                    self.results.server_error += 1
                else:
                    self.results.failed += 1
                    
        except asyncio.TimeoutError:
            self.results.timeout_count += 1
            result["error"] = "timeout"
        except Exception as e:
            self.results.failed += 1
            self.results.errors.append(str(e))
            result["error"] = str(e)
        
        return result
    
    async def run_test(self):
        self._print_header()
        
        connector = aiohttp.TCPConnector(limit=self.config.concurrent_requests * 2)
        
        async with aiohttp.ClientSession(connector=connector) as session:
            start_time = time.time()
            batch_size = self.config.concurrent_requests
            total = self.config.total_requests
            
            for batch_start in range(0, total, batch_size):
                batch_end = min(batch_start + batch_size, total)
                tasks = [
                    self.send_request(session, i + 1) 
                    for i in range(batch_start, batch_end)
                ]
                
                print(f"\n[批次 {batch_start//batch_size + 1}] 发送 {len(tasks)} 个并发请求...")
                
                results = await asyncio.gather(*tasks)
                self._print_batch_results(results)
                
                if batch_end < total:
                    await asyncio.sleep(self.config.delay_between_batches)
            
            total_time = time.time() - start_time
            self._print_summary(total_time)
    
    def _print_header(self):
        print("=" * 60)
        print("验证码接口并发压力测试")
        print("=" * 60)
        print(f"目标接口: {self.config.api_url}")
        print(f"测试手机: {self.config.phone}")
        print(f"并发数: {self.config.concurrent_requests}")
        print(f"总请求数: {self.config.total_requests}")
        print(f"超时时间: {self.config.timeout}s")
        print("=" * 60)
    
    def _print_batch_results(self, results: list):
        for r in results:
            if "error" in r:
                print(f"  #{r['request_id']:3d}: 错误 - {r['error']}")
            elif "status_code" in r:
                status_emoji = "✓" if r["status_code"] == 200 else "✗"
                print(f"  #{r['request_id']:3d}: HTTP {r['status_code']} ({r['elapsed']}s) {status_emoji}")
    
    def _print_summary(self, total_time: float):
        print("\n" + "=" * 60)
        print("测试结果汇总")
        print("=" * 60)
        print(f"总请求数: {self.config.total_requests}")
        print(f"成功 (200): {self.results.success}")
        print(f"被限流 (429): {self.results.rate_limited}")
        print(f"服务器错误 (5xx): {self.results.server_error}")
        print(f"超时: {self.results.timeout_count}")
        print(f"其他失败: {self.results.failed}")
        print(f"总耗时: {round(total_time, 2)}秒")
        print(f"平均QPS: {round(self.config.total_requests / total_time, 2)}")
        
        if self.results.response_times:
            avg_time = sum(self.results.response_times) / len(self.results.response_times)
            max_time = max(self.results.response_times)
            min_time = min(self.results.response_times)
            print(f"平均响应时间: {round(avg_time, 3)}s")
            print(f"最大响应时间: {round(max_time, 3)}s")
            print(f"最小响应时间: {round(min_time, 3)}s")
        
        if self.results.errors:
            print(f"\n错误列表 (前5个):")
            for err in self.results.errors[:5]:
                print(f"  - {err}")

def main():
    config = TestConfig(
        api_url="http://ohmybead.cn/api/send-code",
        phone="你的测试手机号",
        concurrent_requests=50,
        total_requests=200,
    )
    
    print("\n请先修改 config 配置:")
    print("  1. api_url - 验证码接口地址")
    print("  2. phone - 测试手机号")
    print("  3. concurrent_requests - 并发数")
    print("  4. total_requests - 总请求数")
    print("\n按 Enter 开始测试...")
    input()
    
    tester = SMSPressureTester(config)
    asyncio.run(tester.run_test())

if __name__ == "__main__":
    main()
