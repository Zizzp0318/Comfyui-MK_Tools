import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// ═══════════════════════════════════════════════════════════════════════
// MK-视频保存 - 简化版（使用 ComfyUI 默认 UI）
// ═══════════════════════════════════════════════════════════════════════

const VIDEO_PREVIEW_WIDGET_NAME = "mk_video_save_preview";
const VIDEO_PREVIEW_MIN_H = 100;

const _mkVideoOutputCache = new Map();

const _mkOutStoreKey = (nodeId) => `mk_video_save_out_${nodeId}`;
function _mkPersistOutput(nodeId, info) {
    try { localStorage.setItem(_mkOutStoreKey(nodeId), JSON.stringify(info)); } catch (e) { }
}
function _mkLoadPersistedOutput(nodeId) {
    try { return JSON.parse(localStorage.getItem(_mkOutStoreKey(nodeId))); } catch (e) { return null; }
}

function getVideoUrl(filename, type, subfolder) {
    if (!filename) return "";
    const params = new URLSearchParams({
        filename: filename,
        type: type || "output",
    });
    if (subfolder) params.set("subfolder", subfolder);
    return `/view?${params.toString()}`;
}

// 简化版视频播放器
function createSimpleVideoPlayer(container) {
    const videoEl = document.createElement('video');
    videoEl.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;';
    videoEl.controls = true;
    container.appendChild(videoEl);

    return {
        _destroyed: false,
        _videoInfo: null,
        _lastAppliedKey: null,
        _pendingVideoUrl: null,
        load(url) {
            if (url) {
                videoEl.src = url;
            } else {
                videoEl.src = '';
            }
        },
        getSrc() {
            return videoEl.src;
        },
        setFrameRate(fps) {
            // 简化版不需要实现
        },
        resize() {
            // 简化版不需要实现
        },
        destroy() {
            this._destroyed = true;
            videoEl.remove();
        }
    };
}

app.registerExtension({
    name: "mk.video_save",
    init() {
        api.addEventListener("executed", (event) => {
            const detail = event.detail;
            if (!detail || !detail.output) return;
            const ui = detail.output.ui || detail.output;
            const videos = ui?.videos || ui?.video;
            if (!Array.isArray(videos) || videos.length === 0) return;
            const v = videos[0];
            if (!v || !v.filename) return;
            const execNode = String(detail.node || detail.display_node || "");
            const localId = execNode.split(":").pop();
            const info = {
                filename: v.filename || "",
                type: v.type || "output",
                subfolder: v.subfolder || "",
            };
            if (typeof v.frame_rate === "number" && v.frame_rate > 0) {
                info.frame_rate = v.frame_rate;
            }
            _mkVideoOutputCache.set(localId, info);
            _mkPersistOutput(localId, info);
        });
    },
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData?.name !== "MKVideoSave") return;

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnNodeCreated?.apply(this, arguments);

            const node = this;

            const playerContainer = document.createElement("div");
            playerContainer.style.cssText = "width:100%;background:#1a1a1a;position:relative;";

            const bypassOverlay = document.createElement("div");
            bypassOverlay.style.cssText =
                "position:absolute;inset:0;background-color:rgba(106,36,106,0.6);pointer-events:none;z-index:100;display:none;";
            playerContainer.appendChild(bypassOverlay);

            const updateBypassState = () => {
                if (node.mode === 4) {
                    bypassOverlay.style.display = "block";
                } else {
                    bypassOverlay.style.display = "none";
                }
            };
            updateBypassState();
            node._mkUpdateBypassState = updateBypassState;

            const player = createSimpleVideoPlayer(playerContainer);

            node.resizable = true;
            node.minWidth = 300;
            node.minHeight = 400;
            const origSetSize = node.setSize;
            node.setSize = function(size) {
                size[0] = Math.max(size[0], this.minWidth || 300);
                size[1] = Math.max(size[1], this.minHeight || 400);
                return origSetSize?.apply(this, arguments);
            };
            node.setSize([300, 400]);

            const previewWidget = node.addDOMWidget(
                VIDEO_PREVIEW_WIDGET_NAME,
                "video",
                playerContainer,
                {
                    hideOnZoom: false,
                    getValue() {
                        return null;
                    },
                    setValue(v) {
                        if (!v) { player.load(""); return; }
                        if (typeof v === "string") {
                            if (v !== player.getSrc()) player.load(v);
                            return;
                        }
                        const filename = v.filename;
                        const type = v.type || "output";
                        const subfolder = v.subfolder || "";
                        if (!filename) { player.load(""); return; }
                        const key = `${filename}|${type}|${subfolder}`;
                        if (player._lastAppliedKey === key) return;
                        player._lastAppliedKey = key;
                        if (!_mkVideoOutputCache.get(String(node.id))) return;
                        const url = getVideoUrl(filename, type, subfolder);
                        if (url) {
                            const info = { filename, type, subfolder };
                            player._videoInfo = info;
                            player.load(url);
                        }
                    },
                }
            );

            previewWidget.computeLayoutSize = function () {
                return { minHeight: VIDEO_PREVIEW_MIN_H, minWidth: 0 };
            };

            Object.defineProperty(previewWidget, 'width', {
                configurable: true,
                get() { return node.size?.[0] || 0; },
                set(_) { },
            });

            previewWidget.serialize = false;
            if (previewWidget.options) previewWidget.options.serialize = false;

            previewWidget.onRemove = () => {
                player.destroy();
            };

            const origOnResize = node.onResize;
            node.onResize = function (size) {
                const r = origOnResize?.apply(this, arguments);
                requestAnimationFrame(() => player.resize());
                return r;
            };

            const origOnRemoved = node.onRemoved;
            node.onRemoved = function () {
                api.removeEventListener("executed", _onApiExecuted);
                player.destroy();
                return origOnRemoved?.apply(this, arguments);
            };

            const origOnConfigure = node.onConfigure;
            node.onConfigure = function (info) {
                origOnConfigure?.apply(this, arguments);
                requestAnimationFrame(() => {
                    player.resize();
                    if (player._destroyed) return;
                    const moduleCached = _mkVideoOutputCache.get(String(node.id));
                    const saved = moduleCached || _mkLoadPersistedOutput(String(node.id));
                    if (saved && saved.filename) {
                        const key = `${saved.filename}|${saved.type || ""}|${saved.subfolder || ""}`;
                        if (player._lastAppliedKey === key) return;
                        player._lastAppliedKey = key;
                        player._videoInfo = saved;
                        if (saved.frame_rate) player.setFrameRate?.(saved.frame_rate);
                        const url = getVideoUrl(saved.filename, saved.type, saved.subfolder);
                        if (url) {
                            const visible = playerContainer.clientWidth > 0 && playerContainer.clientHeight > 0;
                            if (visible) {
                                player.load(url);
                            } else {
                                player._pendingVideoUrl = url;
                            }
                        }
                    }
                });
            };

            const _applyVideoOutput = (output) => {
                if (!output || !player) return;
                const ui = output.ui || output;

                const videos = ui?.videos || ui?.video;
                if (Array.isArray(videos) && videos.length > 0) {
                    const v = videos[0];
                    const info = {
                        filename: v.filename || "",
                        type: v.type || "output",
                        subfolder: v.subfolder || "",
                    };
                    if (typeof v.frame_rate === "number" && v.frame_rate > 0) {
                        info.frame_rate = v.frame_rate;
                    }
                    _mkVideoOutputCache.set(String(node.id), info);
                    _mkPersistOutput(String(node.id), info);
                    if (player._destroyed) return;
                    const key = `${info.filename}|${info.type}|${info.subfolder}`;
                    if (player._lastAppliedKey === key) return;
                    player._lastAppliedKey = key;
                    player._videoInfo = info;
                    const url = getVideoUrl(info.filename, info.type, info.subfolder);
                    if (url) {
                        if (info.frame_rate) player.setFrameRate?.(info.frame_rate);
                        const visible = playerContainer.clientWidth > 0 && playerContainer.clientHeight > 0;
                        if (visible) {
                            player.load(url);
                        } else {
                            player._pendingVideoUrl = url;
                        }
                    }
                }
            };

            const origOnExecuted = node.onExecuted;
            node.onExecuted = function (output) {
                origOnExecuted?.apply(this, arguments);
                _applyVideoOutput(output);
            };

            const _onApiExecuted = (event) => {
                const detail = event.detail;
                if (!detail || !detail.output) return;
                const execNode = String(detail.node || detail.display_node || "");
                const localId = execNode.split(":").pop();
                if (localId !== String(node.id)) return;
                _applyVideoOutput(detail.output);
            };
            api.addEventListener("executed", _onApiExecuted);

            node._mkVideoPlayer = player;

            requestAnimationFrame(() => player.resize());
        };

        const origOnDrawBackground = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (ctx) {
            if (this._mkUpdateBypassState) {
                this._mkUpdateBypassState();
            }
            return origOnDrawBackground?.apply(this, arguments);
        };
    },
});
