"""
随机种子节点 - Seed
从 rgthree-comfy 提取并适配
"""

import random
from datetime import datetime

# 初始化随机状态
initial_random_state = random.getstate()
random.seed(datetime.now().timestamp())
mk_seed_random_state = random.getstate()
random.setstate(initial_random_state)


def new_random_seed():
    """生成新的随机种子"""
    global mk_seed_random_state
    prev_random_state = random.getstate()
    random.setstate(mk_seed_random_state)
    seed = random.randint(1, 1125899906842624)
    mk_seed_random_state = random.getstate()
    random.setstate(prev_random_state)
    return seed


class MK_Seed:
    """
    随机种子节点
    管理和生成随机种子
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "种子": ("INT", {
                    "default": 0,
                    "min": -1125899906842624,
                    "max": 1125899906842624
                }),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("种子",)
    FUNCTION = "main"
    CATEGORY = "MK_Tools/工具"

    @classmethod
    def IS_CHANGED(cls, 种子, prompt=None, extra_pnginfo=None, unique_id=None):
        """强制改变状态如果收到特殊种子值"""
        if 种子 in (-1, -2, -3):
            # 返回新的随机种子强制刷新
            return new_random_seed()
        return 种子

    def main(self, 种子=0, prompt=None, extra_pnginfo=None, unique_id=None):
        """返回传入的种子，或在特殊情况下生成随机种子"""

        # 特殊值处理：
        # -1: 生成随机种子
        # -2: 增量种子（服务端不支持，生成随机）
        # -3: 减量种子（服务端不支持，生成随机）
        if 种子 in (-1, -2, -3):
            original_seed = 种子
            种子 = new_random_seed()
            print(f"[MK-随机种子] 服务端生成随机种子: {种子}")

            # 尝试保存到工作流元数据
            if unique_id is not None and extra_pnginfo is not None:
                try:
                    workflow = extra_pnginfo.get('workflow', {})
                    if 'nodes' in workflow:
                        for node in workflow['nodes']:
                            if str(node.get('id')) == str(unique_id):
                                if 'widgets_values' in node:
                                    for index, widget_value in enumerate(node['widgets_values']):
                                        if widget_value == original_seed:
                                            node['widgets_values'][index] = 种子
                                            break
                                break
                except Exception as e:
                    print(f"[MK-随机种子] 无法保存种子到工作流元数据: {e}")

            # 尝试保存到 prompt 元数据
            if unique_id is not None and prompt is not None:
                try:
                    prompt_node = prompt.get(str(unique_id))
                    if prompt_node is not None and 'inputs' in prompt_node:
                        prompt_node['inputs']['种子'] = 种子
                except Exception as e:
                    print(f"[MK-随机种子] 无法保存种子到 prompt 元数据: {e}")

        return (种子,)


# Node class mappings
NODE_CLASS_MAPPINGS = {
    "MK_Seed": MK_Seed
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_Seed": "MK-随机种子"
}
