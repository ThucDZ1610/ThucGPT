import socket
import sys
import time
from concurrent.futures import ThreadPoolExecutor

def scan_port(host: str, port: int, timeout: float = 0.8) -> bool:
    """
    Kiểm tra trạng thái của một cổng TCP đơn lẻ.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(timeout)
            result = s.connect_ex((host, port))
            if result == 0:
                print(f"[+] Cổng {port} đang MỞ")
                return True
    except (socket.gaierror, socket.error):
        pass
    except Exception:
        pass
    return False

def scan_ports(host: str, start_port: int = 1, end_port: int = 1024, max_workers: int = 50, timeout: float = 0.8) -> list:
    """
    Quét dải cổng TCP trên máy chủ mục tiêu với ThreadPoolExecutor.
    """
    try:
        target_ip = socket.gethostbyname(host)
    except socket.gaierror:
        print(f"[-] Không thể phân giải host: {host}")
        return []

    print(f"[*] Đang quét host: {host} ({target_ip})")
    print(f"[*] Dải cổng: {start_port} -> {end_port} | Threads: {max_workers}")
    print("-" * 45)

    open_ports = []
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(scan_port, target_ip, port, timeout): port for port in range(start_port, end_port + 1)}
        for future in futures:
            port = futures[future]
            try:
                if future.result():
                    open_ports.append(port)
            except Exception:
                pass

    duration = time.time() - start_time
    open_ports.sort()
    print("-" * 45)
    print(f"[*] Hoàn thành sau {duration:.2f}s. Các cổng mở: {open_ports}")
    return open_ports

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
    start_p = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    end_p = int(sys.argv[3]) if len(sys.argv) > 3 else 1024

    scan_ports(target, start_p, end_p)
