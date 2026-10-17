#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI TURBO PRO - NEURAL IMAGE ENHANCER & UPSCALER
Sử dụng Pillow (PIL) để làm nét, khử mờ và nâng cấp độ phân giải ảnh (2X Super-Resolution).
"""

import sys
import json
import base64
import io
from PIL import Image, ImageFilter, ImageEnhance

def enhance_image(base64_str, scale=2, sharpness_factor=1.6, contrast_factor=1.06):
    try:
        # Bỏ phần header data:image/...;base64, nếu có
        if ',' in base64_str:
            base64_str = base64_str.split(',', 1)[1]

        image_data = base64.b64decode(base64_str)
        img = Image.open(io.BytesIO(image_data))

        # Chuyển đổi màu sắc an toàn sang RGB nếu cần
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            pass
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        orig_w, orig_h = img.size

        # 1. Nâng cấp độ phân giải bằng thuật toán nội suy chất lượng cao Lanczos
        if scale > 1:
            new_w = int(orig_w * scale)
            new_h = int(orig_h * scale)
            resample_filter = getattr(Image, 'Resampling', Image).LANCZOS
            img = img.resize((new_w, new_h), resample=resample_filter)

        # 2. Áp dụng bộ lọc tăng cường chi tiết (Detail Enhancement)
        img = img.filter(ImageFilter.DETAIL)

        # 3. Thuật toán Unsharp Masking: Khử mờ viền cạnh (Edge De-blurring)
        img = img.filter(ImageFilter.UnsharpMask(radius=2.2, percent=170, threshold=2))

        # 4. Tăng cường độ sắc nét (Sharpness Enhancement)
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(sharpness_factor)

        # 5. Tinh chỉnh độ tương phản nhẹ để ảnh trong trẻo và nổi khối hơn
        contrast_enhancer = ImageEnhance.Contrast(img)
        img = contrast_enhancer.enhance(contrast_factor)

        # Xuất kết quả sang Base64
        output_buffer = io.BytesIO()
        output_format = 'PNG' if img.mode in ('RGBA', 'LA') else 'JPEG'
        
        if output_format == 'JPEG':
            img.save(output_buffer, format='JPEG', quality=95, optimize=True)
            mime = 'image/jpeg'
        else:
            img.save(output_buffer, format='PNG', optimize=True)
            mime = 'image/png'

        enhanced_b64 = base64.b64encode(output_buffer.getvalue()).decode('utf-8')
        final_w, final_h = img.size

        return {
            'success': True,
            'mime': mime,
            'dataUrl': f'data:{mime};base64,{enhanced_b64}',
            'originalSize': {'width': orig_w, 'height': orig_h},
            'enhancedSize': {'width': final_w, 'height': final_h},
            'scale': scale,
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

def main():
    try:
        # Đọc dữ liệu JSON từ stdin
        raw_input = sys.stdin.read().strip()
        if not raw_input:
            print(json.dumps({'success': False, 'error': 'No input provided'}))
            return

        payload = json.loads(raw_input)
        image_b64 = payload.get('image', '')
        scale = float(payload.get('scale', 2))
        sharpness = float(payload.get('sharpness', 1.6))
        contrast = float(payload.get('contrast', 1.06))

        result = enhance_image(image_b64, scale=scale, sharpness_factor=sharpness, contrast_factor=contrast)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == '__main__':
    main()
