"""
ComfyUI-MK_Tools
图像选择和填充空洞节点插件
"""

from .nodes.image_selection import NODE_CLASS_MAPPINGS as IMAGE_SELECTION_MAPPINGS
from .nodes.fill_holes import NODE_CLASS_MAPPINGS as FILL_HOLES_MAPPINGS
from .nodes.prompt_concat import NODE_CLASS_MAPPINGS as PROMPT_CONCAT_MAPPINGS
from .nodes.simple_image_compare import NODE_CLASS_MAPPINGS as SIMPLE_IMAGE_COMPARE_MAPPINGS
from .nodes.save_image import NODE_CLASS_MAPPINGS as SAVE_IMAGE_MAPPINGS

# 合并所有节点映射
NODE_CLASS_MAPPINGS = {
    **IMAGE_SELECTION_MAPPINGS,
    **FILL_HOLES_MAPPINGS,
    **PROMPT_CONCAT_MAPPINGS,
    **SIMPLE_IMAGE_COMPARE_MAPPINGS,
    **SAVE_IMAGE_MAPPINGS,
}

# 节点显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_ImageSelector": "MK-图像选择器",
    "MK_FillHoles": "MK-遮罩填充空洞",
    "MK_PromptConcat": "MK-提示词拼接",
    "MK_SimpleImageCompare": "MK-简易图像对比",
    "MK_SaveImage": "MK-图像保存",
}

# Web 目录
WEB_DIRECTORY = "./web"

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']
