"""
填充空洞节点 - Mask Hole Filler
从 LAOGOU-666/Comfyui_LG_Tools 提取并适配
"""

import torch
import numpy as np
import cv2

class MK_FillHoles:
    """
    填充空洞节点
    使用 floodFill 算法填充遮罩中的空洞
    """

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "遮罩": ("MASK",),  # 输入维度: (B, H, W)
            }
        }

    RETURN_TYPES = ("MASK",)
    RETURN_NAMES = ("已填充遮罩",)
    FUNCTION = "fill_mask_holes"
    CATEGORY = "MK_Tools/遮罩"

    def fill_mask_holes(self, 遮罩):
        """
        填充遮罩中的空洞

        使用 OpenCV 的 floodFill 算法从外部填充，然后反转得到填充后的遮罩

        Args:
            遮罩: 输入遮罩，形状为 (B, H, W)

        Returns:
            filled_mask: 填充后的遮罩，形状为 (B, H, W)
        """
        filled_masks = []

        for i in range(遮罩.shape[0]):
            # 转换为二值遮罩
            mask_np = (遮罩[i].cpu().numpy() > 0.5).astype(np.uint8)
            h, w = mask_np.shape

            # 在遮罩周围添加1像素的边框（值为0），确保外部区域连通
            padded_mask = np.pad(mask_np, pad_width=1, mode='constant', constant_values=0)

            # 创建 floodFill 所需的 mask，必须比 padded_mask 大2
            floodfill = padded_mask.copy()
            mask_ff = np.zeros((h + 4, w + 4), np.uint8)

            # 从 (0,0) 点进行 floodFill，填充外部区域
            cv2.floodFill(floodfill, mask_ff, (0, 0), 1)

            # floodfill==0 的地方是内部的空洞
            holes = (floodfill == 0).astype(np.uint8)

            # 移除边框，恢复原始尺寸
            holes = holes[1:-1, 1:-1]

            # 原 mask 加上空洞部分
            filled = np.clip(mask_np + holes, 0, 1)
            filled_tensor = torch.from_numpy(filled).float()
            filled_masks.append(filled_tensor)

        filled_mask = torch.stack(filled_masks)
        return (filled_mask,)

# Node class mappings
NODE_CLASS_MAPPINGS = {
    "MK_FillHoles": MK_FillHoles
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_FillHoles": "MK-遮罩填充空洞"
}
