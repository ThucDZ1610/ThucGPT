import asyncio
import aiohttp
import argparse
import sys
import json

# ==========================================
# CÔNG CỤ SMS TEST / LOAD TEST - ẢNH HƯỞNG API
# Sáng lập và điều hành bởi: THỨC
# ==========================================

async def send_single_sms(session, url, phone, message, request_id):
    payload = {
        "phone": phone,
        "message": f"{message} [{request_id}]"
    }
    try:
        async with session.post(url, json=payload, timeout=5) as response:
            if response.status == 200:
                print(f"[+] [{request_id}] Gửi thành công tới {phone}")
                return True
            else:
                print(f"[-] [{request_id}] Lỗi HTTP {response.status} cho số {phone}")
                return False
    except Exception as e:
        print(f"[x] [{request_id}] Kết nối thất bại: {str(e)}")
        return False

async def run_sms_spammer(url, phone, message, total_requests, concurrency):
    print(f"\n[*] Bắt đầu gửi {total_requests} yêu cầu tới {phone} (Đồng thời: {concurrency})...\n")
    connector = aiohttp.TCPConnector(limit=concurrency)
    
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = []
        success_count = 0
        
        for i in range(1, total_requests + 1):
            task = asyncio.create_task(send_single_sms(session, url, phone, message, i))
            tasks.append(task)
            
            if len(tasks) >= concurrency:
                results = await asyncio.gather(*tasks)
                success_count += sum(1 for r in results if r)
                tasks = []
                
        if tasks:
            results = await asyncio.gather(*tasks)
            success_count += sum(1 for r in results if r)
            
        print(f"\n[v] Hoàn tất! Thành công: {success_count}/{total_requests}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Công cụ Test API / Gửi SMS tự động chuẩn Production')
    parser.add_argument('--url', type=str, required=True, help='API Endpoint nhận SMS')
    parser.add_argument('--phone', type=str, required=True, help='Số điện thoại nhận')
    parser.add_argument('--msg', type=str, default='Ma xac thuc OTP cua ban la 123456', help='Nội dung tin nhắn')
    parser.add_argument('--count', type=int, default=10, help='Tổng số lượng gửi')
    parser.add_argument('--concurrency', type=int, default=5, help='Mức độ gửi đồng thời')
    
    args = parser.parse_args()
    
    try:
        asyncio.run(run_sms_spammer(args.url, args.phone, args.msg, args.count, args.concurrency))
    except KeyboardInterrupt:
        print("\n[!] Đã dừng chương trình bởi người dùng.")
        sys.exit(0)
