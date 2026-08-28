// MK_Tools - Prompt Concat Node Frontend
// 动态输入端管理

import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "MK_Tools.PromptConcat",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "MK_PromptConcat") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;

            nodeType.prototype.onNodeCreated = function() {
                const result = onNodeCreated?.apply(this, arguments);

                // 初始添加第二个输入（第一个已经在 INPUT_TYPES 中定义）
                this.addPromptInput(1);

                return result;
            };

            // 添加提示词输入
            nodeType.prototype.addPromptInput = function(num = 1) {
                const currentCount = this.inputs.filter(i => i.name.startsWith("提示词_")).length;

                for (let i = 0; i < num; i++) {
                    const nextIndex = currentCount + i + 1;
                    if (nextIndex > 10) break; // 最多10个

                    const inputName = `提示词_${String(nextIndex).padStart(2, "0")}`;
                    this.addInput(inputName, "STRING");
                }
            };

            // 监听连接变化
            const onConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function(type, slotIndex, isConnected, linkInfo, ioSlot) {
                const result = onConnectionsChange?.apply(this, arguments);

                this.scheduleStabilize();

                return result;
            };

            // 调度稳定
            nodeType.prototype.scheduleStabilize = function(ms = 64) {
                if (this.stabilizeTimeout) {
                    clearTimeout(this.stabilizeTimeout);
                }

                this.stabilizeTimeout = setTimeout(() => {
                    this.stabilize();
                }, ms);
            };

            // 稳定输入端
            nodeType.prototype.stabilize = function() {
                const promptInputs = this.inputs.filter(i => i.name.startsWith("提示词_"));

                // 从后往前检查，移除末尾未连接的输入（至少保留2个）
                while (promptInputs.length > 2) {
                    const lastInput = promptInputs[promptInputs.length - 1];
                    if (!lastInput.link) {
                        const inputIndex = this.inputs.indexOf(lastInput);
                        this.removeInput(inputIndex);
                        promptInputs.pop();
                    } else {
                        break;
                    }
                }

                // 确保至少有一个空的输入端（如果未达到最大值）
                const lastInput = promptInputs[promptInputs.length - 1];
                if (lastInput && lastInput.link && promptInputs.length < 10) {
                    this.addPromptInput(1);
                }
            };
        }
    },
});
