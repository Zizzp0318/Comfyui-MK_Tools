"""
MK-加载图像节点
基于 ComfyUI 官方 LoadImage 节点，增加按总像素数量缩放功能，支持设置尺寸倍数约束
"""

import os
import torch
import numpy as np
import hashlib
from PIL import Image, ImageOps, ImageSequence

import folder_paths
import node_helpers
import comfy.model_management
from comfy_api.latest import InputImpl


class MK_ImageLoader:
    """
    加载图像节点，支持按总像素数量缩放，可设置尺寸倍数约束
    """

    @classmethod
    def INPUT_TYPES(cls):
        input_dir = folder_paths.get_input_directory()
        files = [f for f in os.listdir(input_dir) if os.path.isfile(os.path.join(input_dir, f))]
        files = folder_paths.filter_files_content_types(files, ["image"])
        return {
            "required": {
                "image": (sorted(files), {"image_upload": True}),
                "缩放模式": (["禁用", "按总像素数"],),
                "目标总像素数": ("FLOAT", {
                    "default": 1.0,
                    "min": 0.1,
                    "max": 100.0,
                    "step": 0.1,
                    "display": "number",
                }),
                "尺寸倍数": ("INT", {
                    "default": 8,
                    "min": 1,
                    "max": 128,
                    "step": 1,
                    "display": "number",
                }),
                "缩放算法": (["lanczos", "bicubic", "bilinear", "nearest"],),
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK", "INT", "INT")
    RETURN_NAMES = ("图像", "遮罩", "宽度", "高度")
    INPUT_IS_LIST = False
    OUTPUT_IS_LIST = (False, False, False, False)
    FUNCTION = "load_image"
    CATEGORY = "MK_Tools/image"

    def load_image(self, image, 缩放模式, 目标总像素数, 尺寸倍数, 缩放算法):
        """
        加载图像并根据设置进行缩放

        参数:
            image: 图像文件名
            缩放模式: 缩放模式（禁用/按总像素数）
            目标总像素数: 目标总像素数（百万）
            尺寸倍数: 输出尺寸必须是此数字的倍数
            缩放算法: 缩放算法

        返回:
            图像张量, 遮罩张量, 宽度, 高度
        """
        image_path = folder_paths.get_annotated_filepath(image)

        dtype = comfy.model_management.intermediate_dtype()
        device = comfy.model_management.intermediate_device()

        # 首先尝试使用视频加载器（支持视频帧和图像）
        components = InputImpl.VideoFromFile(image_path).get_components()
        if components.images.shape[0] > 0:
            image_tensor = components.images.to(device=device, dtype=dtype)
            if components.alpha is not None:
                mask_tensor = (1.0 - components.alpha[..., -1]).to(device=device, dtype=dtype)
            else:
                mask_tensor = torch.zeros((components.images.shape[0], 64, 64), dtype=dtype, device=device)
        else:
            # 降级处理：处理动态 WebP（pyav 不支持）
            img = node_helpers.pillow(Image.open, image_path)

            output_images = []
            output_masks = []
            w, h = None, None

            for i in ImageSequence.Iterator(img):
                i = node_helpers.pillow(ImageOps.exif_transpose, i)

                image = i.convert("RGB")

                if len(output_images) == 0:
                    w = image.size[0]
                    h = image.size[1]

                if image.size[0] != w or image.size[1] != h:
                    continue

                image = np.array(image).astype(np.float32) / 255.0
                image = torch.from_numpy(image)[None,]
                if 'A' in i.getbands():
                    mask = np.array(i.getchannel('A')).astype(np.float32) / 255.0
                    mask = 1. - torch.from_numpy(mask)
                else:
                    mask = torch.zeros((64, 64), dtype=torch.float32, device="cpu")
                output_images.append(image.to(dtype=dtype))
                output_masks.append(mask.unsqueeze(0).to(dtype=dtype))

            image_tensor = torch.cat(output_images, dim=0).to(device=device, dtype=dtype)
            mask_tensor = torch.cat(output_masks, dim=0).to(device=device, dtype=dtype)

        # 获取原始尺寸
        _, orig_h, orig_w, _ = image_tensor.shape

        # 根据缩放模式处理
        if 缩放模式 == "按总像素数":
            # 计算当前总像素数（百万）
            current_pixels = (orig_w * orig_h) / 1_000_000
            target_pixels = 目标总像素数

            if current_pixels > 0:
                # 计算缩放比例
                scale = (target_pixels / current_pixels) ** 0.5
                new_w = int(orig_w * scale)
                new_h = int(orig_h * scale)

                # 调整到最接近的倍数
                new_w = self._round_to_multiple(new_w, 尺寸倍数)
                new_h = self._round_to_multiple(new_h, 尺寸倍数)

                # 确保尺寸至少为倍数值
                new_w = max(尺寸倍数, new_w)
                new_h = max(尺寸倍数, new_h)

                # 缩放图像和遮罩
                image_tensor = self._resize_image(image_tensor, new_w, new_h, 缩放算法)
                mask_tensor = self._resize_mask(mask_tensor, new_w, new_h, 缩放算法)
        elif 缩放模式 == "禁用":
            # 即使禁用缩放，也需要确保尺寸是倍数的整数倍
            if orig_w % 尺寸倍数 != 0 or orig_h % 尺寸倍数 != 0:
                new_w = self._round_to_multiple(orig_w, 尺寸倍数)
                new_h = self._round_to_multiple(orig_h, 尺寸倍数)

                # 缩放图像和遮罩
                image_tensor = self._resize_image(image_tensor, new_w, new_h, 缩放算法)
                mask_tensor = self._resize_mask(mask_tensor, new_w, new_h, 缩放算法)

        # 获取最终尺寸
        _, final_h, final_w, _ = image_tensor.shape

        return (image_tensor, mask_tensor, final_w, final_h)

    def _round_to_multiple(self, value, multiple):
        """
        将数值调整到最接近的倍数

        参数:
            value: 原始数值
            multiple: 倍数

        返回:
            调整后的数值
        """
        return round(value / multiple) * multiple

    def _resize_image(self, image_tensor, new_w, new_h, method):
        """
        缩放图像张量

        参数:
            image_tensor: 图像张量 [batch, height, width, channels]
            new_w: 新宽度
            new_h: 新高度
            method: 缩放方法

        返回:
            缩放后的图像张量
        """
        # 转换为 [batch, channels, height, width]
        image = image_tensor.permute(0, 3, 1, 2)

        # PIL 方法映射
        pil_methods = {
            "lanczos": Image.Resampling.LANCZOS,
            "bicubic": Image.Resampling.BICUBIC,
            "bilinear": Image.Resampling.BILINEAR,
            "nearest": Image.Resampling.NEAREST,
        }

        resized_images = []
        for i in range(image.shape[0]):
            # 转换为 PIL 图像
            img_np = image[i].permute(1, 2, 0).cpu().numpy()
            img_np = (img_np * 255).clip(0, 255).astype(np.uint8)
            pil_img = Image.fromarray(img_np)

            # 缩放
            resample_method = pil_methods.get(method, Image.Resampling.LANCZOS)
            pil_img = pil_img.resize((new_w, new_h), resample_method)

            # 转换回张量
            img_np = np.array(pil_img).astype(np.float32) / 255.0
            img_tensor = torch.from_numpy(img_np)
            resized_images.append(img_tensor)

        # 合并批次
        result = torch.stack(resized_images, dim=0)

        return result.to(device=image_tensor.device, dtype=image_tensor.dtype)

    def _resize_mask(self, mask_tensor, new_w, new_h, method):
        """
        缩放遮罩张量

        参数:
            mask_tensor: 遮罩张量 [batch, height, width] 或 [batch, 1, height, width]
            new_w: 新宽度
            new_h: 新高度
            method: 缩放方法

        返回:
            缩放后的遮罩张量
        """
        # 处理遮罩尺寸
        if len(mask_tensor.shape) == 3:
            mask_tensor = mask_tensor.unsqueeze(1)  # [batch, 1, height, width]

        # PIL 方法映射
        pil_methods = {
            "lanczos": Image.Resampling.LANCZOS,
            "bicubic": Image.Resampling.BICUBIC,
            "bilinear": Image.Resampling.BILINEAR,
            "nearest": Image.Resampling.NEAREST,
        }

        resized_masks = []
        for i in range(mask_tensor.shape[0]):
            # 转换为 PIL 图像
            mask_np = mask_tensor[i, 0].cpu().numpy()
            mask_np = (mask_np * 255).clip(0, 255).astype(np.uint8)
            pil_mask = Image.fromarray(mask_np, mode='L')

            # 缩放
            resample_method = pil_methods.get(method, Image.Resampling.LANCZOS)
            pil_mask = pil_mask.resize((new_w, new_h), resample_method)

            # 转换回张量
            mask_np = np.array(pil_mask).astype(np.float32) / 255.0
            mask_tensor_single = torch.from_numpy(mask_np)
            resized_masks.append(mask_tensor_single)

        # 合并批次
        result = torch.stack(resized_masks, dim=0)

        return result.to(device=mask_tensor.device, dtype=mask_tensor.dtype)

    @classmethod
    def IS_CHANGED(cls, image, **kwargs):
        """检测文件是否变化（包括遮罩编辑）"""
        image_path = folder_paths.get_annotated_filepath(image)

        # 获取文件修改时间和大小
        stat_info = os.stat(image_path)
        mtime = stat_info.st_mtime
        size = stat_info.st_size

        # 计算文件哈希
        m = hashlib.sha256()
        with open(image_path, 'rb') as f:
            m.update(f.read())

        # 组合文件修改时间、大小和哈希值，确保任何变化都能被检测到
        return f"{mtime}_{size}_{m.digest().hex()}"

    @classmethod
    def VALIDATE_INPUTS(cls, image, **kwargs):
        """验证输入"""
        if not folder_paths.exists_annotated_filepath(image):
            return "Invalid image file: {}".format(image)
        return True


# 节点映射
NODE_CLASS_MAPPINGS = {
    "MK_ImageLoader": MK_ImageLoader,
}

# 节点显示名称映射
NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_ImageLoader": "MK-加载图像",
}
