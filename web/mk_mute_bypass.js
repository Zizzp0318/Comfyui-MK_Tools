// ═══════════════════════════════════════════════════════════════════════
// MK-禁音（忽略） - 前端控制逻辑
//
// 节点本身不参与执行，只作为一个「开关面板」：
// 根据 组名 / 节点名 找到目标节点，批量设置 静音(NEVER) 或 忽略(BYPASS)
//
// 节点模式常量（litegraph）：
//   0 = ALWAYS  正常
//   2 = NEVER   静音（断开下游）
//   4 = BYPASS  忽略（输入直通输出）
//
// 关键设计说明：
//   组本身在 litegraph 里【没有】mode 属性，只有节点才有 mode。
//   ComfyUI 官方右键菜单对组设置模式，做法就是遍历组成员逐个改 node.mode。
//   所以这里也把「组」只当成一种【选取目标的方式】，而不是一个可记录状态的对象。
//
//   原始状态一律按【节点 id】逐个记录，不按组记录。
//   否则同一个节点「既在组里、又被节点名点名」时会有两条记录互相覆盖，
//   恢复顺序上后跑的那条会盖掉前一条，导致只恢复一半。
// ═══════════════════════════════════════════════════════════════════════

import { app } from "../../scripts/app.js";

// 节点模式值（LGraphEventMode，来自 litegraph 的 globalEnums.ts）：
//   ALWAYS=0  ON_EVENT=1  NEVER=2  ON_TRIGGER=3  BYPASS=4
//
// 这里直接写死数值：旧的 LiteGraph 全局对象上没有 BYPASS 这个属性，
// 只认识 ALWAYS/NEVER，用 LiteGraph.BYPASS 会导致取到 undefined。
const MODE = {
    ALWAYS: 0,
    NEVER: 2,
    BYPASS: 4,
};

// 中文模式名 → 模式值
const MODE_MAP = {
    "静音": MODE.NEVER,
    "忽略": MODE.BYPASS,
};

// 拆分名称输入框：支持英文逗号、中文逗号、换行、分号
function splitNames(text) {
    if (!text) return [];
    return String(text)
        .split(/[,，;；\n\r]+/)
        .map(s => s.trim())
        .filter(Boolean);
}

// 取节点用于匹配的名字集合（标题 + 类型 + comfyClass）
function nodeNames(node) {
    const names = [];
    if (node.title) names.push(node.title);
    if (node.type) names.push(node.type);
    if (node.comfyClass) names.push(node.comfyClass);
    // 节点标题可能带着执行计数前缀，例如 "KSampler (3)"
    if (node.title) names.push(node.title.replace(/\s*\(\d+\)\s*$/, ""));
    return names.map(s => String(s).toLowerCase());
}

// 找到画布上所有的组
function getGroups(graph) {
    return graph?._groups || graph?.groups || [];
}

// 取组内的节点列表
// （litegraph 里 group.nodes 是维护好的成员列表；
//   children 是参与包围盒计算的子项，作为兜底）
function getGroupNodes(group) {
    if (!group) return [];
    return group.nodes || group._nodes || group.children || [];
}

// 把组的成员节点收集进 out（去重交给调用方）
function collectGroupNodes(group) {
    try {
        group?.recomputeInsideNodes?.();
    } catch (e) {
        /* 旧版本没有该方法，忽略 */
    }
    return getGroupNodes(group).filter(Boolean);
}

// 原始状态记录的格式版本。
// v1 是按「组」记录的（一组一个 mode），并且存在「先改后记」的问题，
// 会在「节点既在组里又被点名」时记错原始值。v2 改成按节点 id 逐个记录，
// 并且在任何改动之前采集。
// 载入到 v1 存档时把记录丢掉重新采集，否则那些工作流会一直恢复错。
const ORIGINALS_VERSION = 2;

// 清理 v1 遗留的记录
function migrateOriginals(originals) {
    if (!originals) return null;
    if (originals.v === ORIGINALS_VERSION) return originals;
    // v1 没有 v 字段（或版本更旧）→ 里面的值不可信，丢弃
    return null;
}

app.registerExtension({
    name: "MK.MuteBypass",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "MK_MuteBypass") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        const onConfigure = nodeType.prototype.onConfigure;

        // ───────────────────────────────────────────────────────────
        // 节点创建
        // ───────────────────────────────────────────────────────────
        nodeType.prototype.onNodeCreated = function () {
            const result = onNodeCreated?.apply(this, arguments);

            // 记录原始状态用的容器（放进 properties，随工作流一起保存）
            if (!this.properties) this.properties = {};
            if (!this.properties.mk_originals) {
                this.properties.mk_originals = null;
            }

            // 节点高度：标题栏 + 4 个 widget，本来就不高。
            // 之前写 170 会留一大块空白，还要手动往下拉，这里收到贴合内容的高度。
            this.setSize?.([300, 126]);

            // widget 引用延迟查找（onNodeCreated 阶段不保证已就绪）
            // 用箭头函数，让 this 始终指向本节点
            this.mkFindWidgets = () => {
                const self = this; // 供下面 widget 的普通函数回调捕获

                const w = {
                    mode: this.widgets?.find(x => x.name === "模式"),
                    enable: this.widgets?.find(x => x.name === "启用"),
                    group: this.widgets?.find(x => x.name === "组名"),
                    node: this.widgets?.find(x => x.name === "节点名"),
                };

                // 第一次找到时挂回调，之后不再重复挂
                for (const key of Object.keys(w)) {
                    const widget = w[key];
                    if (!widget || widget.mkHooked) continue;

                    widget.mkHooked = true;
                    const orig = widget.callback;
                    widget.callback = function (...args) {
                        const r = orig?.apply(this, args);
                        self.mkScheduleApply();
                        return r;
                    };
                }

                return w;
            };

            // 首次创建时延后应用（等画布上的其它节点就绪）
            this.mkScheduleApply();

            return result;
        };

        // ───────────────────────────────────────────────────────────
        // 工作流加载完成
        // ───────────────────────────────────────────────────────────
        nodeType.prototype.onConfigure = function () {
            const result = onConfigure?.apply(this, arguments);

            if (!this.properties) this.properties = {};
            // 丢掉 v1（按组记录）的旧存档，避免用错的原始值去恢复
            this.properties.mk_originals = migrateOriginals(
                this.properties.mk_originals
            );

            // 目标节点可能在当前节点之后才加载，做几次重试
            this.mkScheduleApply(0, 6);

            return result;
        };

        // ───────────────────────────────────────────────────────────
        // 延迟应用（带重试，处理加载顺序问题）
        // ───────────────────────────────────────────────────────────
        nodeType.prototype.mkScheduleApply = function (delay = 120, retries = 0) {
            if (this.mkTimer) clearTimeout(this.mkTimer);

            this.mkTimer = setTimeout(() => {
                this.mkTimer = null;
                const found = this.mkApply();

                // 一个目标都没匹配到，且还有重试次数 → 稍后再试
                if (!found && retries > 0) {
                    this.mkScheduleApply(200, retries - 1);
                }
            }, delay);
        };

        // ───────────────────────────────────────────────────────────
        // 找出本次要操作的目标节点
        //
        // 返回 { targets: LGraphNode[], found: boolean }
        // 命中「组名」但组内为空时 found 仍为 true ——
        // 组确实存在，只是没成员，不需要重试。
        // ───────────────────────────────────────────────────────────
        nodeType.prototype.mkCollectTargets = function (groupNames, nodeKeys) {
            const graph = app.graph;
            const nodes = graph?._nodes || [];
            const targets = [];
            const hitIds = new Set();
            let found = false;

            const add = (n) => {
                if (!n || n === this) return;
                if (hitIds.has(n.id)) return; // 已在别处收集过，避免重复
                hitIds.add(n.id);
                targets.push(n);
            };

            // 1) 组 → 展开成成员节点
            for (const g of getGroups(graph)) {
                const title = String(g.title ?? "").toLowerCase();
                if (!title || !groupNames.includes(title)) continue;

                found = true;
                for (const n of collectGroupNodes(g)) add(n);
            }

            // 2) 单个节点：纯数字按 id 匹配，否则按名字匹配
            for (const n of nodes) {
                if (!n || n === this || hitIds.has(n.id)) continue;

                let matched = false;
                for (const key of nodeKeys) {
                    if (/^\d+$/.test(key) && String(n.id) === key) {
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    const names = nodeNames(n);
                    matched = nodeKeys.some(k => names.includes(k));
                }
                if (!matched) continue;

                found = true;
                add(n);
            }

            return { targets, hitIds, found };
        };

        // ───────────────────────────────────────────────────────────
        // 核心：应用 / 恢复
        // 返回是否匹配到了至少一个目标（用于决定要不要重试）
        // ───────────────────────────────────────────────────────────
        nodeType.prototype.mkApply = function () {
            const graph = app.graph;
            if (!graph) return false;

            const w = this.mkFindWidgets ? this.mkFindWidgets() : {};
            const enabled = w.enable ? !!w.enable.value : true;
            const modeName = w.mode ? w.mode.value : "静音";
            const groupText = w.group ? w.group.value : "";
            const nodeText = w.node ? w.node.value : "";

            // 关闭启用 → 恢复原始状态
            if (!enabled) {
                return this.mkRestore();
            }

            const mode = MODE_MAP[modeName] ?? MODE.NEVER;
            const groupNames = splitNames(groupText).map(s => s.toLowerCase());
            const nodeKeys = splitNames(nodeText).map(s => s.toLowerCase());

            if (!groupNames.length && !nodeKeys.length) {
                // 没有任何目标 → 顺带把之前记录的原始状态还原掉
                this.mkRestore();
                return false;
            }

            // ── 1) 先收集目标，此时尚未做任何改动 ──
            const { targets, hitIds, found } = this.mkCollectTargets(
                groupNames,
                nodeKeys
            );

            if (!this.properties.mk_originals) {
                this.properties.mk_originals = {
                    v: ORIGINALS_VERSION,
                    nodes: [],
                };
            }
            const originals = this.properties.mk_originals;
            if (!Array.isArray(originals.nodes)) originals.nodes = [];

            // ── 2) 记录原始状态（必须在任何 mode 改动【之前】）──
            // 只在还没记录过的时候记一次，
            // 这样反复开关 / 重新应用不会把「被自己改过的值」当成原始值。
            for (const n of targets) {
                if (!originals.nodes.some(o => o.id === n.id)) {
                    originals.nodes.push({ id: n.id, mode: n.mode });
                }
            }

            // ── 3) 统一应用 ──
            for (const n of targets) {
                n.mode = mode;
            }

            // ── 4) 清理：改过名字后，不再命中的旧目标要还原 ──
            // 否则用户把「组名」从 A 改成 B 时，A 会一直停在被静音的状态
            const allNodes = graph._nodes || [];
            originals.nodes = originals.nodes.filter(rec => {
                if (hitIds.has(rec.id)) return true;

                const n = allNodes.find(x => x.id === rec.id);
                if (n) n.mode = rec.mode ?? MODE.ALWAYS;
                return false;
            });

            app.graph.setDirtyCanvas?.(true, true);
            return found;
        };

        // ───────────────────────────────────────────────────────────
        // 恢复原始状态
        // ───────────────────────────────────────────────────────────
        nodeType.prototype.mkRestore = function () {
            const graph = app.graph;
            const originals = this.properties?.mk_originals;
            if (!graph || !originals) return false;

            const nodes = graph._nodes || [];
            let restored = false;

            // 按节点 id 逐个恢复（v1 的按组存档已在载入时丢弃）
            for (const rec of originals.nodes || []) {
                const n = nodes.find(x => x.id === rec.id);
                if (!n) continue;
                n.mode = rec.mode ?? MODE.ALWAYS;
                restored = true;
            }

            // 记录用掉即清空，下次重新应用时再记录当前状态
            this.properties.mk_originals = null;

            app.graph.setDirtyCanvas?.(true, true);
            return restored;
        };
    },
});
