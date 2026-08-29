"""
MK-分辨率选择器节点
基于ComfyUI官方ResolutionSelector扩展
通过宽高比和百万像素计算输出分辨率
"""

import math


class MK_ResolutionSelector:
    """
    分辨率选择器节点
    根据宽高比和目标百万像素数自动计算合适的宽度和高度
    """

    # 宽高比映射表 - 只定义比例关系，不含具体尺寸
    ASPECT_RATIOS = {
        # 方形
        "1:1 方形": (1, 1),

        # 经典照片比例
        "2:3 竖版照片": (2, 3),
        "3:2 横版照片": (3, 2),
        "3:4 竖版标准": (3, 4),
        "4:3 横版标准": (4, 3),
        "4:5 竖版社交": (4, 5),
        "5:4 横版社交": (5, 4),

        # 宽屏比例
        "9:16 竖版宽屏": (9, 16),
        "16:9 横版宽屏": (16, 9),
        "9:19 竖版更宽": (9, 19),
        "19:9 横版更宽": (19, 9),
        "9:21 竖版超宽": (9, 21),
        "21:9 横版超宽": (21, 9),

        # 电影比例
        "1.85:1 美国宽屏": (185, 100),
        "2.35:1 电影宽屏": (235, 100),
        "2.39:1 超宽银幕": (239, 100),
        "2.40:1 宽银幕": (240, 100),

        # 打印和设计比例
        "A4竖版": (210, 297),
        "A4横版": (297, 210),
        "黄金比例竖版": (1, 1.618),
        "黄金比例横版": (1.618, 1),

        # 其他常用比例
        "2:1 双倍宽": (2, 1),
        "1:2 双倍高": (1, 2),
        "3:1 超宽横版": (3, 1),
        "1:3 超高竖版": (1, 3),
    }

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "宽高比": (list(cls.ASPECT_RATIOS.keys()), {
                    "default": "1:1 方形",
                }),
                "百万像素": ("FLOAT", {
                    "default": 1.0,
                    "min": 0.1,
                    "max": 10.0,
                    "step": 0.1,
                    "display": "slider",
                }),
                "对齐倍数": ("INT", {
                    "default": 8,
                    "min": 1,
                    "max": 128,
                    "step": 1,
                }),
            }
        }

    RETURN_TYPES = ("INT", "INT")
    RETURN_NAMES = ("宽度", "高度")
    FUNCTION = "calculate_resolution"
    CATEGORY = "MK_Tools/utilities"
    DESCRIPTION = "根据宽高比和目标百万像素数计算合适的分辨率。1.0百万像素 ≈ 1024x1024方形。"

    def calculate_resolution(self, 宽高比, 百万像素, 对齐倍数):
        """
        计算分辨率

        参数:
            宽高比: 选择的宽高比
            百万像素: 目标百万像素数
            对齐倍数: 输出尺寸对齐的倍数（通常为8，适配VAE）

        返回:
            (宽度, 高度)
        """
        # 获取宽高比数值
        w_ratio, h_ratio = self.ASPECT_RATIOS[宽高比]

        # 计算总像素数
        total_pixels = 百万像素 * 1024 * 1024

        # 根据宽高比计算缩放系数
        scale = math.sqrt(total_pixels / (w_ratio * h_ratio))

        # 计算宽度和高度，并对齐到指定倍数
        width = round(w_ratio * scale / 对齐倍数) * 对齐倍数
        height = round(h_ratio * scale / 对齐倍数) * 对齐倍数

        # 确保至少是对齐倍数
        width = max(对齐倍数, width)
        height = max(对齐倍数, height)

        return (int(width), int(height))


# 节点映射
NODE_CLASS_MAPPINGS = {
    "MK_ResolutionSelector": MK_ResolutionSelector,
}

# 显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_ResolutionSelector": "MK-分辨率选择器",
}
