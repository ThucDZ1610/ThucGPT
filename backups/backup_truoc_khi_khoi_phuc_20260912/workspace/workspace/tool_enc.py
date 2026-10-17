import sys
import base64
import zlib
import marshal

# ==============================================================================
# 👑 CÔNG CỤ MÃ HÓA PYTHON ĐA TẦNG (MULTI-LAYER OBFUSCATOR)
# Sáng lập và điều hành bởi: THỨC (Chủ nhân tối cao)
# Cấu trúc chuẩn Production - Tối ưu hóa bảo mật mã nguồn Python
# ==============================================================================

def compress_and_encode(source_code: str) -> str:
    """Mã hóa chuỗi code qua các tầng: UTF-8 -> Zlib Compression -> Base64"""
    byte_code = source_code.encode('utf-8')
    compressed = zlib.compress(byte_code, level=9)
    encoded = base64.b64encode(compressed).decode('utf-8')
    return encoded

def generate_marshalled_payload(source_code: str) -> str:
    """Biên dịch source code thành Bytecode (Marshal) kết hợp Base64"""
    compiled_code = compile(source_code, '<string>', 'exec')
    marshalled_bytes = marshal.dumps(compiled_code)
    encoded_marshal = base64.b64encode(marshalled_bytes).decode('utf-8')
    
    stub = f"""# -*- coding: utf-8 -*-
# Được bảo vệ và mã hóa độc quyền bởi: THỨC THINKING PRO
import marshal, base64, zlib

try:
    _m_data = base64.b64decode("{encoded_marshal}")
    _code_obj = marshal.loads(_m_data)
    exec(_code_obj)
except Exception as _e:
    print(f"[-] Lỗi thực thi tệp được mã hóa: {{_e}}")
"""
    return stub

def generate_multi_layer_payload(source_code: str, layers: int = 3) -> str:
    """Tạo mã hóa đa tầng (Multi-layer Obfuscation)"""
    current_code = source_code
    
    for layer in range(1, layers + 1):
        encoded = compress_and_encode(current_code)
        current_code = f"""# -*- coding: utf-8 -*-
# Tầng mã hóa số {layer} - Hệ thống Thức Turbo Pro
import base64, zlib
exec(zlib.decompress(base64.b64decode("{encoded}").decode('utf-8').encode('latin1')).decode('utf-8'))
"""
    
    # Tầng cuối cùng dùng Marshal để tối ưu hiệu năng
    compiled_code = compile(current_code, '<string>', 'exec')
    marshalled_bytes = base64.b64encode(marshal.dumps(compiled_code)).decode('utf-8')
    
    final_stub = f"""# -*- coding: utf-8 -*-
# ==========================================
# 👑 ĐƯỢC MÃ HÓA VÀ BẢO VỆ BỞI: CHỦ NHÂN THỨC
# ==========================================
import marshal, base64

def _thuc_dec():
    try:
        _b = base64.b64decode("{marshalled_bytes}")
        exec(marshal.loads(_b))
    except Exception as ex:
        print("Bảo mật kích hoạt: Truy cập bị từ chối!")
if __name__ == '__main__':
    _thuc_dec()
"""
    return final_stub

def main():
    print("=" * 60)
    print(" 👑 CÔNG CỤ MÃ HÓA PYTHON TỐI CAO - THỨC TURBO PRO")
    print("=" * 60)
    
    if len(sys.argv) < 2:
        print("[-] Hướng dẫn sử dụng:")
        print("    python tool_enc.py <file_can_ma_hoa.py> [so_tang_enc]")
        sys.exit(1)
        
    input_file = sys.argv[1]
    layers = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            source_code = f.read()
    except FileNotFoundError:
        print(f"[-] Không tìm thấy file: {input_file}")
        sys.exit(1)
        
    print(f"[*] Đang tiến hành mã hóa file: {input_file} với {layers} tầng...")
    
    # Tạo mã nguồn sau khi mã hóa
    protected_code = generate_multi_layer_payload(source_code, layers)
    
    output_file = input_file.replace('.py', '_encrypted.py')
    if output_file == input_file:
        output_file = 'protected_' + input_file
        
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(protected_code)
        
    print(f"[+] Mã hóa thành công! File đầu ra: {output_file}")
    print("=" * 60)

if __name__ == '__main__':
    main()
