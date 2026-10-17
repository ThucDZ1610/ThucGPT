"""
=============================================================================
AI TURBO PRO - ASYNC TASK QUEUE MANAGER (PYTHON ASYNCIO WORKER)
Chuyên trách xử lý hàng đợi tác vụ mạng, I/O bất đồng bộ và kiểm soát tải
=============================================================================
"""

import asyncio
import time
import json
import sys
from typing import Callable, Any, Dict, List

# Đảm bảo in tiếng Việt chuẩn trên console Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

class TaskItem:
    def __init__(self, task_id: str, payload: Dict[str, Any], retries: int = 3):
        self.task_id = task_id
        self.payload = payload
        self.retries = retries
        self.attempt = 0
        self.status = "pending"
        self.result = None
        self.error = None
        self.started_at = None
        self.completed_at = None

class AsyncQueueManager:
    def __init__(self, concurrency_limit: int = 5, retry_delay_sec: float = 1.0):
        self.concurrency_limit = concurrency_limit
        self.semaphore = asyncio.Semaphore(concurrency_limit)
        self.queue = asyncio.Queue()
        self.tasks: Dict[str, TaskItem] = {}
        self.retry_delay_sec = retry_delay_sec
        self.is_running = False

    def add_task(self, task_id: str, payload: Dict[str, Any], retries: int = 3) -> TaskItem:
        task = TaskItem(task_id, payload, retries)
        self.tasks[task_id] = task
        self.queue.put_nowait(task)
        return task

    async def _worker(self, worker_id: int, handler: Callable[[Dict[str, Any]], Any]):
        while self.is_running:
            try:
                task: TaskItem = await self.queue.get()
            except asyncio.CancelledError:
                break

            task.status = "running"
            task.started_at = time.time()
            task.attempt += 1

            async with self.semaphore:
                try:
                    # Thực thi hàm xử lý tác vụ
                    res = await handler(task.payload)
                    task.result = res
                    task.status = "completed"
                    task.completed_at = time.time()
                except Exception as ex:
                    task.error = str(ex)
                    if task.attempt < task.retries:
                        task.status = "retrying"
                        await asyncio.sleep(self.retry_delay_sec)
                        await self.queue.put(task)
                    else:
                        task.status = "failed"
                        task.completed_at = time.time()
                finally:
                    self.queue.task_done()

    async def run(self, handler: Callable[[Dict[str, Any]], Any], num_workers: int = None):
        """Khởi chạy worker pool để xử lý toàn bộ hàng đợi cho đến khi hết task"""
        workers_count = num_workers or self.concurrency_limit
        self.is_running = True
        workers = [
            asyncio.create_task(self._worker(i, handler))
            for i in range(workers_count)
        ]

        # Đợi tất cả task trong queue hoàn thành
        await self.queue.join()

        # Dừng các worker
        self.is_running = False
        for w in workers:
            w.cancel()
        await asyncio.gather(*workers, return_exceptions=True)

    def get_summary(self) -> Dict[str, Any]:
        total = len(self.tasks)
        completed = sum(1 for t in self.tasks.values() if t.status == "completed")
        failed = sum(1 for t in self.tasks.values() if t.status == "failed")
        return {
            "total": total,
            "completed": completed,
            "failed": failed,
            "tasks": {
                tid: {
                    "status": t.status,
                    "attempts": t.attempt,
                    "duration": round((t.completed_at - t.started_at), 3) if t.completed_at and t.started_at else None,
                    "error": t.error
                }
                for tid, t in self.tasks.items()
            }
        }

# =============================================================================
# KỊCH BẢN CHẠY DEMO / BENCHMARK MẪU
# =============================================================================
async def sample_task_handler(payload: Dict[str, Any]):
    """Giả lập xử lý dữ liệu mạng hoặc I/O bất đồng bộ có điều tiết"""
    item_id = payload.get("item_id", 0)
    delay = payload.get("simulated_latency_sec", 0.05)
    await asyncio.sleep(delay)
    return {"processed_item": item_id, "timestamp": time.time()}

async def main():
    print("=== KHỞI CHẠY ASYNC QUEUE MANAGER (PYTHON ASYNCIO) ===")
    manager = AsyncQueueManager(concurrency_limit=5)

    # Đưa 20 tác vụ mẫu vào hàng đợi
    print("[*] Đang nạp 20 tác vụ vào hàng đợi với Concurrency Limit = 5...")
    for i in range(1, 21):
        manager.add_task(f"task_{i:03d}", {"item_id": i, "simulated_latency_sec": 0.05})

    start_time = time.time()
    await manager.run(sample_task_handler)
    elapsed = time.time() - start_time

    summary = manager.get_summary()
    print(f"[✔] Hoàn thành {summary['completed']}/{summary['total']} tác vụ trong {elapsed:.3f}s!")
    print(json.dumps(summary, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(main())
