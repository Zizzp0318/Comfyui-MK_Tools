"""
MK-图像裁剪节点测试脚本
用于验证节点功能是否正常
"""

import torch
import sys
import os

# 添加 ComfyUI 根目录到路径
comfyui_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, comfyui_path)

# 导入 ComfyUI 的 nodes 模块
import nodes as comfy_nodes

# 直接导入本地的图像裁剪模块
current_dir = os.path.dirname(os.path.abspath(__file__))
image_crop_path = os.path.join(current_dir, 'nodes', 'image_crop.py')

# 使用 exec 执行模块
with open(image_crop_path, 'r', encoding='utf-8') as f:
    code = f.read()
    # 替换导入语句
    code = code.replace('from nodes import MAX_RESOLUTION', f'MAX_RESOLUTION = {comfy_nodes.MAX_RESOLUTION}')
    exec(code, globals())


def test_image_crop():
    """测试图像裁剪节点"""
    print("=" * 60)
    print("测试 MK-图像裁剪节点")
    print("=" * 60)

    # 创建节点实例
    node = MK_ImageCrop()

    # 创建测试图像 (batch=1, height=1080, width=1920, channels=3)
    test_image = torch.rand(1, 1080, 1920, 3)
    print(f"\n原始图像尺寸: {test_image.shape}")

    # 测试1: 居中裁剪
    print("\n测试1: 居中裁剪 512x512")
    result_image, x, y = node.execute(
        image=test_image,
        width=512,
        height=512,
        position="center",
        x_offset=0,
        y_offset=0
    )
    print(f"  裁剪后尺寸: {result_image.shape}")
    print(f"  裁剪位置: x={x}, y={y}")
    assert result_image.shape == (1, 512, 512, 3), "居中裁剪尺寸错误"
    assert x == 704 and y == 284, f"居中裁剪坐标错误: x={x}, y={y}"
    print("  ✓ 通过")

    # 测试2: 左上角裁剪
    print("\n测试2: 左上角裁剪 256x256")
    result_image, x, y = node.execute(
        image=test_image,
        width=256,
        height=256,
        position="top-left",
        x_offset=0,
        y_offset=0
    )
    print(f"  裁剪后尺寸: {result_image.shape}")
    print(f"  裁剪位置: x={x}, y={y}")
    assert result_image.shape == (1, 256, 256, 3), "左上角裁剪尺寸错误"
    assert x == 0 and y == 0, f"左上角裁剪坐标错误: x={x}, y={y}"
    print("  ✓ 通过")

    # 测试3: 右下角裁剪
    print("\n测试3: 右下角裁剪 512x512")
    result_image, x, y = node.execute(
        image=test_image,
        width=512,
        height=512,
        position="bottom-right",
        x_offset=0,
        y_offset=0
    )
    print(f"  裁剪后尺寸: {result_image.shape}")
    print(f"  裁剪位置: x={x}, y={y}")
    assert result_image.shape == (1, 512, 512, 3), "右下角裁剪尺寸错误"
    assert x == 1408 and y == 568, f"右下角裁剪坐标错误: x={x}, y={y}"
    print("  ✓ 通过")

    # 测试4: 带偏移的裁剪
    print("\n测试4: 居中裁剪 + 偏移 (x=100, y=50)")
    result_image, x, y = node.execute(
        image=test_image,
        width=512,
        height=512,
        position="center",
        x_offset=100,
        y_offset=50
    )
    print(f"  裁剪后尺寸: {result_image.shape}")
    print(f"  裁剪位置: x={x}, y={y}")
    assert result_image.shape == (1, 512, 512, 3), "带偏移裁剪尺寸错误"
    assert x == 804 and y == 334, f"带偏移裁剪坐标错误: x={x}, y={y}"
    print("  ✓ 通过")

    # 测试5: 超出边界的裁剪（应自动调整）
    print("\n测试5: 超出边界的裁剪（宽度超出）")
    result_image, x, y = node.execute(
        image=test_image,
        width=2500,  # 超过原图宽度
        height=512,
        position="center",
        x_offset=0,
        y_offset=0
    )
    print(f"  裁剪后尺寸: {result_image.shape}")
    print(f"  裁剪位置: x={x}, y={y}")
    assert result_image.shape[2] == 1920, "超出边界裁剪未正确调整宽度"
    print("  ✓ 通过（已自动调整为原图宽度）")

    # 测试6: 批量图像裁剪
    print("\n测试6: 批量图像裁剪 (batch=3)")
    batch_image = torch.rand(3, 1080, 1920, 3)
    result_image, x, y = node.execute(
        image=batch_image,
        width=512,
        height=512,
        position="center",
        x_offset=0,
        y_offset=0
    )
    print(f"  裁剪后尺寸: {result_image.shape}")
    print(f"  裁剪位置: x={x}, y={y}")
    assert result_image.shape == (3, 512, 512, 3), "批量裁剪尺寸错误"
    print("  ✓ 通过")

    # 测试7: 所有位置选项
    print("\n测试7: 测试所有位置选项")
    positions = [
        "top-left", "top-center", "top-right",
        "left-center", "center", "right-center",
        "bottom-left", "bottom-center", "bottom-right"
    ]
    for pos in positions:
        result_image, x, y = node.execute(
            image=test_image,
            width=512,
            height=512,
            position=pos,
            x_offset=0,
            y_offset=0
        )
        print(f"  {pos:15s}: x={x:4d}, y={y:4d} ✓")

    print("\n" + "=" * 60)
    print("所有测试通过！ 🎉")
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_image_crop()
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
