// MK_Tools - Any Switch Node Frontend
// 从 rgthree-comfy 提取并适配

import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "MK_Tools.AnySwitch",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "MK_AnySwitch") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;

            nodeType.prototype.onNodeCreated = function() {
                const result = onNodeCreated?.apply(this, arguments);

                this.nodeType = null;

                // 初始添加 2 个输入
                this.addAnyInput(2);

                return result;
            };

            // 添加任意输入
            nodeType.prototype.addAnyInput = function(num = 1) {
                for (let i = 0; i < num; i++) {
                    const inputName = `any_${String(this.inputs.length + 1).padStart(2, "0")}`;
                    this.addInput(inputName, this.nodeType || "*");
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

            // 稳定输入/输出
            nodeType.prototype.stabilize = function() {
                // 移除末尾未使用的输入（保留至少 2 个）
                while (this.inputs.length > 2) {
                    const lastInput = this.inputs[this.inputs.length - 1];
                    if (!lastInput.link) {
                        this.removeInput(this.inputs.length - 1);
                    } else {
                        break;
                    }
                }

                // 只有当最后一个输入被连接时，才添加新的空输入
                const lastInput = this.inputs[this.inputs.length - 1];
                if (lastInput && lastInput.link) {
                    this.addAnyInput(1);
                }

                // 检测连接的类型
                let connectedType = this.detectConnectedType();

                this.nodeType = connectedType || "*";

                // 更新所有输入和输出的类型
                for (const input of this.inputs) {
                    input.type = this.nodeType;
                }

                for (const output of this.outputs) {
                    output.type = this.nodeType;
                    output.label = String(this.nodeType);
                }
            };

            // 检测连接的类型
            nodeType.prototype.detectConnectedType = function() {
                // 检查输入连接
                for (const input of this.inputs) {
                    if (input.link) {
                        const link = app.graph.links[input.link];
                        if (link) {
                            const originNode = app.graph.getNodeById(link.origin_id);
                            if (originNode && originNode.outputs[link.origin_slot]) {
                                return originNode.outputs[link.origin_slot].type;
                            }
                        }
                    }
                }

                // 检查输出连接
                for (const output of this.outputs) {
                    if (output.links && output.links.length > 0) {
                        for (const linkId of output.links) {
                            const link = app.graph.links[linkId];
                            if (link) {
                                const targetNode = app.graph.getNodeById(link.target_id);
                                if (targetNode && targetNode.inputs[link.target_slot]) {
                                    return targetNode.inputs[link.target_slot].type;
                                }
                            }
                        }
                    }
                }

                return null;
            };
        }
    },
});
