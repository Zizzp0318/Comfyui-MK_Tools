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
                "image": ("IMAGE",),
                "width": ("INT", {
                    "default": 256,
                    "min": 0,
                    "max": MAX_RESOLUTION,
                    "step": 8,
                    "display": "number",
                    "cn_name": "宽度",
                }),
                "height": ("INT", {
                    "default": 256,
                    "min": 0,
                    "max": MAX_RESOLUTION,
                    "step": 8,
                    "display": "number",
                    "cn_name": "高度",
                }),
                "position": ([
                    "top-left",
                    "top-center",
                    "top-right",
                    "right-center",
                    "bottom-right",
                    "bottom-center",
                    "bottom-left",
                    "left-center",
                    "center"
                ], {
                    "cn_name": "位置",
                }),
                "x_offset": ("INT", {
                    "default": 0,
                    "min": -99999,
                    "step": 1,
                    "display": "number",
                    "cn_name": "X轴偏移",
                }),
                "y_offset": ("INT", {
                    "default": 0,
                    "min": -99999,
                    "step": 1,
                    "display": "number",
                    "cn_name": "Y轴偏移",
                }),
            }
        }

    RETURN_TYPES = ("IMAGE", "INT", "INT",)
    RETURN_NAMES = ("IMAGE", "x", "y",)
    FUNCTION = "execute"
    CATEGORY = "MK_Tools/image"

    def execute(self, image, width, height, position, x_offset, y_offset):
        """
        执行图像裁剪

        参数:
            image: 输入图像张量 (batch, height, width, channels)
            width: 裁剪宽度
            height: 裁剪高度
            position: 裁剪位置
            x_offset: X轴偏移量
            y_offset: Y轴偏移量

        返回:
            裁剪后的图像, x坐标, y坐标
        """
        _, oh, ow, _ = image.shape

        # 确保裁剪尺寸不超过原图尺寸
        width = min(ow, width)
        height = min(oh, height)

        # 根据位置计算裁剪起始坐标
        x = 0
        y = 0

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
        x += x_offset
        y += y_offset

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
        image = image[:, y:y2, x:x2, :]

        return (image, x, y,)


# 节点映射
NODE_CLASS_MAPPINGS = {
    "MK_ImageCrop": MK_ImageCrop,
}

# 节点显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_ImageCrop": "MK-图像裁剪",
}
