import asyncio
import aiohttp
import time
import json
import random
import string
from dataclasses import dataclass, field
from typing import List, Dict, Any
import argparse

@dataclass
class LoadTestConfig:
    url: str
    total_requests: int
    concurrency: int
    timeout: int = 10
    headers: Dict[str, str] = field(default_factory=dict)
    payload_template: Dict[str, Any] = field(default_factory=dict)
    duration: int = 0  # 0 means run until total_requests reached

@dataclass
class TestResult:
    success_count: int = 0
    error_count: int = 0
    total_time: float = 0.0
    response_times: List[float] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

def generate_random_string(length: int = 10) -> str:
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

async def send_request(session: aiohttp.ClientSession, config: LoadTestConfig, result: TestResult, request_id: int):
    """Gửi một yêu cầu API và ghi nhận kết quả."""
    # Tạo payload động cho mỗi request
    payload = config.payload_template.copy()
    if 'message' in payload:
        payload['message'] = f"Test message {request_id} - {generate_random_string()}"
    elif 'content' in payload:
        payload['content'] = f"Load test content {request_id}"
    
    start_time = time.time()
    try:
        async with session.post(
            config.url,
            json=payload,
            headers=config.headers,
            timeout=aiohttp.ClientTimeout(total=config.timeout)
        ) as response:
            elapsed = time.time() - start_time
            result.response_times.append(elapsed)
            
            if response.status == 200 or response.status == 201:
                result.success_count += 1
            else:
                result.error_count += 1
                error_msg = f"Request {request_id}: HTTP {response.status}"
                result.errors.append(error_msg)
                if len(result.errors) <= 10:  # Chỉ lưu 10 lỗi đầu tiên
                    print(f"[ERROR] {error_msg}")
                    
    except asyncio.TimeoutError:
        result.error_count += 1
        result.errors.append(f"Request {request_id}: Timeout")
        if len(result.errors) <= 10:
            print(f"[ERROR] Request {request_id}: Timeout")
    except aiohttp.ClientError as e:
        result.error_count += 1
        result.errors.append(f"Request {request_id}: {str(e)}")
        if len(result.errors) <= 10:
            print(f"[ERROR] Request {request_id}: {str(e)}")
    except Exception as e:
        result.error_count += 1
        result.errors.append(f"Request {request_id}: {str(e)}")
        if len(result.errors) <= 10:
            print(f"[ERROR] Request {request_id}: {str(e)}")

async def run_load_test(config: LoadTestConfig):
    """Chạy load test với mức độ song song được cấu hình."""
    result = TestResult()
    start_time = time.time()
    
    # Tạo session chung để tái sử dụng kết nối
    connector = aiohttp.TCPConnector(limit=config.concurrency)
    async with aiohttp.ClientSession(connector=connector) as session:
        
        # Tạo các task để gửi request
        tasks = []
        for i in range(config.total_requests):
            task = send_request(session, config, result, i + 1)
            tasks.append(task)
            
            # Kiểm soát mức độ song song
            if len(tasks) >= config.concurrency:
                # Chờ cho đến khi có ít nhất 1 task hoàn thành
                done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                tasks = list(pending)
                
                # Nếu đã đủ thời gian chạy (nếu cấu hình duration)
                if config.duration > 0 and (time.time() - start_time) >= config.duration:
                    # Hủy các task còn lại
                    for task in tasks:
                        task.cancel()
                    break
        
        # Chờ các task còn lại hoàn thành
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    result.total_time = time.time() - start_time
    return result

def print_results(result: TestResult, config: LoadTestConfig):
    """In kết quả load test."""
    print("\n" + "="*50)
    print("KẾT QUẢ LOAD TEST")
    print("="*50)
    print(f"Tổng số request: {config.total_requests}")
    print(f"Mức độ song song: {config.concurrency}")
    print(f"Thời gian tổng: {result.total_time:.2f}s")
    print(f"Thành công: {result.success_count}")
    print(f"Lỗi: {result.error_count}")
    
    if result.response_times:
        avg_time = sum(result.response_times) / len(result.response_times)
        min_time = min(result.response_times)
        max_time = max(result.response_times)
        rps = config.total_requests / result.total_time if result.total_time > 0 else 0
        
        print(f"\nHiệu năng:")
        print(f"  RPS (Requests per second): {rps:.2f}")
        print(f"  Thời gian phản hồi trung bình: {avg_time*1000:.2f}ms")
        print(f"  Thời gian phản hồi tối thiểu: {min_time*1000:.2f}ms")
        print(f"  Thời gian phản hồi tối đa: {max_time*1000:.2f}ms")
    
    if result.errors:
        print(f"\nLỗi mẫu (tối đa 10):")
        for error in result.errors[:10]:
            print(f"  - {error}")
    print("="*50)

def parse_args():
    parser = argparse.ArgumentParser(description='Load Testing Script cho API')
    parser.add_argument('--url', type=str, required=True, help='URL API endpoint')
    parser.add_argument('--requests', type=int, default=100, help='Tổng số request cần gửi')
    parser.add_argument('--concurrency', type=int, default=10, help='Số lượng request song song tối đa')
    parser.add_argument('--timeout', type=int, default=10, help='Timeout cho mỗi request (giây)')
    parser.add_argument('--duration', type=int, default=0, help='Thời gian chạy tối đa (giây), 0 = chạy hết số request')
    parser.add_argument('--header', type=str, action='append', help='Header dạng "Key: Value" (có thể dùng nhiều lần)')
    parser.add_argument('--payload', type=str, default='{}', help='JSON payload template')
    
    return parser.parse_args()

def main():
    args = parse_args()
    
    # Parse headers
    headers = {}
    if args.header:
        for h in args.header:
            if ':' in h:
                key, value = h.split(':', 1)
                headers[key.strip()] = value.strip()
    
    # Parse payload
    try:
        payload = json.loads(args.payload)
    except json.JSONDecodeError:
        print("Lỗi: Payload không phải là JSON hợp lệ")
        return
    
    config = LoadTestConfig(
        url=args.url,
        total_requests=args.requests,
        concurrency=args.concurrency,
        timeout=args.timeout,
        headers=headers,
        payload_template=payload,
        duration=args.duration
    )
    
    print(f"Bắt đầu load test...")
    print(f"URL: {config.url}")
    print(f"Số request: {config.total_requests}")
    print(f"Song song: {config.concurrency}")
    print(f"Timeout: {config.timeout}s")
    if config.duration > 0:
        print(f"Thời gian tối đa: {config.duration}s")
    print("-" * 50)
    
    result = asyncio.run(run_load_test(config))
    print_results(result, config)

if __name__ == '__main__':
    main()
