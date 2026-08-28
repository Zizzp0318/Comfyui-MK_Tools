"""
图像保存节点 - Save Image
从 comfyui-zxx-tool 提取并适配
原始代码: https://github.com/GentlemanHu/ComfyUI-ZXXNodes
"""

import json
import os
from PIL import Image
from PIL.PngImagePlugin import PngInfo
import numpy as np
import folder_paths


class MK_SaveImage:
    """
    图像保存节点 (MK-图像保存)
    保存图像，支持 PNG / JPEG / WEBP 格式与质量设置

    原始节点: ZXX_图像保存（预览）
    """

    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
        self.type = "output"
        self.prefix_append = ""
        self.compress_level = 4

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "图像": ("IMAGE",),
                "文件名前缀": ("STRING", {"default": "ComfyUI"}),
                "图像格式": (["PNG", "JPEG", "WEBP"], {"default": "PNG"}),
                "质量": ("INT", {"default": 95, "min": 1, "max": 100, "step": 1}),
                "保存元数据": ("BOOLEAN", {"default": True}),
                "仅预览": ("BOOLEAN", {"default": False}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO"
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "save_images"
    OUTPUT_NODE = True
    CATEGORY = "MK_Tools/图像"

    def save_images(self, 图像, 文件名前缀="ComfyUI", 图像格式="PNG", 质量=95, 保存元数据=True, 仅预览=False, prompt=None, extra_pnginfo=None):
        """
        保存图像

        Args:
            图像: 输入图像张量 (batch, height, width, channels)
            文件名前缀: 文件名前缀
            图像格式: 图像格式 (PNG/JPEG/WEBP)
            质量: 图像质量 (1-100)
            保存元数据: 是否保存元数据
            仅预览: 仅预览不保存
            prompt: 提示词
            extra_pnginfo: 额外的 PNG 信息

        Returns:
            UI 结果，包含保存的图像信息
        """
        filename_prefix = 文件名前缀

        # 如果是仅预览模式，使用临时目录
        if 仅预览:
            full_output_folder = folder_paths.get_temp_directory()
            filename = "preview"
            counter = 0
            subfolder = ""
        else:
            full_output_folder, filename, counter, subfolder, filename_prefix = folder_paths.get_save_image_path(
                filename_prefix, self.output_dir, 图像[0].shape[1], 图像[0].shape[0]
            )

        results = []

        for batch_number, image_tensor in enumerate(图像):
            # 转换张量到 numpy 数组 (0-255)
            i = 255. * image_tensor.cpu().numpy()
            img_array = np.clip(i, 0, 255).astype(np.uint8)
            pil_image = Image.fromarray(img_array)

            # 构建文件名
            file_extension = 图像格式.lower()
            if file_extension == "jpeg":
                file_extension = "jpg"

            filename_with_batch_num = filename.replace("%batch_num%", str(batch_number))
            file = f"{filename_with_batch_num}_{counter:05}_.{file_extension}"
            filepath = os.path.join(full_output_folder, file)

            # 准备保存参数
            save_kwargs = {}

            if 图像格式 == "PNG":
                # PNG 压缩级别：质量越高，压缩级别越低
                compress_level = max(0, min(9, round((100 - 质量) * 9 / 100)))
                save_kwargs["compress_level"] = compress_level

                # 保存元数据（仅在非预览模式且开启元数据保存时）
                if 保存元数据 and not 仅预览:
                    png_metadata = PngInfo()
                    if prompt:
                        png_metadata.add_text("prompt", json.dumps(prompt))
                    if isinstance(extra_pnginfo, dict):
                        for k, v in extra_pnginfo.items():
                            png_metadata.add_text(k, json.dumps(v))
                    save_kwargs["pnginfo"] = png_metadata

            elif 图像格式 in ("JPEG", "WEBP"):
                save_kwargs["quality"] = 质量
                if 图像格式 == "JPEG":
                    save_kwargs["optimize"] = True
                    # JPEG 不支持 alpha 通道
                    if pil_image.mode == "RGBA":
                        pil_image = pil_image.convert("RGB")

            # 保存图像
            pil_image.save(filepath, **save_kwargs)

            results.append({
                "filename": file,
                "subfolder": subfolder,
                "type": "temp" if 仅预览 else self.type
            })

            counter += 1

        return {"ui": {"images": results}}


# Node class mappings
NODE_CLASS_MAPPINGS = {
    "MK_SaveImage": MK_SaveImage
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_SaveImage": "MK-图像保存"
}
