"""
随机种子节点 - Seed
从 rgthree-comfy 提取
原始代码: https://github.com/rgthree/rgthree-comfy
"""

import random
from datetime import datetime


def get_dict_value(data: dict, dict_key: str, default=None):
    """获取深层嵌套的值，使用点分隔的键"""
    keys = dict_key.split('.')
    key = keys.pop(0) if len(keys) > 0 else None
    found = data[key] if key in data else None
    if found is not None and len(keys) > 0:
        return get_dict_value(found, '.'.join(keys), default)
    return found if found is not None else default


def get_workflow_node(extra_pnginfo, node_id: str, default=None):
    """从工作流元数据中获取节点"""
    node_ids = str(node_id).split(':')
    workflow_nodes = get_dict_value(extra_pnginfo, 'workflow.nodes', default=[])
    workflow_subgraphs = get_dict_value(extra_pnginfo, 'workflow.definitions.subgraphs', default=[])
    nodes_list = workflow_nodes
    found = None
    for individual_node_id in node_ids:
        found = next((n for n in nodes_list if str(n['id']) == individual_node_id), None)
        if isinstance(found, dict) and 'type' in found:
            subgraph = next((n for n in workflow_subgraphs if str(n['id']) == found['type']), None)
            if isinstance(subgraph, dict) and 'nodes' in subgraph:
                nodes_list = subgraph['nodes']
    return found if found is not None else default


# 初始化随机状态
# 某些扩展可能设置了种子，导致服务器生成的种子不随机
# 我们设置新种子并使用该状态
initial_random_state = random.getstate()
random.seed(datetime.now().timestamp())
mk_seed_random_state = random.getstate()
random.setstate(initial_random_state)


def new_random_seed():
    """从 mk_seed_random_state 获取新的随机种子并重置之前的状态"""
    global mk_seed_random_state
    prev_random_state = random.getstate()
    random.setstate(mk_seed_random_state)
    seed = random.randint(1, 1125899906842624)
    mk_seed_random_state = random.getstate()
    random.setstate(prev_random_state)
    return seed


class MK_Seed:
    """
    随机种子节点 (MK-随机种子)
    管理和生成随机种子

    原始节点: Seed (rgthree)
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
        """如果收到特殊种子则强制改变状态"""
        if 种子 in (-1, -2, -3):
            # 这不会被使用，但与之前不同的值会强制"改变"
            return new_random_seed()
        return 种子

    def main(self, 种子=0, prompt=None, extra_pnginfo=None, unique_id=None):
        """在执行时返回传入的种子"""

        # 我们在前端的种子节点中生成随机种子，然后发送工作流
        # 但如果在 API 调用中使用而不改变种子，用户可以传入"-1"来获取随机种子
        if 种子 in (-1, -2, -3):
            print(
                f'[MK-随机种子] 警告: 收到 "{种子}" 作为传入种子。' +
                '从 ComfyUI 前端排队时不应发生这种情况。'
            )
            if 种子 in (-2, -3):
                print(
                    f'[MK-随机种子] 警告: 无法从服务器{"递增" if 种子 == -2 else "递减"}种子，' +
                    '但会生成新的随机种子。'
                )

            original_seed = 种子
            种子 = new_random_seed()
            print(f'[MK-随机种子] 服务器生成的随机种子 {种子} 并保存到工作流。')
            print(
                f'[MK-随机种子] 注意: 传入 "{种子}" 和服务器生成的随机种子的重新排队将不会被缓存。'
            )

            if unique_id is None:
                print(
                    '[MK-随机种子] 无法将服务器生成的种子保存到图像元数据，' +
                    '因为未提供节点 id。'
                )
            else:
                if extra_pnginfo is None:
                    print(
                        '[MK-随机种子] 无法将服务器生成的种子保存到图像工作流元数据，' +
                        '因为未提供工作流。'
                    )
                else:
                    print(f'[MK-随机种子] 查找 id 为 "{unique_id}" 的种子节点')
                    workflow_node = get_workflow_node(extra_pnginfo, str(unique_id))
                    if workflow_node is None or 'widgets_values' not in workflow_node:
                        print(
                            '[MK-随机种子] 无法将服务器生成的种子保存到图像工作流元数据，' +
                            '因为在提供的工作流中找不到节点。'
                        )
                    else:
                        for index, widget_value in enumerate(workflow_node['widgets_values']):
                            if widget_value == original_seed:
                                workflow_node['widgets_values'][index] = 种子

                if prompt is None:
                    print(
                        '[MK-随机种子] 无法将服务器生成的种子保存到图像 API prompt 元数据，' +
                        '因为未提供 prompt。'
                    )
                else:
                    prompt_node = prompt[str(unique_id)]
                    if prompt_node is None or 'inputs' not in prompt_node or '种子' not in prompt_node['inputs']:
                        print(
                            '[MK-随机种子] 无法将服务器生成的种子保存到图像工作流元数据，' +
                            '因为在提供的工作流中找不到节点。'
                        )
                    else:
                        prompt_node['inputs']['种子'] = 种子

        return (种子,)


# Node class mappings
NODE_CLASS_MAPPINGS = {
    "MK_Seed": MK_Seed
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_Seed": "MK-随机种子"
}
