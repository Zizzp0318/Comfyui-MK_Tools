// MK_Tools - Seed Node Frontend
// 从 rgthree-comfy 提取并适配

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const LAST_SEED_BUTTON_LABEL = "♻️ (使用上次排队的种子)";
const SPECIAL_SEED_RANDOM = -1;
const SPECIAL_SEED_INCREMENT = -2;
const SPECIAL_SEED_DECREMENT = -3;
const SPECIAL_SEEDS = [SPECIAL_SEED_RANDOM, SPECIAL_SEED_INCREMENT, SPECIAL_SEED_DECREMENT];

app.registerExtension({
    name: "MK_Tools.Seed",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "MK_Seed") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;

            nodeType.prototype.onNodeCreated = function() {
                const result = onNodeCreated?.apply(this, arguments);

                this.serialize_widgets = true;
                this.lastSeed = undefined;
                this.properties = this.properties || {};
                this.properties["randomMax"] = 1125899906842624;
                this.properties["randomMin"] = 0;

                // 找到种子 widget
                for (const [i, w] of this.widgets.entries()) {
                    if (w.name === "种子") {
                        this.seedWidget = w;
                        this.seedWidget.value = SPECIAL_SEED_RANDOM;
                    }
                }

                if (!this.seedWidget) {
                    console.error("[MK-随机种子] 未找到种子 widget");
                    return result;
                }

                // 添加按钮
                this.addWidget("button", "🎲 每次随机", "", () => {
                    this.seedWidget.value = SPECIAL_SEED_RANDOM;
                }, { serialize: false });

                this.addWidget("button", "🎲 新固定随机", "", () => {
                    this.seedWidget.value = this.generateRandomSeed();
                }, { serialize: false });

                this.lastSeedButton = this.addWidget("button", "USE_LAST_SEED", "", () => {
                    this.seedWidget.value = this.lastSeed != null ? this.lastSeed : this.seedWidget.value;
                    this.lastSeedButton.label = LAST_SEED_BUTTON_LABEL;
                    this.lastSeedButton.disabled = true;
                }, { serialize: false });

                this.lastSeedButton.label = LAST_SEED_BUTTON_LABEL;
                this.lastSeedButton.disabled = true;

                return result;
            };

            // 生成随机种子
            nodeType.prototype.generateRandomSeed = function() {
                const step = this.seedWidget?.options?.step || 1;
                const randomMin = Number(this.properties["randomMin"] || 0);
                const randomMax = Number(this.properties["randomMax"] || 1125899906842624);
                const randomRange = (randomMax - randomMin) / (step / 10);
                let seed = Math.floor(Math.random() * randomRange) * (step / 10) + randomMin;

                if (SPECIAL_SEEDS.includes(seed)) {
                    seed = 0;
                }
                return seed;
            };

            // 获取要使用的种子
            nodeType.prototype.getSeedToUse = function() {
                const inputSeed = Number(this.seedWidget.value);
                let seedToUse = null;

                if (SPECIAL_SEEDS.includes(inputSeed)) {
                    if (typeof this.lastSeed === "number" && !SPECIAL_SEEDS.includes(this.lastSeed)) {
                        if (inputSeed === SPECIAL_SEED_INCREMENT) {
                            seedToUse = this.lastSeed + 1;
                        } else if (inputSeed === SPECIAL_SEED_DECREMENT) {
                            seedToUse = this.lastSeed - 1;
                        }
                    }

                    if (seedToUse == null || SPECIAL_SEEDS.includes(seedToUse)) {
                        seedToUse = this.generateRandomSeed();
                    }
                }

                return seedToUse !== null && seedToUse !== undefined ? seedToUse : inputSeed;
            };

            // 处理 API 劫持
            nodeType.prototype.handleApiHijacking = function(prompt) {
                if (!this.seedWidget || !prompt || !prompt.workflow || !prompt.output) {
                    return;
                }

                const seedToUse = this.getSeedToUse();

                // 保存上次使用的种子
                this.lastSeed = seedToUse;

                // 更新工作流中的种子值
                const workflow = prompt.workflow;
                if (workflow.nodes) {
                    for (const node of workflow.nodes) {
                        if (node.id === this.id) {
                            const seedWidgetIndex = this.widgets.indexOf(this.seedWidget);
                            if (node.widgets_values && seedWidgetIndex >= 0) {
                                node.widgets_values[seedWidgetIndex] = seedToUse;
                            }
                            break;
                        }
                    }
                }

                // 更新 output 中的种子值
                const output = prompt.output;
                if (output[this.id] && output[this.id].inputs) {
                    output[this.id].inputs['种子'] = seedToUse;
                }

                // 更新按钮状态
                if (seedToUse != this.seedWidget.value) {
                    this.lastSeedButton.label = `♻️ ${this.lastSeed}`;
                    this.lastSeedButton.disabled = false;
                } else {
                    this.lastSeedButton.label = LAST_SEED_BUTTON_LABEL;
                    this.lastSeedButton.disabled = true;
                }

                console.log(`[MK-随机种子] 使用种子: ${seedToUse} (原始值: ${this.seedWidget.value})`);
            };
        }
    },

    async setup() {
        // 劫持 api.queuePrompt，在发送前修改种子值
        const originalQueuePrompt = api.queuePrompt;

        api.queuePrompt = async function(number, prompt, ...args) {
            // 在发送前处理所有 MK_Seed 节点
            if (prompt && prompt.output) {
                for (const node of app.graph._nodes) {
                    if (node.type === "MK_Seed" && node.handleApiHijacking) {
                        node.handleApiHijacking(prompt);
                    }
                }
            }

            // 调用原始方法
            return originalQueuePrompt.call(this, number, prompt, ...args);
        };

        console.log("[MK-随机种子] 已安装 API 劫持");
    }
});
