"""
ComfyUI-MK_Tools
图像选择和填充空洞节点插件
"""

from .nodes.image_selection import NODE_CLASS_MAPPINGS as IMAGE_SELECTION_MAPPINGS
from .nodes.fill_holes import NODE_CLASS_MAPPINGS as FILL_HOLES_MAPPINGS

# 合并所有节点映射
NODE_CLASS_MAPPINGS = {
    **IMAGE_SELECTION_MAPPINGS,
    **FILL_HOLES_MAPPINGS,
}

# 节点显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_ImageSelector": "MK-图像选择器",
    "MK_FillHoles": "MK-遮罩填充空洞",
}

# Web 目录
WEB_DIRECTORY = "./web"

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']
