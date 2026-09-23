"""
MK-禁音（忽略）节点
纯控制节点：不参与执行，只在打开工作流时由前端根据参数
对指定「组」或指定「节点」设置 静音(MUTE) / 忽略(BYPASS) 状态

节点本身没有输入输出，因此不会打断任何连线，
也不会被 comfy 的执行引擎当成需要计算的节点。
"""


class MK_MuteBypass:
    """
    MK-禁音（忽略）

    通过「组名」或「节点名」定位目标，批量设置模式。
    实际生效逻辑全部在前端 web/mk_mute_bypass.js 中实现。
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                # 1. 模式开关：静音 或 忽略
                "模式": (["静音", "忽略"], {
                    "default": "静音",
                    "tooltip": "静音(Mute)：节点不执行且切断下游\n忽略(Bypass)：节点不执行但输入直通输出",
                }),
                # 2. 启用开关（默认关，避免打开工作流就动别人的节点）
                "启用": ("BOOLEAN", {
                    "default": False,
                    "label_on": "开",
                    "label_off": "关",
                    "tooltip": "打开后才会对目标生效；关闭时会把目标恢复成改动之前的状态",
                }),
                # 3. 组名
                "组名": ("STRING", {
                    "default": "",
                    "multiline": False,
                    "placeholder": "输入组的名字，留空则不动组",
                }),
                # 4. 节点名
                "节点名": ("STRING", {
                    "default": "",
                    "multiline": False,
                    "placeholder": "输入节点的标题，留空则不动单个节点",
                }),
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "apply"
    CATEGORY = "MK_Tools/工具"
    DESCRIPTION = ("按名称对组或节点批量设置「静音」或「忽略」。"
                   "支持多个名称，用英文逗号或换行分隔。"
                   "关掉「启用」会恢复改动前的原始状态。")

    def apply(self, **kwargs):
        """
        空操作。

        真正的模式切换发生在前端 —— 这样能立刻在画布上看到效果，
        而且不需要跑一次工作流。这里返回空元组即可。
        """
        return ()


NODE_CLASS_MAPPINGS = {
    "MK_MuteBypass": MK_MuteBypass,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MK_MuteBypass": "MK-禁音（忽略）",
}
