import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// ═══════════════════════════════════════════════════════════════════════
// MK-视频保存 - 双语翻译表
// ═══════════════════════════════════════════════════════════════════════
const _LABEL_MAP = {
    "图像": "Images",
    "帧率": "Frame Rate",
    "文件名前缀": "Filename Prefix",
    "格式": "Format",
    "CRF": "CRF",
    "模式": "Mode",
    "音频": "Audio",
    "保存": "Save",
    "预览": "Preview",
    "数值越大质量越差 默认19": "Higher = lower quality, default 19",
};

function _tr(zh) {
    const lang = localStorage.getItem("AGL.Locale") || "zh";
    return (lang === "en" && _LABEL_MAP[zh]) ? _LABEL_MAP[zh] : zh;
}

// ═══════════════════════════════════════════════════════════════════════
// 自定义数值 widget
// ═══════════════════════════════════════════════════════════════════════
function _mkWidgetNumberMouse(event, [x, y], node) {
    const oldValue = this.value;
    const step = this._mkStep || 1;
    const min = this._mkMin;
    const max = this._mkMax;

    const clamp = (v) => {
        if (min != null && v < min) v = min;
        if (max != null && v > max) v = max;
        return v;
    };

    if (event.type === 'pointermove') {
        if (event.deltaX) {
            this.value = clamp(this.value + event.deltaX);
            app.canvas._mkValueDragged = true;
        }
    } else if (event.type === 'pointerup') {
        if (app.canvas._mkValueDragged) {
            this.value = clamp(Math.round(this.value / step) * step);
        } else {
            app.canvas._mkAllowPrompt = true;
            app.canvas?.prompt?.(
                this.label || this.name,
                this.value,
                (v) => {
                    this.value = clamp(Number(v));
                    if (this.callback) this.callback(this.value);
                    node.setDirtyCanvas?.(true, true);
                },
                event
            );
            return true;
        }
        app.canvas._mkValueDragged = false;
    }

    if (oldValue !== this.value) {
        if (this.callback) this.callback(this.value);
        node.setDirtyCanvas?.(true, true);
    }
    return true;
}

function _mkDrawWidget(ctx, node, width, y, H) {
    const _nW = node?.size?.[0], _nH = node?.size?.[1];
    if (_nW != null && _nW > 0) width = Math.max(1, Math.min(width, _nW));
    if (_nH != null && _nH > 0) H = Math.max(1, Math.min(H, Math.max(0, _nH - y)));
    this._mkDrawW = width;
    const pad = 16, r = 6;
    const w = width - pad * 2;
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(pad, y + 1, w, H - 2, r); } else { ctx.rect(pad, y + 1, w, H - 2); }
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.stroke();
    ctx.fillStyle = '#9ab';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const labelText = this._mkLabel ? this._mkLabel() : (this.label || this.name || '');
    ctx.fillText(labelText, pad + 6, y + H / 2);
    const valueText = String(this.value);
    ctx.fillStyle = this._mkValueColor || '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(valueText, width - pad - 6, y + H / 2);
}

function _mkDrawComboWidget(ctx, node, width, y, H) {
    const _nW = node?.size?.[0], _nH = node?.size?.[1];
    if (_nW != null && _nW > 0) width = Math.max(1, Math.min(width, _nW));
    if (_nH != null && _nH > 0) H = Math.max(1, Math.min(H, Math.max(0, _nH - y)));
    this._mkDrawW = width;
    const pad = 16, r = 6;
    const w = width - pad * 2;
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(pad, y + 1, w, H - 2, r); } else { ctx.rect(pad, y + 1, w, H - 2); }
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.stroke();
    ctx.fillStyle = '#9ab';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const labelText = this._mkLabel ? this._mkLabel() : (this.label || this.name || '');
    const labelMaxW = width - pad * 2 - 54;
    if (ctx.measureText(labelText).width > labelMaxW) {
        let truncated = labelText;
        while (ctx.measureText(truncated + '…').width > labelMaxW && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated + '…', pad + 6, y + H / 2);
    } else {
        ctx.fillText(labelText, pad + 6, y + H / 2);
    }
    const displayText = this._mkDisplayVal ? this._mkDisplayVal(String(this.value ?? '')) : String(this.value ?? '');
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    const valMaxW = width - pad * 2 - 54;
    if (ctx.measureText(displayText).width > valMaxW) {
        let truncated = displayText;
        while (ctx.measureText(truncated + '…').width > valMaxW && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated + '…', width - pad - 16, y + H / 2);
    } else {
        ctx.fillText(displayText, width - pad - 16, y + H / 2);
    }
    ctx.fillStyle = '#888';
    ctx.beginPath();
    const dx = width - pad - 8, dy = y + H / 2;
    ctx.moveTo(dx - 4, dy - 2);
    ctx.lineTo(dx + 4, dy - 2);
    ctx.lineTo(dx, dy + 3);
    ctx.closePath();
    ctx.fill();
}

function _mkFpsComboMouse(event, [x, y], node) {
    if (event.type === 'pointerup') {
        _mkShowComboDropdown(this, node, event);
        return true;
    }
    return true;
}

function _mkShowComboDropdown(widget, node, event) {
    const old = document.querySelector('.mk-fps-dropdown');
    if (old) old.remove();

    const values = widget.options?.values || ["mp4", "webm", "gif"];
    const canvasRect = app.canvas?.canvas?.getBoundingClientRect?.();
    if (!canvasRect) return;

    let wx = event.clientX;
    let wy = event.clientY;
    if (!wx || !wy) {
        const pad = 16;
        const nodeX = (node.pos?.[0] || 0) * app.canvas.ds.scale + canvasRect.left;
        const nodeY = (node.pos?.[1] || 0) * app.canvas.ds.scale + canvasRect.top;
        const widgetIdx = node.widgets?.indexOf(widget) ?? 0;
        const widgetY = nodeY + node.widgets?.slice(0, widgetIdx).reduce((s, w) => s + (w.computeSize?.(node.size[0])?.[1] || 20), 0) || 0;
        wx = nodeX + node.size[0] * app.canvas.ds.scale - pad;
        wy = widgetY;
    }

    const dropdown = document.createElement('div');
    dropdown.className = 'mk-fps-dropdown';
    dropdown.style.cssText = `
        position: fixed; z-index: 99999;
        left: ${Math.max(4, wx - 60)}px; top: ${wy + 4}px;
        min-width: 80px;
        background: #2a2a2a; border: 1px solid #555; border-radius: 6px;
        padding: 4px 0; box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    `;

    values.forEach(v => {
        const item = document.createElement('div');
        const displayText = widget._mkDisplayVal ? widget._mkDisplayVal(String(v)) : String(v);
        item.textContent = displayText;
        const selected = String(v) === String(widget.value);
        item.style.cssText = `
            padding: 4px 16px; cursor: pointer; font-size: 13px;
            color: ${selected ? '#FFD700' : '#ccc'};
            background: ${selected ? '#333' : 'transparent'};
        `;
        item.onmouseenter = () => { item.style.background = '#444'; };
        item.onmouseleave = () => { item.style.background = selected ? '#333' : 'transparent'; };
        item.addEventListener('pointerdown', (e) => e.stopPropagation());
        item.onclick = (e) => {
            e.stopPropagation();
            widget.value = v;
            if (widget.callback) widget.callback(v);
            node.setDirtyCanvas?.(true, true);
            dropdown.remove();
        };
        dropdown.appendChild(item);
    });

    dropdown.addEventListener('pointerdown', (e) => e.stopPropagation());

    const close = (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.remove();
            document.removeEventListener('pointerdown', close, true);
        }
    };
    document.addEventListener('pointerdown', close, true);

    document.body.appendChild(dropdown);
}

function _mkCreateNumberWidget(node, inputName, inputData) {
    const opts = inputData[1] || {};
    const w = {
        name: inputName,
        type: 'mk-number',
        value: opts.default ?? 0,
        options: {},
        _mkStep: opts.step || 1,
        _mkMin: opts.min,
        _mkMax: opts.max,
        computeSize(width) { return [width, 20]; },
        draw: _mkDrawWidget,
        mouse: _mkWidgetNumberMouse,
        callback(v) { if (this._mkCb) this._mkCb(v); },
    };
    if (!node.widgets) node.widgets = [];
    node.widgets.push(w);
    return w;
}

function _mkPatchCanvasPrompt() {
    if (app.canvas._mkPromptPatched) return;
    const origPrompt = app.canvas.prompt;
    app.canvas.prompt = function () {
        if (app.canvas._mkAllowPrompt) {
            app.canvas._mkAllowPrompt = false;
            app.canvas._mkLastPromptMs = Date.now();
            return origPrompt.apply(this, arguments);
        }
        if (app.canvas._mkValueDragged) {
            app.canvas._mkValueDragged = false;
            return null;
        }
        if (app.canvas._mkLastPromptMs && Date.now() - app.canvas._mkLastPromptMs < 300) {
            return null;
        }
        return origPrompt.apply(this, arguments);
    };
    app.canvas._mkPromptPatched = true;
}

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
    getCustomWidgets() {
        return {
            MKINT: (node, name, data) => _mkCreateNumberWidget(node, name, data),
            MKFLOAT: (node, name, data) => _mkCreateNumberWidget(node, name, data),
        };
    },
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData?.name !== "MKVideoSave") return;

        for (const inp of Object.values({ ...nodeData.input?.required, ...nodeData.input?.optional })) {
            if (Array.isArray(inp[0]) && typeof inp[1] === 'object') {
                inp[1].widgetType = "MKINT";
            }
        }

        for (const inp of Object.values({ ...nodeData.input?.required, ...nodeData.input?.optional })) {
            if (["INT", "FLOAT"].includes(inp[0]) && inp[1]) {
                inp[1].widgetType ??= "MK" + inp[0];
            }
        }

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

            const modeWidget = node.widgets.find(w => w.name === '模式');

            const updateOutputDirDisplay = async () => {
                try {
                    const response = await api.fetchApi('/mk/get_output_dir');
                    const data = await response.json();
                    const isSave = (modeWidget?.value ?? '保存') !== '预览';
                    const baseDir = isSave ? data.output_dir : data.temp_dir;
                    node._mkFullOutputDir = baseDir;
                    node.setDirtyCanvas(true, true);
                } catch (e) {
                    console.error('[MK-视频保存] 获取输出目录失败:', e);
                }
            };
            updateOutputDirDisplay();

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

                if (ui?.output_dir) {
                    node._mkFullOutputDir = ui.output_dir;
                    node.setDirtyCanvas(true, true);
                }

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

            _mkPatchCanvasPrompt();

            // Widget样式设置
            for (const w of this.widgets || []) {
                if (w.name !== VIDEO_PREVIEW_WIDGET_NAME && !w._mkWidthFixed) {
                    w._mkWidthFixed = true;
                    try {
                        Object.defineProperty(w, 'width', {
                            configurable: true,
                            get() { return node.size?.[0] || 0; },
                            set(_) { },
                        });
                    } catch (_) {}
                }

                if (w.name === '帧率' || w.name === '文件名前缀' || w.name === '格式' || w.name === 'CRF' || w.name === '模式') {
                    w._mkLabel = () => _tr(w.name);
                }

                if (w.name === '格式') {
                    w.draw = _mkDrawComboWidget;
                    w.mouse = _mkFpsComboMouse;
                    w.value = String(w.value ?? "mp4");
                    w.options = w.options || {};
                    w.options.values = ["mp4", "webm", "gif"];
                    w._mkDisplayVal = (v) => String(v);
                } else if (w.name === '帧率') {
                    w.draw = _mkDrawWidget;
                    w._mkValueColor = '#fff';
                    if (typeof w.mouse !== 'function') w.mouse = _mkWidgetNumberMouse;
                } else if (w.name === '文件名前缀') {
                    w.draw = _mkDrawWidget;
                    if (!w._mkValueColor) w._mkValueColor = '#fff';
                } else if (w.name === 'CRF') {
                    w.draw = function(ctx, node, width, y, H) {
                        const _nW = node?.size?.[0], _nH = node?.size?.[1];
                        if (_nW != null && _nW > 0) width = Math.max(1, Math.min(width, _nW));
                        if (_nH != null && _nH > 0) H = Math.max(1, Math.min(H, Math.max(0, _nH - y)));
                        this._mkDrawW = width;
                        const pad = 16, r = 6;
                        const wr = width - pad * 2;
                        ctx.fillStyle = '#2a2a2a';
                        ctx.beginPath();
                        if (ctx.roundRect) { ctx.roundRect(pad, y + 1, wr, H - 2, r); } else { ctx.rect(pad, y + 1, wr, H - 2); }
                        ctx.fill();
                        ctx.strokeStyle = '#444';
                        ctx.stroke();
                        ctx.fillStyle = '#9ab';
                        ctx.font = '12px sans-serif';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText((this._mkLabel ? this._mkLabel() : (this.label || this.name || '')), pad + 6, y + H / 2);
                        const valueText = String(this.value);
                        ctx.font = '14px sans-serif';
                        const vw = ctx.measureText(valueText).width;
                        ctx.fillStyle = '#fff';
                        ctx.textAlign = 'right';
                        ctx.fillText(valueText, width - pad - 6, y + H / 2);
                        ctx.fillStyle = '#555';
                        ctx.font = '10px sans-serif';
                        ctx.textAlign = 'right';
                        ctx.fillText(_tr('数值越大质量越差 默认19'), width - pad - 6 - vw - 10, y + H / 2);
                    };
                } else if (w.name === '模式') {
                    w.value = String(w.value ?? "保存");
                    w.options = w.options || {};
                    w.options.values = ["保存", "预览"];
                    w._mkDisplayVal = (v) => _tr(String(v));
                    w.draw = function(ctx, nd, width, y, H) {
                        const _nW = nd?.size?.[0], _nH = nd?.size?.[1];
                        if (_nW != null && _nW > 0) width = Math.max(1, Math.min(width, _nW));
                        if (_nH != null && _nH > 0) H = Math.max(1, Math.min(H, Math.max(0, _nH - y)));
                        this._mkDrawW = width;
                        const pad = 16, r = 6, wr = width - pad * 2;
                        ctx.fillStyle = '#2a2a2a';
                        ctx.beginPath();
                        if (ctx.roundRect) ctx.roundRect(pad, y + 1, wr, H - 2, r); else ctx.rect(pad, y + 1, wr, H - 2);
                        ctx.fill();
                        ctx.strokeStyle = '#444';
                        ctx.stroke();
                        ctx.fillStyle = '#9ab';
                        ctx.font = '12px sans-serif';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText((this._mkLabel ? this._mkLabel() : '模式'), pad + 6, y + H / 2);
                        const isSave = this.value !== '预览';
                        const dispVal = this._mkDisplayVal ? this._mkDisplayVal(this.value || '保存') : (this.value || '保存');
                        ctx.fillStyle = isSave ? '#FFD700' : '#88ccff';
                        ctx.font = '13px sans-serif';
                        ctx.textAlign = 'right';
                        ctx.fillText(dispVal, width - pad - 6, y + H / 2);
                    };
                    w.mouse = function(event, [x, y], node) {
                        if (event.type === 'pointerdown') return true;
                        if (event.type === 'pointerup') {
                            this.value = (this.value === '预览') ? '保存' : '预览';
                            node.setDirtyCanvas?.(true, true);
                            updateOutputDirDisplay();
                            return true;
                        }
                        return true;
                    };
                }
            }

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
