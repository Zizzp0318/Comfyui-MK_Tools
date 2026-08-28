"""
任意切换节点 - Any Switch
从 rgthree-comfy 提取并适配
"""

def is_none(value):
    """检查值是否为空"""
    if value is not None:
        # 检查是否为空的 context 字典
        if isinstance(value, dict) and 'model' in value and 'clip' in value:
            return all(v is None for v in value.values())
    return value is None


class AnyType(str):
    """特殊类型，表示任意类型"""
    def __ne__(self, __value: object) -> bool:
        return False


class FlexibleOptionalInputType(dict):
    """灵活的可选输入类型，支持动态数量的输入"""

    def __init__(self, input_type):
        self.type = input_type
        super().__init__()

    def __getitem__(self, key):
        return (self.type,)

    def __contains__(self, key):
        return True


any_type = AnyType("*")


class MK_AnySwitch:
    """
    任意切换节点
    从多个输入中选择第一个非空值输出
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": FlexibleOptionalInputType(any_type),
        }

    RETURN_TYPES = (any_type,)
    RETURN_NAMES = ("输出",)
    FUNCTION = "switch"
    CATEGORY = "MK_Tools/工具"

    def switch(self, **kwargs):
        """选择第一个非空项输出"""
        any_value = None
        for key, value in kwargs.items():
            if key.startswith('any_') and not is_none(value):
                any_value = value
                break
        return (any_value,)


# Node class mappings
NODE_CLASS_MAPPINGS = {
    "MK_AnySwitch": MK_AnySwitch
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_AnySwitch": "MK-任意切换"
}
