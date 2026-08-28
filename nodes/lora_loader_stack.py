"""
Lora堆加载节点 - Lora Loader Stack
从 rgthree-comfy 提取并适配
原始代码: https://github.com/rgthree/rgthree-comfy
"""

from nodes import LoraLoader
import folder_paths


class MK_LoraLoaderStack:
    """
    Lora堆加载节点 (MK-Lora堆加载)
    批量加载多个 Lora 模型

    原始节点: Lora Loader Stack (rgthree)
    修改: 从 4 个增加到 5 个 Lora
    """

    @classmethod
    def INPUT_TYPES(cls):
        loras_list = ['None'] + folder_paths.get_filename_list("loras")

        return {
            "required": {
                "model": ("MODEL",),

                "lora_01": (loras_list,),
                "强度_01": ("FLOAT", {"default": 1.0, "min": -10.0, "max": 10.0, "step": 0.01}),

                "lora_02": (loras_list,),
                "强度_02": ("FLOAT", {"default": 1.0, "min": -10.0, "max": 10.0, "step": 0.01}),

                "lora_03": (loras_list,),
                "强度_03": ("FLOAT", {"default": 1.0, "min": -10.0, "max": 10.0, "step": 0.01}),

                "lora_04": (loras_list,),
                "强度_04": ("FLOAT", {"default": 1.0, "min": -10.0, "max": 10.0, "step": 0.01}),

                "lora_05": (loras_list,),
                "强度_05": ("FLOAT", {"default": 1.0, "min": -10.0, "max": 10.0, "step": 0.01}),
            }
        }

    RETURN_TYPES = ("MODEL",)
    RETURN_NAMES = ("模型",)
    FUNCTION = "load_lora"
    CATEGORY = "MK_Tools/加载器"

    def load_lora(self, model,
                  lora_01, 强度_01,
                  lora_02, 强度_02,
                  lora_03, 强度_03,
                  lora_04, 强度_04,
                  lora_05, 强度_05):
        """
        依次加载多个 Lora 模型

        Args:
            model: 输入模型
            lora_XX: Lora 文件名
            强度_XX: Lora 强度

        Returns:
            model: 应用 Lora 后的模型
        """

        # 加载 Lora 01
        if lora_01 != "None" and 强度_01 != 0:
            model, _ = LoraLoader().load_lora(model, None, lora_01, 强度_01, 强度_01)

        # 加载 Lora 02
        if lora_02 != "None" and 强度_02 != 0:
            model, _ = LoraLoader().load_lora(model, None, lora_02, 强度_02, 强度_02)

        # 加载 Lora 03
        if lora_03 != "None" and 强度_03 != 0:
            model, _ = LoraLoader().load_lora(model, None, lora_03, 强度_03, 强度_03)

        # 加载 Lora 04
        if lora_04 != "None" and 强度_04 != 0:
            model, _ = LoraLoader().load_lora(model, None, lora_04, 强度_04, 强度_04)

        # 加载 Lora 05
        if lora_05 != "None" and 强度_05 != 0:
            model, _ = LoraLoader().load_lora(model, None, lora_05, 强度_05, 强度_05)

        return (model,)


# Node class mappings
NODE_CLASS_MAPPINGS = {
    "MK_LoraLoaderStack": MK_LoraLoaderStack
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_LoraLoaderStack": "MK-Lora堆加载"
}
