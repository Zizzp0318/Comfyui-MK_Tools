"""
MK-图像裁剪节点
从 ComfyUI_essentials 项目迁移
原始节点名称: 🔧 Image Crop
"""

import torch
from nodes import MAX_RESOLUTION


class MK_ImageCrop:
    """
    图像裁剪节点
    根据指定的宽度、高度、位置和偏移量裁剪图像
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "图像": ("IMAGE",),
                "宽度": ("INT", {
                    "default": 256,
                    "min": 0,
                    "max": MAX_RESOLUTION,
                    "step": 8,
                }),
                "高度": ("INT", {
                    "default": 256,
                    "min": 0,
                    "max": MAX_RESOLUTION,
                    "step": 8,
                }),
                "位置": ([
                    "左上角",
                    "上方居中",
                    "右上角",
                    "右侧居中",
                    "右下角",
                    "下方居中",
                    "左下角",
                    "左侧居中",
                    "居中"
                ],),
                "X轴偏移": ("INT", {
                    "default": 0,
                    "min": -99999,
                    "step": 1,
                }),
                "Y轴偏移": ("INT", {
                    "default": 0,
                    "min": -99999,
                    "step": 1,
                }),
            }
        }

    RETURN_TYPES = ("IMAGE", "INT", "INT",)
    RETURN_NAMES = ("IMAGE", "x", "y",)
    FUNCTION = "execute"
    CATEGORY = "MK_Tools/image"

    def execute(self, 图像, 宽度, 高度, 位置, X轴偏移, Y轴偏移):
        """
        执行图像裁剪

        参数:
            图像: 输入图像张量 (batch, height, width, channels)
            宽度: 裁剪宽度
            高度: 裁剪高度
            位置: 裁剪位置
            X轴偏移: X轴偏移量
            Y轴偏移: Y轴偏移量

        返回:
            裁剪后的图像, x坐标, y坐标
        """
        _, oh, ow, _ = 图像.shape

        # 确保裁剪尺寸不超过原图尺寸
        width = min(ow, 宽度)
        height = min(oh, 高度)

        # 根据位置计算裁剪起始坐标
        x = 0
        y = 0

        # 位置映射
        position_map = {
            "左上角": "top-left",
            "上方居中": "top-center",
            "右上角": "top-right",
            "右侧居中": "right-center",
            "右下角": "bottom-right",
            "下方居中": "bottom-center",
            "左下角": "bottom-left",
            "左侧居中": "left-center",
            "居中": "center"
        }

        position = position_map.get(位置, 位置)

        if "center" in position:
            x = round((ow - width) / 2)
            y = round((oh - height) / 2)
        if "top" in position:
            y = 0
        if "bottom" in position:
            y = oh - height
        if "left" in position:
            x = 0
        if "right" in position:
            x = ow - width

        # 应用偏移量
        x += X轴偏移
        y += Y轴偏移

        # 计算裁剪结束坐标
        x2 = x + width
        y2 = y + height

        # 边界检查，确保裁剪区域在图像范围内
        if x2 > ow:
            x2 = ow
        if x < 0:
            x = 0
        if y2 > oh:
            y2 = oh
        if y < 0:
            y = 0

        # 执行裁剪
        image = 图像[:, y:y2, x:x2, :]

        return (image, x, y,)


# 节点映射
NODE_CLASS_MAPPINGS = {
    "MK_ImageCrop": MK_ImageCrop,
}

# 节点显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_ImageCrop": "MK-图像裁剪",
}
