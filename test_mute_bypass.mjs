// MK-禁音（忽略）回归测试
// 直接加载 web/mk_mute_bypass.js 的真实源码，用 mock 的 litegraph 图驱动，
// 验证「应用 → 恢复」后所有节点的 mode 都回到初始值。
//
// 运行: node test_mute_bypass.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "web", "mk_mute_bypass.js");

// ── 加载真实源码（剥掉 import，注入 mock 的 app）──
let src = fs.readFileSync(SRC, "utf8");
src = src.replace(/^\s*import\s+\{[^}]*\}\s+from\s+["'][^"']+["'];?\s*$/m, "");

let captured = null;
const mockApp = { registerExtension: (o) => { captured = o; } };
new Function("app", src + "\nreturn app;")(mockApp);

const ALWAYS = 0, NEVER = 2, BYPASS = 4;
const NAME = { 0: "ALWAYS", 1: "ON_EVENT", 2: "NEVER", 3: "ON_TRIGGER", 4: "BYPASS" };

// ── 构造 nodeType.prototype ──
function makeProto() {
    const nodeType = function () {};
    nodeType.prototype = {};
    captured.beforeRegisterNodeDef(nodeType, { name: "MK_MuteBypass" });
    return nodeType.prototype;
}

// ── mock 节点工厂 ──
const mkWidget = (name, value) => ({ name, value, callback: null });
const mkNode = (id, title, mode = ALWAYS) => ({ id, title, type: title, mode });

function mkGroup(title, members) {
    return {
        title,
        nodes: [...members],
        children: [...members],
        recomputeInsideNodes() {},
    };
}

// ── 建立 MK 控制节点 ──
function makeMkNode(proto, values) {
    const n = Object.create(proto);
    n.id = 999;
    n.title = "MK-禁音（忽略）";
    n.properties = {};
    n.widgets = [
        mkWidget("模式", values.mode ?? "忽略"),
        mkWidget("启用", values.enable ?? true),
        mkWidget("组名", values.group ?? ""),
        mkWidget("节点名", values.node ?? ""),
    ];
    n.setSize = () => {};
    n.onNodeCreated();
    return n;
}

let failures = 0;
let total = 0;

// ── 场景运行器 ──
// steps: [{ set:{启用:false}, expect: {id:mode} }]
function runCase(name, { nodes, groups, targets, steps }) {
    total++;
    const proto = makeProto();
    mockApp.graph = {
        _nodes: nodes,
        _groups: groups,
        setDirtyCanvas() {},
    };

    const mk = makeMkNode(proto, targets);
    const fmt = () => nodes.map((n) => `${n.title}=${NAME[n.mode]}`).join("  ");
    console.log(`\n=== ${name} ===`);
    console.log(`  初始   : ${fmt()}`);

    let ok = true;
    for (const step of steps) {
        for (const [k, v] of Object.entries(step.set || {})) {
            const w = mk.widgets.find((x) => x.name === k);
            if (!w) throw new Error(`没有 widget: ${k}`);
            w.value = v;
        }
        mk.mkApply();
        console.log(`  操作后 : ${fmt()}`);

        for (const [id, want] of Object.entries(step.expect || {})) {
            const n = nodes.find((x) => String(x.id) === String(id));
            const got = n ? n.mode : undefined;
            if (got !== want) {
                console.log(
                    `  ❌ 节点 ${id}(${n ? n.title : "?"}) 期望 ${NAME[want]} 实际 ${NAME[got]}`
                );
                ok = false;
            }
        }
    }
    console.log(`  ${ok ? "✅ 通过" : "❌ 失败"}`);
    if (!ok) failures++;
    return ok;
}

const results = [];

// A. 组内含被点名节点（复现用户报的 bug：组=加载图像1，节点=加载图像）
{
    const a = mkNode(1, "加载图像");
    const g = mkGroup("加载图像1", [a]);
    results.push(
        runCase("A. 节点既在组里、又被节点名点名（用户复现的场景）", {
            nodes: [a],
            groups: [g],
            targets: { mode: "忽略", group: "加载图像1", node: "加载图像" },
            steps: [
                { expect: { 1: BYPASS } },                          // 启用 ON
                { set: { 启用: false }, expect: { 1: ALWAYS } },     // 启用 OFF → 必须还原
            ],
        })
    );
}

// B. 组内是别的节点，被点名节点独立
{
    const a = mkNode(1, "加载图像");
    const b = mkNode(2, "KSampler");
    const g = mkGroup("加载图像1", [b]);
    results.push(
        runCase("B. 组内含其它节点，被点名节点独立", {
            nodes: [a, b],
            groups: [g],
            targets: { mode: "忽略", group: "加载图像1", node: "加载图像" },
            steps: [
                { expect: { 1: BYPASS, 2: BYPASS } },
                { set: { 启用: false }, expect: { 1: ALWAYS, 2: ALWAYS } },
            ],
        })
    );
}

// C. 只填组名（多成员）
{
    const b = mkNode(2, "KSampler");
    const c = mkNode(3, "VAEDecode");
    const g = mkGroup("加载图像1", [b, c]);
    results.push(
        runCase("C. 只填组名，组内多成员", {
            nodes: [b, c],
            groups: [g],
            targets: { mode: "忽略", group: "加载图像1", node: "" },
            steps: [
                { expect: { 2: BYPASS, 3: BYPASS } },
                { set: { 启用: false }, expect: { 2: ALWAYS, 3: ALWAYS } },
            ],
        })
    );
}

// D. 只填节点名
{
    const a = mkNode(1, "加载图像");
    results.push(
        runCase("D. 只填节点名", {
            nodes: [a],
            groups: [],
            targets: { mode: "忽略", group: "", node: "加载图像" },
            steps: [
                { expect: { 1: BYPASS } },
                { set: { 启用: false }, expect: { 1: ALWAYS } },
            ],
        })
    );
}

// E. 原始状态不是 ALWAYS（组内成员本来是静音），恢复必须精确回到静音
{
    const a = mkNode(1, "加载图像", NEVER);
    const g = mkGroup("加载图像1", [a]);
    results.push(
        runCase("E. 组成员本来就是静音，恢复要回到静音而不是正常", {
            nodes: [a],
            groups: [g],
            targets: { mode: "忽略", group: "加载图像1", node: "加载图像" },
            steps: [
                { expect: { 1: BYPASS } },
                { set: { 启用: false }, expect: { 1: NEVER } },
            ],
        })
    );
}

// F. 组内成员模式不一致，恢复不能一刀切
{
    const a = mkNode(1, "加载图像", NEVER);
    const b = mkNode(2, "KSampler", ALWAYS);
    const g = mkGroup("加载图像1", [a, b]);
    results.push(
        runCase("F. 组内模式不一致（一个静音一个正常），恢复要各回各家", {
            nodes: [a, b],
            groups: [g],
            targets: { mode: "忽略", group: "加载图像1", node: "" },
            steps: [
                { expect: { 1: BYPASS, 2: BYPASS } },
                { set: { 启用: false }, expect: { 1: NEVER, 2: ALWAYS } },
            ],
        })
    );
}

// G. 切换模式：忽略 → 静音，再由启用 OFF 恢复
{
    const a = mkNode(1, "加载图像");
    const g = mkGroup("加载图像1", [a]);
    results.push(
        runCase("G. 反复切换模式后再关闭启用", {
            nodes: [a],
            groups: [g],
            targets: { mode: "忽略", group: "加载图像1", node: "加载图像" },
            steps: [
                { expect: { 1: BYPASS } },
                { set: { 模式: "静音" }, expect: { 1: NEVER } },     // 热切换模式
                { set: { 模式: "忽略" }, expect: { 1: BYPASS } },    // 切回来
                { set: { 启用: false }, expect: { 1: ALWAYS } },     // 恢复
            ],
        })
    );
}

// H. 组名改掉后，旧组必须自动还原
{
    const a = mkNode(1, "加载图像");
    const b = mkNode(2, "KSampler");
    const g1 = mkGroup("组A", [a]);
    const g2 = mkGroup("组B", [b]);
    results.push(
        runCase("H. 组名从「组A」改成「组B」，组A 要自动还原", {
            nodes: [a, b],
            groups: [g1, g2],
            targets: { mode: "忽略", group: "组A", node: "" },
            steps: [
                { expect: { 1: BYPASS, 2: ALWAYS } },
                { set: { 组名: "组B" }, expect: { 1: ALWAYS, 2: BYPASS } },
            ],
        })
    );
}

// I. 一个节点同属两个组，两个组都被点名 → 不能重复记录
{
    const a = mkNode(1, "加载图像", NEVER);
    const g1 = mkGroup("组A", [a]);
    const g2 = mkGroup("组B", [a]);
    results.push(
        runCase("I. 节点同属两个组且两组都被点名", {
            nodes: [a],
            groups: [g1, g2],
            targets: { mode: "忽略", group: "组A, 组B", node: "" },
            steps: [
                { expect: { 1: BYPASS } },
                { set: { 启用: false }, expect: { 1: NEVER } },
            ],
        })
    );
}

// J. 反复开关三次，状态不能漂移
{
    const a = mkNode(1, "加载图像");
    const g = mkGroup("加载图像1", [a]);
    results.push(
        runCase("J. 连续开关三次，状态不漂移", {
            nodes: [a],
            groups: [g],
            targets: { mode: "忽略", group: "加载图像1", node: "加载图像" },
            steps: [
                { expect: { 1: BYPASS } },
                { set: { 启用: false }, expect: { 1: ALWAYS } },
                { set: { 启用: true }, expect: { 1: BYPASS } },
                { set: { 启用: false }, expect: { 1: ALWAYS } },
                { set: { 启用: true }, expect: { 1: BYPASS } },
                { set: { 启用: false }, expect: { 1: ALWAYS } },
            ],
        })
    );
}

// K. 组内为空
{
    const g = mkGroup("空组", []);
    results.push(
        runCase("K. 组内没有任何节点（不应报错）", {
            nodes: [],
            groups: [g],
            targets: { mode: "忽略", group: "空组", node: "" },
            steps: [{ expect: {} }],
        })
    );
}

console.log(`\n────────────\n通过 ${total - failures}/${total}`);
process.exit(failures ? 1 : 0);
