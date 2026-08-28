import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// ═══════════════════════════════════════════════════════════════════════
// 双语标签翻译映射
// ═══════════════════════════════════════════════════════════════════════
const _LABEL_MAP = {
    "强制帧率": "Force FPS",
    "视频": "Video",
    "视频比例": "Aspect Ratio",
    "自定义宽度": "Custom Width",
    "自定义高度": "Custom Height",
    "跳过帧数": "Skip Frames",
    "帧数上限": "Max Frames",
    "上传视频": "Upload Video",
    "边长模式": "Edge Mode",
    "边长尺寸": "Edge Size",
    "自定义比例": "Custom Ratio",
    "原始比例": "Original",
    "竖屏9:16": "Portrait 9:16",
    "竖屏3:4": "Portrait 3:4",
    "横屏16:9": "Landscape 16:9",
    "横屏4:3": "Landscape 4:3",
    "等比1:1": "Square 1:1",
    "长边": "Long Edge",
    "短边": "Short Edge",
    "宽度": "Width",
    "高度": "Height",
    "图像": "image",
    "音频": "audio",
    "视频信息": "video info",
    "单击视频播放或暂停/双击视频上传": "Click to play/pause | Double-click to upload",
};

function _tr(zh) {
    const lang = localStorage.getItem("AGL.Locale") || "zh";
    return (lang === "en" && _LABEL_MAP[zh]) ? _LABEL_MAP[zh] : zh;
}

const VIDEO_EXTS = ["webm", "mp4", "mkv", "gif", "mov", "avi", "flv", "wmv", "m4v", "mpg", "mpeg", "ts"];
const VIDEO_PREVIEW_WIDGET_NAME = "mk_video_preview";
const VIDEO_PREVIEW_MIN_H = 100;

// ═══════════════════════════════════════════════════════════════════════
// 自定义数值 widget
// ═══════════════════════════════════════════════════════════════════════
function _mkWidgetNumberMouse(event, [x, y], node) {
    if (Array.isArray(this.options?.values) && this.options.values.length > 0) {
        if (event.type === 'pointerup' && !app.canvas._mkValueDragged) {
            if (app.canvas) app.canvas._mkBlockPrompt = true;
            _mkShowComboDropdown(this, node, event);
            return true;
        }
        return true;
    }
    const widgetWidth = this._mkDrawW || this.width || node.size[0];
    const oldValue = this.value;
    const step = this._mkStep || 1;
    const dragStep = this._mkDragStep ?? (step > 1 ? 1 : step);
    const min = this._mkMin;
    const max = this._mkMax;
    const dragMax = this._mkDragMax != null ? this._mkDragMax : max;

    const clamp = (v, useMax) => {
        const m = useMax != null ? useMax : max;
        if (min != null && v < min) v = min;
        if (m != null && v > m) v = m;
        return v;
    };

    if (event.type === 'pointermove') {
        if (event.deltaX) {
            let newValue = this.value + event.deltaX;
            if (dragStep > 0) {
                newValue = Math.round(newValue / dragStep) * dragStep;
            }
            if (Math.abs(newValue - Math.round(newValue)) < 1e-6) {
                newValue = Math.round(newValue);
            }
            this.value = clamp(newValue, dragMax);
            app.canvas._mkValueDragged = true;
        }
    } else if (event.type === 'pointerup') {
        if (app.canvas._mkValueDragged) {
            let newValue = this.value;
            if (step > 0) {
                newValue = Math.round(newValue / step) * step;
            }
            if (Math.abs(newValue - Math.round(newValue)) < 1e-6) {
                newValue = Math.round(newValue);
            }
            this.value = clamp(newValue, dragMax);
        } else {
            app.canvas._mkAllowPrompt = true;
            app.canvas?.prompt?.(
                this.label || this.name,
                this.value,
                (v) => {
                    let nv = Number(v);
                    if (step > 0) {
                        nv = Math.round(nv / step) * step;
                    }
                    if (Math.abs(nv - Math.round(nv)) < 1e-6) {
                        nv = Math.round(nv);
                    }
                    this.value = clamp(nv, max);
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

// 带重置按钮的数值控件
function _mkWidgetNumberWithResetMouse(event, [x, y], node) {
    if (Array.isArray(this.options?.values) && this.options.values.length > 0) {
        if (event.type === 'pointerup' && !app.canvas._mkValueDragged) {
            if (app.canvas) app.canvas._mkBlockPrompt = true;
            _mkShowComboDropdown(this, node, event);
            return true;
        }
        return true;
    }
    if (event.type === 'pointerup' && !app.canvas._mkValueDragged && this._mkResetRect) {
        const [rx, ry, rw, rh] = this._mkResetRect;
        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
            this.value = 0;
            if (this.callback) this.callback(this.value);
            node.setDirtyCanvas?.(true, true);
            return true;
        }
    }
    if (event.type === 'pointermove' && this._mkResetRect) {
        const [rx, ry, rw, rh] = this._mkResetRect;
        const hover = x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
        if (hover !== this._mkResetHover) {
            this._mkResetHover = hover;
            node.setDirtyCanvas?.(true, true);
        }
    }
    return _mkWidgetNumberMouse.call(this, event, [x, y], node);
}

function _mkDrawWidget(ctx, node, width, y, H) {
    const _nW = node?.size?.[0], _nH = node?.size?.[1];
    if (_nW != null && _nW > 0) width = Math.max(1, Math.min(width, _nW));
    if (_nH != null && _nH > 0) H = Math.max(1, Math.min(H, Math.max(0, _nH - y)));
    this._mkDrawW = width;
    this._mkLastY = y;
    this._mkLastH = H;
    const pad = 16;
    const r = 6;
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
    ctx.fillText(this.label || this.name || '', pad + 6, y + H / 2);

    const step = this._mkStep || 1;
    const dragStep = this._mkDragStep ?? (step > 1 ? 1 : step);
    const isDragging = !!app.canvas?._mkValueDragged;
    const displayStep = isDragging ? dragStep : step;
    let displayValue = this.value;
    if (typeof displayValue === 'number' && !Number.isNaN(displayValue)) {
        if (displayStep > 0) {
            displayValue = Math.round(displayValue / displayStep) * displayStep;
        }
        if (Math.abs(displayValue - Math.round(displayValue)) < 1e-6) {
            displayValue = Math.round(displayValue);
        }
    }
    const valueText = String(displayValue);
    ctx.fillStyle = this._mkValueColor || '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    let valueX = width - pad - 6;

    if (this._mkShowReset) {
        valueX -= 18;
        const btnR = 7;
        const btnCX = width - pad - 6 - btnR;
        const btnCY = y + H / 2;
        this._mkResetRect = [btnCX - btnR, btnCY - btnR, btnR * 2, btnR * 2];
        ctx.strokeStyle = this._mkResetHover ? '#888' : '#555';
        ctx.lineWidth = 2;
        const s = 4;
        ctx.beginPath();
        ctx.moveTo(btnCX - s, btnCY - s);
        ctx.lineTo(btnCX + s, btnCY + s);
        ctx.moveTo(btnCX + s, btnCY - s);
        ctx.lineTo(btnCX - s, btnCY + s);
        ctx.stroke();
    }
    ctx.fillStyle = this._mkValueColor || '#fff';
    ctx.fillText(valueText, valueX, y + H / 2);
}

function _mkDrawComboWidget(ctx, node, width, y, H) {
    const _nW = node?.size?.[0], _nH = node?.size?.[1];
    if (_nW != null && _nW > 0) width = Math.max(1, Math.min(width, _nW));
    if (_nH != null && _nH > 0) H = Math.max(1, Math.min(H, Math.max(0, _nH - y)));
    this._mkDrawW = width;
    this._mkLastY = y;
    this._mkLastH = H;
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
    const labelText = this.label || this.name || '';
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
    if (event.type === 'pointerdown') {
        if (app.canvas) app.canvas._mkBlockPrompt = true;
        setTimeout(() => {
            if (!document.querySelector('.mk-fps-dropdown') && app.canvas) {
                app.canvas._mkBlockPrompt = false;
            }
        }, 500);
    }
    if (event.type === 'pointerup') {
        _mkShowComboDropdown(this, node, event);
        return true;
    }
    return true;
}

function _mkShowComboDropdown(widget, node, event) {
    const old = document.querySelector('.mk-fps-dropdown');
    if (old) old.remove();

    if (app.canvas) app.canvas._mkBlockPrompt = true;

    const values = widget.options?.values || ["0", "16", "24", "25", "30", "60"];
    const canvasRect = app.canvas?.canvas?.getBoundingClientRect?.();
    if (!canvasRect) return;

    let wx = event.clientX;
    let wy = event.clientY;
    if (!wx || !wy) {
        const pad = 16;
        const scale = app.canvas.ds.scale;
        const offset = app.canvas.ds.offset;
        const nodeX = (node.pos?.[0] + offset[0]) * scale + canvasRect.left;
        const nodeY = (node.pos?.[1] + offset[1]) * scale + canvasRect.top;
        const lastY = widget._mkLastY;
        const lastH = widget._mkLastH ?? 20;
        const widgetY = (lastY != null)
            ? (nodeY + (lastY + lastH) * scale)
            : (() => {
                const widgetIdx = node.widgets?.indexOf(widget) ?? 0;
                return nodeY + (node.widgets?.slice(0, widgetIdx).reduce((s, w) => s + (w.computeSize?.(node.size[0])?.[1] || 20), 0) || 0) * scale;
            })();
        wx = nodeX + node.size[0] * scale - pad;
        wy = widgetY;
    }

    const dropdown = document.createElement('div');
    dropdown.className = 'mk-fps-dropdown notranslate';
    dropdown.setAttribute('translate', 'no');
    dropdown.style.cssText = `
        position: fixed; z-index: 99999;
        left: ${Math.max(4, wx - 60)}px; top: ${wy + 4}px;
        min-width: 80px;
        background: #2a2a2a; border: 1px solid #555; border-radius: 6px;
        padding: 4px 0; box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    `;

    values.forEach(v => {
        const item = document.createElement('div');
        item.className = 'notranslate';
        item.setAttribute('translate', 'no');
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
            _closeDropdown();
        };
        dropdown.appendChild(item);
    });

    dropdown.addEventListener('pointerdown', (e) => e.stopPropagation());

    const _closeDropdown = () => {
        dropdown.remove();
        if (app.canvas) app.canvas._mkBlockPrompt = false;
    };

    const close = (e) => {
        if (!dropdown.contains(e.target)) {
            _closeDropdown();
            document.removeEventListener('pointerdown', close, true);
        }
    };
    document.addEventListener('pointerdown', close, true);

    document.body.appendChild(dropdown);
}

function _mkDrawButtonWidget(ctx, node, width, y, H) {
    const _nW = node?.size?.[0], _nH = node?.size?.[1];
    if (_nW != null && _nW > 0) width = Math.max(1, Math.min(width, _nW));
    if (_nH != null && _nH > 0) H = Math.max(1, Math.min(H, Math.max(0, _nH - y)));
    const pad = 16, r = 6;
    const w = width - pad * 2;
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(pad, y + 1, w, H - 2, r); } else { ctx.rect(pad, y + 1, w, H - 2); }
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label || this.name || this.value || '', width / 2, y + H / 2);
}

// 根据视频比例切换自定义宽度/高度的显示和行为
function _updateRatioWidgets(node) {
    const ratioWidget = node.widgets?.find(w => w.name === "视频比例");
    const wWidget = node.widgets?.find(w => w.name === "自定义宽度");
    const hWidget = node.widgets?.find(w => w.name === "自定义高度");
    if (!ratioWidget || !wWidget || !hWidget) return;

    const isRatio = ratioWidget.value !== "自定义比例";

    if (isRatio) {
        wWidget.options.values = ["1", "2", "3", "4"];
        wWidget._mkDisplayVal = (v) => _tr(({1:"长边",2:"短边",3:"宽度",4:"高度"})[v] || v);
        wWidget.draw = _mkDrawComboWidget;
        wWidget.mouse = _mkFpsComboMouse;
        wWidget._mkShowReset = false;
        wWidget.label = _tr("边长模式");
        if (wWidget.value < 1 || wWidget.value > 4) wWidget.value = "1";
        hWidget.label = _tr("边长尺寸");
        hWidget.draw = _mkDrawWidget;
        hWidget.mouse = _mkWidgetNumberMouse;
        hWidget._mkShowReset = false;
    } else {
        wWidget.options.values = undefined;
        wWidget._mkDisplayVal = undefined;
        wWidget.draw = _mkDrawWidget;
        wWidget.mouse = _mkWidgetNumberWithResetMouse;
        wWidget._mkShowReset = true;
        wWidget.label = _tr("自定义宽度");
        if (typeof wWidget.value !== "number" || wWidget.value < 0) wWidget.value = 0;
        hWidget.draw = _mkDrawWidget;
        hWidget.mouse = _mkWidgetNumberWithResetMouse;
        hWidget._mkShowReset = true;
        hWidget.label = _tr("自定义高度");
        if (typeof hWidget.value !== "number" || hWidget.value < 0) hWidget.value = 0;
    }
    node.setDirtyCanvas?.(true, true);
}

// 统一应用所有 widget 的样式
function _applyWidgetStyles(node) {
    const _MK_WIDGET_NAME_FIX = {
        '强制帧率': 1, '视频比例': 1, '自定义宽度': 1,
        '自定义高度': 1, '跳过帧数': 1, '帧数上限': 1,
    };
    for (const w of node.widgets || []) {
        if (w.name === VIDEO_PREVIEW_WIDGET_NAME) continue;
        if (_MK_WIDGET_NAME_FIX[w.name] && !w._mkWidthFixed) {
            w._mkWidthFixed = true;
            Object.defineProperty(w, 'width', {
                configurable: true,
                get() { return node.size?.[0] || 0; },
                set(_) { },
            });
        }
        if (w.name === '强制帧率') {
            w._mkValueColor = '#FFD700';
            w._mkShowReset = true;
            w.draw = _mkDrawWidget;
            w.mouse = _mkWidgetNumberWithResetMouse;
            w.label = _tr("强制帧率");
            w._mkDragStep = 1;
        } else if (w.name === '视频') {
            w.draw = _mkDrawComboWidget;
            w.label = _tr("视频");
        } else if (w.name === '视频比例') {
            w.draw = _mkDrawComboWidget;
            w.mouse = _mkFpsComboMouse;
            w.value = String(w.value ?? "自定义比例");
            w.options = w.options || {};
            w.options.values = ["自定义比例", "原始比例", "竖屏9:16", "竖屏3:4", "横屏16:9", "横屏4:3", "等比1:1"];
            w._mkDisplayVal = (v) => _tr(String(v));
            w.label = _tr("视频比例");
        } else if (w.name === '上传视频') {
            w.draw = _mkDrawButtonWidget;
            w.label = _tr("上传视频");
        } else if (w.name === '跳过帧数') {
            w._mkValueColor = '#FF4444';
            w._mkShowReset = true;
            w.draw = _mkDrawWidget;
            w.mouse = _mkWidgetNumberWithResetMouse;
            w.label = _tr("跳过帧数");
        } else if (w.name === '帧数上限') {
            w._mkValueColor = '#6699FF';
            w._mkShowReset = true;
            w.draw = _mkDrawWidget;
            w.mouse = _mkWidgetNumberWithResetMouse;
            w.label = _tr("帧数上限");
        } else if (w.name === '自定义宽度' || w.name === '自定义高度') {
            w._mkValueColor = w._mkValueColor || '#fff';
            w._mkShowReset = true;
            w.draw = _mkDrawWidget;
            w.mouse = _mkWidgetNumberWithResetMouse;
            w.label = _tr(w.name);
        }
    }
}

function _mkCreateNumberWidget(node, inputName, inputData) {
    const opts = inputData[1] || {};
    const w = {
        name: inputName,
        type: 'number',
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

function _mkCreateComboWidget(node, inputName, inputData) {
    const values = Array.isArray(inputData[0]) ? inputData[0] : [];
    const opts = inputData[1] || {};
    const w = {
        name: inputName,
        type: 'mk_combo',
        value: opts.default != null ? opts.default : (values[0] != null ? values[0] : ""),
        options: { values: values },
        computeSize(width) { return [width, 20]; },
        draw: _mkDrawComboWidget,
        mouse: _mkFpsComboMouse,
        callback(v) { if (this._mkCb) this._mkCb(v); },
    };
    if (!node.widgets) node.widgets = [];
    node.widgets.push(w);
    return w;
}

// 拦截 canvas.prompt
function _mkPatchCanvasPrompt() {
    if (app.canvas._mkPromptPatched) return;
    const origPrompt = app.canvas.prompt;
    app.canvas.prompt = function () {
        if (app.canvas._mkBlockPrompt) return null;
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

function isVideoFilename(name) {
    if (!name) return false;
    const ext = name.split(".").pop().toLowerCase();
    return VIDEO_EXTS.includes(ext);
}

function getVideoUrl(filename) {
    if (!filename) return "";
    let name = filename;
    let type = "input";
    let subfolder = "";
    const suffixes = [" [output]", " [input]", " [temp]"];
    for (const s of suffixes) {
        if (name.endsWith(s)) {
            type = s.trim().slice(1, -1);
            name = name.slice(0, -s.length);
            break;
        }
    }
    const params = new URLSearchParams({ filename: name, type });
    if (subfolder) params.set("subfolder", subfolder);
    return `/view?${params.toString()}&rand=${Math.random()}`;
}

// 分块上传常量
const _MK_VIDEO_CHUNK_SIZE = 20 * 1024 * 1024;
const _MK_VIDEO_MAX_SIZE = 1024 * 1024 * 1024;
const _MK_VIDEO_CONCURRENCY = 3;
const _MK_VIDEO_RETRY = 3;

function _mkFormatSize(bytes) {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
}

function _mkVideoAlert(message, title = "提示") {
    const existing = document.querySelector(".mk-video-alert-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "mk-video-alert-overlay";
    overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999;font-family:sans-serif;";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const dialog = document.createElement("div");
    dialog.style.cssText =
        "background:var(--comfy-menu-bg,#1e1e1e);color:#ddd;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.5);width:420px;max-width:90vw;border:1px solid rgba(255,255,255,0.1);";
    dialog.onclick = (e) => e.stopPropagation();

    dialog.innerHTML = `
        <div style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:14px;font-weight:bold;color:#FFD700;">${title}</div>
        </div>
        <div style="padding:14px 18px;font-size:12px;line-height:1.6;white-space:pre-wrap;">${message}</div>
        <div style="padding:12px 18px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:flex-end;">
            <button class="mk-video-alert-ok" style="padding:6px 16px;background:#FFD700;color:#333;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">知道了</button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const close = () => {
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
    };
    dialog.querySelector(".mk-video-alert-ok").onclick = close;
    const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    };
    document.addEventListener("keydown", onKey, true);
}

async function _mkUploadOneChunk(sessionId, chunkIndex, chunkOffset, chunkBlob) {
    const formData = new FormData();
    formData.append("session_id", sessionId);
    formData.append("chunk_index", chunkIndex);
    formData.append("chunk_offset", chunkOffset);
    formData.append("chunk", chunkBlob);

    for (let attempt = 0; attempt < _MK_VIDEO_RETRY; attempt++) {
        try {
            const fd = attempt === 0 ? formData : new FormData([
                ["session_id", sessionId],
                ["chunk_index", String(chunkIndex)],
                ["chunk_offset", String(chunkOffset)],
                ["chunk", chunkBlob],
            ]);
            const resp = await api.fetchApi("/mk/video_upload_chunk", { method: "POST", body: fd });
            if (resp.ok) {
                return await resp.json();
            }
            if (resp.status === 404) throw new Error("会话已过期");
            console.warn(`[MK-视频加载] 分块 ${chunkIndex} 上传失败 (HTTP ${resp.status})，重试 ${attempt + 1}/${_MK_VIDEO_RETRY}`);
        } catch (e) {
            console.warn(`[MK-视频加载] 分块 ${chunkIndex} 上传异常:`, e.message, `，重试 ${attempt + 1}/${_MK_VIDEO_RETRY}`);
        }
    }
    throw new Error(`分块 ${chunkIndex} 上传失败（已重试 ${_MK_VIDEO_RETRY} 次）`);
}

async function _mkUploadAllChunks(file, sessionId, onProgress) {
    const totalChunks = Math.ceil(file.size / _MK_VIDEO_CHUNK_SIZE);
    const chunks = [];
    for (let i = 0; i < totalChunks; i++) {
        const offset = i * _MK_VIDEO_CHUNK_SIZE;
        const end = Math.min(offset + _MK_VIDEO_CHUNK_SIZE, file.size);
        chunks.push({ index: i, offset, blob: file.slice(offset, end) });
    }

    let completed = 0;
    let queueIdx = 0;
    const finalResult = { filename: null };

    async function worker() {
        while (queueIdx < chunks.length) {
            const chunk = chunks[queueIdx++];
            const result = await _mkUploadOneChunk(sessionId, chunk.index, chunk.offset, chunk.blob);
            completed++;
            if (onProgress) onProgress(completed, totalChunks);
            if (result.status === "done") {
                finalResult.filename = result.filename;
            }
        }
    }

    const workers = [];
    for (let i = 0; i < _MK_VIDEO_CONCURRENCY; i++) {
        workers.push(worker());
    }
    await Promise.all(workers);

    if (!finalResult.filename) {
        const statusResp = await api.fetchApi(`/mk/video_upload_status?session_id=${sessionId}`);
        if (statusResp.ok) {
            const status = await statusResp.json();
            if (status.done) {
                finalResult.filename = status.filename;
            }
        }
    }

    return finalResult.filename;
}

async function uploadVideoFiles(files, onProgress) {
    const uploaded = [];
    for (const file of files) {
        try {
            if (file.size > _MK_VIDEO_MAX_SIZE) {
                _mkVideoAlert(
                    `视频 "${file.name}"（${_mkFormatSize(file.size)}）超过 1GB 限制。\n请压缩后再上传。`,
                    "上传失败"
                );
                continue;
            }

            let filename = null;

            if (file.size <= _MK_VIDEO_CHUNK_SIZE) {
                const body = new FormData();
                body.append("image", file);
                body.append("overwrite", "true");
                body.append("type", "input");
                const resp = await api.fetchApi("/upload/image", { method: "POST", body });
                if (resp.status === 200) {
                    const data = await resp.json();
                    if (data && data.name) filename = data.name;
                } else if (resp.status === 413) {
                    _mkVideoAlert(
                        `视频 "${file.name}" 超过服务器上传限制，请使用分块上传。`,
                        "上传失败"
                    );
                }
            } else {
                const totalChunks = Math.ceil(file.size / _MK_VIDEO_CHUNK_SIZE);
                if (onProgress) onProgress(0, totalChunks);

                const startResp = await api.fetchApi("/mk/video_upload_start", {
                    method: "POST",
                    body: JSON.stringify({
                        filename: file.name,
                        total_size: file.size,
                        total_chunks: totalChunks,
                    }),
                    headers: { "Content-Type": "application/json" },
                });

                if (!startResp.ok) {
                    const errData = await startResp.json().catch(() => ({}));
                    _mkVideoAlert(
                        `视频上传启动失败: ${errData.error || startResp.statusText}`,
                        "上传失败"
                    );
                    continue;
                }

                const startData = await startResp.json();
                const sessionId = startData.session_id;

                filename = await _mkUploadAllChunks(file, sessionId, (completed, total) => {
                    if (onProgress) onProgress(completed, total);
                });

                if (!filename) {
                    _mkVideoAlert(
                        `视频 "${file.name}" 分块上传未完成，请重试。`,
                        "上传失败"
                    );
                    continue;
                }
            }

            if (filename) {
                uploaded.push(filename);
            }
        } catch (e) {
            console.warn("[MK-视频加载] 视频上传失败:", e);
            _mkVideoAlert(
                `视频 "${file.name}" 上传失败: ${e.message}`,
                "上传失败"
            );
        }
    }
    return uploaded;
}

async function refreshVideoCombo(videoWidget, selectName) {
    try {
        const resp = await api.fetchApi("/object_info/MKVideoLoader");
        if (!resp.ok) return;
        const info = await resp.json();
        const list = info?.MKVideoLoader?.input?.required?.["视频"]?.[0];
        if (Array.isArray(list)) {
            videoWidget.options.values = list;
            if (selectName && list.includes(selectName)) {
                videoWidget.value = selectName;
            } else if (list.length > 0) {
                videoWidget.value = list[list.length - 1];
            }
            videoWidget.callback?.(videoWidget.value);
        }
    } catch (_) {}
}

// 简化版视频播放器（仅用于预览）
function createSimpleVideoPlayer(container) {
    const videoEl = document.createElement('video');
    videoEl.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;';
    videoEl.controls = true;
    container.appendChild(videoEl);

    return {
        load(url) {
            if (url) {
                videoEl.src = url;
            } else {
                videoEl.src = '';
            }
        },
        destroy() {
            videoEl.remove();
        }
    };
}

function bindVideoLoaderInteractions(node) {
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

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = false;
    fileInput.accept = VIDEO_EXTS.map(e => "." + e).join(",");
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    const triggerUpload = () => {
        app.canvas.node_widget = null;
        fileInput.value = "";
        fileInput.click();
    };

    const playerContainer = document.createElement("div");
    playerContainer.className = "mk-video-preview-container";
    playerContainer.style.cssText = "width:100%;background:#1a1a1a;position:relative;";

    const bypassOverlay = document.createElement("div");
    bypassOverlay.style.cssText =
        "position:absolute;inset:0;background-color:rgba(106,36,106,0.6);pointer-events:none;z-index:100;display:none;";
    playerContainer.appendChild(bypassOverlay);

    const uploadOverlay = document.createElement("div");
    uploadOverlay.style.cssText =
        "position:absolute;inset:0;background:rgba(0,0,0,0.85);display:none;flex-direction:column;align-items:center;justify-content:center;z-index:101;";
    const uploadTitle = document.createElement("div");
    uploadTitle.style.cssText = "color:#FFD700;font-size:13px;margin-bottom:8px;";
    uploadOverlay.appendChild(uploadTitle);
    const uploadBarBg = document.createElement("div");
    uploadBarBg.style.cssText = "width:80%;height:6px;background:#333;border-radius:3px;overflow:hidden;";
    const uploadBarFill = document.createElement("div");
    uploadBarFill.style.cssText = "width:0%;height:100%;background:linear-gradient(90deg,#B8860B,#FFD700,#FFF8DC);border-radius:3px;transition:width 0.3s ease;";
    uploadBarBg.appendChild(uploadBarFill);
    uploadOverlay.appendChild(uploadBarBg);
    const uploadPct = document.createElement("div");
    uploadPct.style.cssText = "color:#888;font-size:11px;margin-top:6px;";
    uploadOverlay.appendChild(uploadPct);
    playerContainer.appendChild(uploadOverlay);

    const showUploadProgress = (visible, completed, total) => {
        if (visible) {
            uploadOverlay.style.display = "flex";
            if (total > 0) {
                const pct = Math.round((completed / total) * 100);
                uploadTitle.textContent = "上传视频中...";
                uploadBarFill.style.width = pct + "%";
                uploadPct.textContent = `${pct}%`;
            } else {
                uploadTitle.textContent = "准备上传...";
                uploadBarFill.style.width = "0%";
                uploadPct.textContent = "";
            }
        } else {
            uploadOverlay.style.display = "none";
        }
    };

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
    node._mkVideoPlayer = player;

    const uploadBtn = node.addWidget("button", "上传视频", "upload", triggerUpload);
    uploadBtn.options.serialize = false;

    const hintText = document.createElement("div");
    hintText.textContent = _tr("单击视频播放或暂停/双击视频上传");
    hintText.style.cssText = "width:100%;text-align:center;font-size:11px;color:#666;padding:4px 0 2px;";
    playerContainer.appendChild(hintText);

    const previewWidget = node.addDOMWidget(VIDEO_PREVIEW_WIDGET_NAME, "video", playerContainer, {
        hideOnZoom: false,
        getValue() { return ""; },
        setValue(v) {},
    });

    previewWidget.serialize = false;
    if (previewWidget.options) previewWidget.options.serialize = false;
    previewWidget.computeLayoutSize = function () {
        return { minHeight: VIDEO_PREVIEW_MIN_H, minWidth: 0 };
    };

    Object.defineProperty(previewWidget, 'width', {
        configurable: true,
        get() { return node.size?.[0] || 0; },
        set(_) { },
    });

    previewWidget.onRemove = () => {
        player.destroy();
        fileInput.remove();
    };

    const origOnRemoved = node.onRemoved;
    node.onRemoved = function () {
        player.destroy();
        fileInput.remove();
        return origOnRemoved?.apply(this, arguments);
    };

    const origOnConfigure = node.onConfigure;
    node.onConfigure = function (info) {
        origOnConfigure?.apply(this, arguments);
        requestAnimationFrame(() => {
            _applyWidgetStyles(node);
            _updateRatioWidgets(node);
        });
    };

    const origOnExecuted = node.onExecuted;
    node.onExecuted = function (output) {
        origOnExecuted?.apply(this, arguments);
        if (!output || !player) return;

        const ui = output.ui || output;
        const previewList = ui?.video_preview;
        if (Array.isArray(previewList) && previewList.length > 0) {
            const preview = previewList[0];
            const filename = preview?.filename;
            if (filename) {
                const subfolder = preview?.subfolder || "";
                const type = preview?.type || "temp";
                const params = new URLSearchParams({ filename, type, subfolder });
                const url = `/view?${params.toString()}&rand=${Math.random()}`;
                player.load(url);
                node.setDirtyCanvas(true, true);
            }
        }
    };

    fileInput.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files || []).filter(f => isVideoFilename(f.name));
        if (files.length === 0) return;

        const hasLargeFile = files.some(f => f.size > _MK_VIDEO_CHUNK_SIZE);
        if (hasLargeFile) showUploadProgress(true, 0, 0);

        const uploaded = await uploadVideoFiles(files, (completed, total) => {
            showUploadProgress(true, completed, total);
        });

        showUploadProgress(false);

        if (uploaded.length > 0) {
            const videoWidget = node.widgets?.find(w => w.name === "视频");
            if (videoWidget) {
                await refreshVideoCombo(videoWidget, uploaded[0]);
                player.load(getVideoUrl(videoWidget.value));
            }
        }

        fileInput.value = "";
        node.setDirtyCanvas?.(true, true);
    });

    requestAnimationFrame(() => {
        const videoWidget = node.widgets?.find(w => w.name === "视频");
        if (videoWidget) {
            const origCb = videoWidget.callback;
            videoWidget.callback = function (value) {
                origCb?.apply(this, arguments);
                const url = getVideoUrl(value);
                player.load(url || "");
            };
            if (videoWidget.value) {
                player.load(getVideoUrl(videoWidget.value));
            }
        }

        const ratioWidget = node.widgets?.find(w => w.name === "视频比例");
        if (ratioWidget) {
            const origRatioCb = ratioWidget.callback;
            ratioWidget.callback = function (value) {
                origRatioCb?.apply(this, arguments);
                _updateRatioWidgets(node);
            };
        }
        _updateRatioWidgets(node);
    });
}

app.registerExtension({
    name: "mk.video_loader",
    getCustomWidgets() {
        return {
            MKINT: (node, name, data) => _mkCreateNumberWidget(node, name, data),
            MKFLOAT: (node, name, data) => _mkCreateNumberWidget(node, name, data),
            MKCOMBO: (node, name, data) => _mkCreateComboWidget(node, name, data),
        };
    },
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "MKVideoLoader") {
            if (nodeData.input?.required?.["强制帧率"]) {
                nodeData.input.required["强制帧率"][1].widgetType = "MKFLOAT";
            }

            for (const inp of Object.values({ ...nodeData.input?.required, ...nodeData.input?.optional })) {
                if (!inp || !inp[1]) continue;
                if (["INT", "FLOAT"].includes(inp[0])) {
                    inp[1].widgetType ??= "MK" + inp[0];
                } else if (Array.isArray(inp[0])) {
                    inp[1].widgetType ??= "MKCOMBO";
                }
            }

            const correctOutputs = [_tr("图像"), _tr("音频"), _tr("视频信息")];
            if (nodeData.outputs && Array.isArray(nodeData.outputs)) {
                nodeData.outputs.forEach((out, i) => {
                    if (correctOutputs[i]) out.name = correctOutputs[i];
                });
            }
            if (nodeData.output_name && Array.isArray(nodeData.output_name)) {
                nodeData.output_name = nodeData.output_name.slice(0, correctOutputs.length).map((n, i) => correctOutputs[i] || n);
            }

            const origOnNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = origOnNodeCreated?.apply(this, arguments);
                bindVideoLoaderInteractions(this);
                _mkPatchCanvasPrompt();
                _applyWidgetStyles(this);
                if (this.outputs) {
                    this.outputs.forEach((out, i) => {
                        if (correctOutputs[i]) {
                            out.name = correctOutputs[i];
                            out.label = correctOutputs[i];
                        }
                    });
                }
                return r;
            };

            const origOnDrawBackground = nodeType.prototype.onDrawBackground;
            nodeType.prototype.onDrawBackground = function (ctx) {
                if (this._mkVideoPlayer && this._mkUpdateBypassState) {
                    this._mkUpdateBypassState();
                }
                return origOnDrawBackground?.apply(this, arguments);
            };
        }
    },
});
