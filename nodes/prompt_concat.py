"""
提示词拼接节点 - Prompt Concat
从 ComfyUI-Easy-Use 提取并适配
原始代码: https://github.com/yolain/ComfyUI-Easy-Use
"""


class MK_PromptConcat:
    """
    提示词拼接节点 (MK-提示词拼接)
    动态拼接多个提示词（最多10个）

    原始节点: easy promptConcat
    增强: 动态输入端，自动添加/移除
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "分隔符": ("STRING", {"multiline": False, "default": ", "}),
            },
            "optional": {
                "提示词_01": ("STRING", {"multiline": False, "default": "", "forceInput": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("提示词",)
    FUNCTION = "concat"
    CATEGORY = "MK_Tools/工具"

    def concat(self, 分隔符=", ", **kwargs):
        """
        拼接提示词

        Args:
            分隔符: 分隔符（默认为 ", "）
            **kwargs: 动态提示词输入

        Returns:
            提示词: 拼接后的提示词
        """
        def to_string(value):
            """将值转换为字符串"""
            if isinstance(value, (list, tuple)):
                return ", ".join(to_string(v) for v in value)
            return str(value)

        # 收集所有提示词
        prompts = []
        for i in range(1, 11):  # 最多10个
            key = f"提示词_{str(i).zfill(2)}"
            if key in kwargs and kwargs[key]:
                prompt_value = to_string(kwargs[key])
                if prompt_value:  # 只添加非空提示词
                    prompts.append(prompt_value)

        # 用分隔符连接
        result = to_string(分隔符).join(prompts)
        return (result,)


# Node class mappings
NODE_CLASS_MAPPINGS = {
    "MK_PromptConcat": MK_PromptConcat
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_PromptConcat": "MK-提示词拼接"
}
