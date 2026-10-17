import sys
import json
import time
import argparse
import statistics
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any

@dataclass
class RequestResult:
    status_code: Optional[int]
    latency_ms: float
    success: bool
    error_msg: Optional[str] = None

class HttpLoadTester:
    def __init__(self, url: str, total_requests: int = 100, concurrency: int = 10, timeout: float = 5.0):
        self.url = url
        self.total_requests = total_requests
        self.concurrency = concurrency
        self.timeout = timeout
        self.results: List[RequestResult] = []

    def _worker_task(self, session: requests.Session) -> RequestResult:
        """Gửi 1 request và đo lường thời gian phản hồi."""
        start_time = time.perf_counter()
        try:
            response = session.get(self.url, timeout=self.timeout)
            latency = (time.perf_counter() - start_time) * 1000
            return RequestResult(
                status_code=response.status_code,
                latency_ms=latency,
                success=(200 <= response.status_code < 400),
                error_msg=None
            )
        except requests.exceptions.Timeout:
            latency = (time.perf_counter() - start_time) * 1000
            return RequestResult(status_code=None, latency_ms=latency, success=False, error_msg="Timeout")
        except requests.exceptions.RequestException as e:
            latency = (time.perf_counter() - start_time) * 1000
            return RequestResult(status_code=None, latency_ms=latency, success=False, error_msg=type(e).__name__)

    def run(self) -> Dict[str, Any]:
        """Thực thi kiểm thử tải đồng thời với Connection Pooling."""
        session = requests.Session()
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=self.concurrency,
            pool_maxsize=self.concurrency,
            max_retries=0
        )
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        start_total = time.perf_counter()

        with ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            futures = [executor.submit(self._worker_task, session) for _ in range(self.total_requests)]
            for future in as_completed(futures):
                self.results.append(future.result())

        total_duration = time.perf_counter() - start_total
        session.close()

        return self.get_summary(total_duration)

    def get_summary(self, duration_sec: float) -> Dict[str, Any]:
        """Phân tích và trả về dict thống kê kết quả."""
        latencies = [r.latency_ms for r in self.results if r.success]
        status_counts = dict(Counter(r.status_code for r in self.results if r.status_code is not None))
        error_counts = dict(Counter(r.error_msg for r in self.results if r.error_msg is not None))

        success_count = sum(1 for r in self.results if r.success)
        failed_count = len(self.results) - success_count
        rps = round(len(self.results) / duration_sec, 2) if duration_sec > 0 else 0

        latency_stats = {}
        if latencies:
            latencies.sort()
            avg_lat = statistics.mean(latencies)
            med_lat = statistics.median(latencies)
            p95_lat = latencies[int(len(latencies) * 0.95)] if len(latencies) >= 20 else latencies[-1]
            latency_stats = {
                "min_ms": round(min(latencies), 2),
                "avg_ms": round(avg_lat, 2),
                "median_ms": round(med_lat, 2),
                "p95_ms": round(p95_lat, 2),
                "max_ms": round(max(latencies), 2)
            }

        return {
            "target_url": self.url,
            "total_requests": self.total_requests,
            "concurrency": self.concurrency,
            "duration_seconds": round(duration_sec, 2),
            "requests_per_second": rps,
            "success_count": success_count,
            "failed_count": failed_count,
            "status_codes": status_counts,
            "errors": error_counts,
            "latency": latency_stats
        }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HTTP Load Testing Tool")
    parser.add_argument("--url", type=str, default="http://127.0.0.1:3000/api/health", help="Target URL")
    parser.add_argument("--requests", type=int, default=100, help="Total requests to send")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrency / worker threads")
    parser.add_argument("--timeout", type=float, default=5.0, help="Timeout per request in seconds")
    parser.add_argument("--json", action="store_true", help="Output result as JSON")

    args = parser.parse_args()

    tester = HttpLoadTester(
        url=args.url,
        total_requests=args.requests,
        concurrency=args.concurrency,
        timeout=args.timeout
    )
    summary = tester.run()

    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print("\n" + "=" * 20 + " KẾT QUẢ KIỂM THỬ TẢI " + "=" * 20)
        print(f"Mục tiêu                 : {summary['target_url']}")
        print(f"Thời gian thực thi       : {summary['duration_seconds']} s")
        print(f"Thông lượng (RPS)        : {summary['requests_per_second']} req/s")
        print(f"Thành công / Thất bại    : {summary['success_count']} / {summary['failed_count']}")
        print(f"Status codes             : {summary['status_codes']}")
        print(f"Độ trễ (Latency ms)      : {summary['latency']}")
        print("=" * 62)
