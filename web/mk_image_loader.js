import { app } from "../../scripts/app.js";

// ═══════════════════════════════════════════════════════════════════════
// MK-加载图像 - 支持遮罩编辑功能
// ═══════════════════════════════════════════════════════════════════════

app.registerExtension({
    name: "MK.ImageLoader",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "MK_ImageLoader") {
            console.log("[MK-加载图像] 注册节点扩展");

            // 添加节点创建后的处理
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const result = onNodeCreated?.apply(this, arguments);

                // 查找图像输入 widget（支持中文名称）
                const imageWidget = this.widgets?.find(w =>
                    w.type === "combo" &&
                    w.options?.image_upload === true
                );

                if (imageWidget) {
                    console.log("[MK-加载图像] 找到图像上传 widget:", imageWidget.name);

                    // 存储原始 widget 引用，供 ComfyUI 内部机制使用
                    if (!this.imageWidget) {
                        this.imageWidget = imageWidget;
                    }

                    // 标记此节点支持图像操作（clipspace 需要）
                    this.imgs = null;

                    // 监听 widget 值变化
                    const originalCallback = imageWidget.callback;
                    imageWidget.callback = function(value) {
                        console.log("[MK-加载图像] Widget 值更新为:", value);

                        // 触发原始回调
                        if (originalCallback) {
                            return originalCallback.apply(this, arguments);
                        }
                    };

                    // 重写 widget 的 serializeValue 方法，确保能够正确序列化
                    const originalSerializeValue = imageWidget.serializeValue;
                    imageWidget.serializeValue = async function(node, index) {
                        console.log("[MK-加载图像] 序列化 widget 值:", this.value);

                        if (originalSerializeValue) {
                            return await originalSerializeValue.call(this, node, index);
                        }

                        return this.value;
                    };
                }

                return result;
            };
        }
    }
});
