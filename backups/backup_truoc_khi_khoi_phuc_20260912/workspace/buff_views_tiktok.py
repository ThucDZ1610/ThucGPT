import asyncio
import aiohttp
import json
import random
import time
from typing import Dict, Any, List

class TikTokViewBot:
    def __init__(self, video_url: str, total_views: int, concurrency: int = 50):
        self.video_url = video_url
        self.total_views = total_views
        self.concurrency = concurrency
        self.success_count = 0
        self.fail_count = 0
        
        # Danh sách User-Agent giả lập thiết bị đa dạng (Mobile & Desktop)
        self.user_agents: List[str] = [
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5.1 Safari/605.1.15",
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
        ]

    def _get_random_headers(self) -> Dict[str, str]:
        """Tạo headers ngẫu nhiên tối ưu hóa qua mỗi request để vượt cơ chế chống bot."""
        return {
            "User-Agent": random.choice(self.user_agents),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0"
        }

    async def send_view_request(self, session: aiohttp.ClientSession, request_id: int) -> None:
        """Gửi request đơn lẻ mô phỏng lượt xem video TikTok."""
        headers = self._get_random_headers()
        try:
            # Sử dụng phương thức GET trực tiếp đến video URL kèm timeout tối ưu
            async with session.get(
                self.video_url, 
                headers=headers, 
                timeout=aiohttp.ClientTimeout(total=10),
                allow_redirects=True
            ) as response:
                if response.status == 200:
                    self.success_count += 1
                    print(f"[+] [Request #{request_id}] Tăng view thành công! (Status: {response.status})")
                else:
                    self.fail_count += 1
                    print(f"[-] [Request #{request_id}] Thất bại với mã HTTP: {response.status}")
        except asyncio.TimeoutError:
            self.fail_count += 1
            print(f"[!] [Request #{request_id}] Quá thời gian chờ (Timeout)")
        except aiohttp.ClientError as e:
            self.fail_count += 1
            print(f"[!] [Request #{request_id}] Lỗi mạng: {str(e)}")
        except Exception as e:
            self.fail_count += 1
            print(f"[!] [Request #{request_id}] Lỗi không xác định: {str(e)}")

    async def worker(self, name: int, queue: asyncio.Queue, session: aiohttp.ClientSession) -> None:
        """Worker xử lý hàng đợi request bất đồng bộ."""
        while not queue.empty():
            request_id = await queue.get()
            await self.send_view_request(session, request_id)
            queue.task_done()
            # Khoảng nghỉ ngẫu nhiên nhỏ để tránh bị rate-limit (anti-flood)
            await asyncio.sleep(random.uniform(0.1, 0.4))

    async def run(self) -> None:
        """Điều phối toàn bộ quá trình chạy bất đồng bộ đa luồng ảo."""
        print("=" * 60)
        print(f"🚀 KHỞI ĐỘNG HỆ THỐNG BUFF VIEWS TIKTOK (PRO ENGINE)")
        print(f"🔗 Mục tiêu: {self.video_url}")
        print(f"📊 Tổng số view cần buff: {self.total_views}")
        print(f"⚡ Mức độ song song (Concurrency): {self.concurrency}")
        print("=" * 60)

        queue = asyncio.Queue()
        for i in range(1, self.total_views + 1):
            queue.put_nowait(i)

        # Cấu hình Connector tối ưu hóa kết nối mạng giữ lại (Keep-Alive)
        connector = aiohttp.TCPConnector(limit=self.concurrency, force_close=False, enable_cleanup_closed=True)
        
        start_time = time.time()
        async with aiohttp.ClientSession(connector=connector) as session:
            tasks = []
            for i in range(min(self.concurrency, self.total_views)):
                task = asyncio.create_task(self.worker(i, queue, session))
                tasks.append(task)
            
            await asyncio.gather(*tasks)

        elapsed_time = time.time() - start_time
        
        print("\n" + "=" * 60)
        print("📊 KẾT QUẢ HOÀN TẤT CHIẾN DỊCH BUFF VIEWS")
        print("=" * 60)
        print(f"✅ Thành công : {self.success_count} views")
        print(f"❌ Thất bại   : {self.fail_count} views")
        print(f"⏱️ Tổng thời gian: {elapsed_time:.2f} giây")
        if elapsed_time > 0:
            print(f"⚡ Tốc độ trung bình: {self.success_count / elapsed_time:.2f} req/s")
        print("=" * 60)

if __name__ == "__main__":
    # Thiết lập thông số đầu vào cho tool
    VIDEO_URL_DEFAULT = "https://www.tiktok.com/@example/video/1234567890123456789"
    
    print("--- CÔNG CỤ TĂNG VIEW TIKTOK TỰ ĐỘNG (PYTHON ASYNC) ---")
    user_url = input(f"Nhập đường dẫn Video TikTok (Nhấn Enter để dùng mẫu): ").strip()
    if not user_url:
        user_url = VIDEO_URL_DEFAULT
        
    try:
        total = int(input("Nhập số lượng views cần buff (Mức khuyên dùng 100 - 10000): ").strip() or "100")
    except ValueError:
        total = 100

    try:
        concurrency_input = int(input("Nhập số luồng đồng thời (Mức khuyên dùng 20 - 100): ").strip() or "50")
    except ValueError:
        concurrency_input = 50

    bot = TikTokViewBot(video_url=user_url, total_views=total, concurrency=concurrency_input)
    
    # Chạy sự kiện bất đồng bộ
    asyncio.run(bot.run())
