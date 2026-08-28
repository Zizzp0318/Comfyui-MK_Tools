"""
简易图像对比节点 - Simple Image Compare
从 ComfyUI-Danbooru-Gallery 提取并适配
原始代码: https://github.com/AlekPet/ComfyUI-Danbooru-Gallery
"""

from nodes import PreviewImage


class MK_SimpleImageCompare(PreviewImage):
    """
    简易图像对比节点 (MK-简易图像对比)
    通过滑动对比两张图像

    原始节点: SimpleImageCompare
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "图像A": ("IMAGE",),
                "图像B": ("IMAGE",),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO"
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "compare_images"
    OUTPUT_NODE = True
    CATEGORY = "MK_Tools/图像"
    DESCRIPTION = "通过滑动对比两张图像"

    def compare_images(self,
                      图像A=None,
                      图像B=None,
                      filename_prefix="mk_simple_compare.",
                      prompt=None,
                      extra_pnginfo=None):
        """
        对比两张图像

        Args:
            图像A: 第一张图像
            图像B: 第二张图像
            filename_prefix: 文件名前缀
            prompt: 提示信息
            extra_pnginfo: 额外的 PNG 信息

        Returns:
            UI 结果，包含两张图像的数据
        """

        result = {"ui": {"a_images": [], "b_images": []}}

        if 图像A is not None and len(图像A) > 0:
            result['ui']['a_images'] = self.save_images(
                图像A, filename_prefix, prompt, extra_pnginfo
            )['ui']['images']

        if 图像B is not None and len(图像B) > 0:
            result['ui']['b_images'] = self.save_images(
                图像B, filename_prefix, prompt, extra_pnginfo
            )['ui']['images']

        return result


# Node class mappings
NODE_CLASS_MAPPINGS = {
    "MK_SimpleImageCompare": MK_SimpleImageCompare
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_SimpleImageCompare": "MK-简易图像对比"
}
