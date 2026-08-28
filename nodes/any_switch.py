"""
任意切换节点 - Any Switch
从 rgthree-comfy 提取
原始代码: https://github.com/rgthree/rgthree-comfy
"""


def is_context_empty(ctx):
    """检查 context 是否为空"""
    return not ctx or all(v is None for v in ctx.values())


def is_none(value):
    """检查值是否为 None"""
    if value is not None:
        if isinstance(value, dict) and 'model' in value and 'clip' in value:
            return is_context_empty(value)
    return value is None


class AnyType(str):
    """特殊类型，用于表示任意类型"""
    def __ne__(self, __value: object) -> bool:
        return False


class FlexibleOptionalInputType(dict):
    """灵活的可选输入类型

    允许动态数量和类型的输入
    Credit to pythongosssss and rgthree
    """

    def __init__(self, input_type, data=None):
        self.type = input_type
        self.data = data
        if self.data is not None:
            for k, v in self.data.items():
                self[k] = v

    def __getitem__(self, key):
        if self.data is not None and key in self.data:
            val = self.data[key]
            return val
        return (self.type,)

    def __contains__(self, key):
        return True


any_type = AnyType("*")


class MK_AnySwitch:
    """
    任意切换节点 (MK-任意切换)
    从多个输入中选择第一个非空值输出

    原始节点: Any Switch (rgthree)
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": FlexibleOptionalInputType(any_type),
        }

    RETURN_TYPES = (any_type,)
    RETURN_NAMES = ("*",)
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
