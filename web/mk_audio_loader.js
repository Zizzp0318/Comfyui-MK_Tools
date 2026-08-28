import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const AUDIO_EXTS = [
    "mp3", "wav", "ogg", "flac", "aac", "m4a", "wma", "opus",
    "amr", "ac3", "aiff", "au", "mka", "mp2", "ra", "voc", "w64"
];
const AUDIO_WAVEFORM_WIDGET_NAME = "mk_audio_waveform";
const AUDIO_WAVEFORM_H = 120;   // 波形固定高度

// 音频下载
async function mkDownloadAudio(url, filename) {
    try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `mk-audio-${Date.now()}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e) {
        console.warn("[MK-音频加载] 下载失败:", e);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// 通用 widget 绘制函数
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
            let newVal = this.value + event.deltaX * step * 0.1;
            newVal = Math.round(newVal / step) * step;
            this.value = clamp(newVal);
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
    const labelText = this.label || this.name || '';
    ctx.fillText(labelText, pad + 6, y + H / 2);
    const displayText = String(this.value ?? '');
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

function _mkDrawButtonWidget(ctx, node, width, y, H) {
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

// ═══════════════════════════════════════════════════════════════════════
// 波形显示 + 音频播放控件
// ═══════════════════════════════════════════════════════════════════════
class MKWaveformViewer {
    constructor({ node, onRangeChange, onVolumeChange, onRequestRedraw, onUpload }) {
        this._node = node || null;
        this.onRangeChange = onRangeChange;
        this.onVolumeChange = onVolumeChange || (() => {});
        this.onRequestRedraw = onRequestRedraw || (() => {});
        this.onUpload = onUpload || (() => {});
        this.peaks = [];
        this.duration = 0;
        this.startTime = 0;
        this.endTime = 0;
        this.isDragging = false;
        this.dragType = null;
        this.dragStartX = 0;
        this.dragStartTime = 0;
        this.dragEndTime = 0;
        this.isPlaying = false;
        this.playbackTime = 0;
        this._audioUrl = "";
        this._rafId = null;
        this._currentFile = "";
        this._lastClickTime = 0;
        this._clickTimer = null;
        this._dragThreshold = 5;
        this.volume = 1.0;
        this._loopPlayback = false;
        this._loopBtn = null;
        this._lastPlayheadEnd = 0;
        this._displayMode = 'full';
        this._paddingX = 14;
        this._borderW = 4;

        this._drawY = 0;
        this._drawH = 0;
        this._drawW = 0;

        this._decoding = false;
        this._decodeProgress = 0;
        this._decodedTime = 0;
        this._totalDuration = 0;
        this._decodeAnimId = null;

        this._audio = document.createElement("audio");
        this._audio.style.display = "none";
        this._audio.preload = "auto";
        this._audio.crossOrigin = "anonymous";
        document.body.appendChild(this._audio);

        this._audioCtx = null;
        this._gainNode = null;
        this._sourceNode = null;
        this._audioGraphConnected = false;

        this._audio.addEventListener("ended", () => {
            const inPlayheadDrag = this.isDragging && this.dragType === 'playhead';
            const recentlyDragged = this._lastPlayheadEnd && Date.now() - this._lastPlayheadEnd < 300;
            if (this._loopPlayback && !inPlayheadDrag && !recentlyDragged && this.endTime >= this.duration - 0.05) {
                this._audio.currentTime = this.startTime;
                this._audio.play().catch(e => console.warn("[MK-音频加载] 循环播放失败:", e));
            }
        });
        this._audio.addEventListener("play", () => {
            this.isPlaying = true;
            this._updatePlayButton();
            this._startPlaybackAnimation();
        });
        this._audio.addEventListener("pause", () => {
            this.isPlaying = false;
            this._updatePlayButton();
            this._stopPlaybackAnimation();
        });

        this._onMouseMove = (e) => this._handleMouseMove(e);
        this._onMouseUp = (e) => this._handleMouseUp(e);
        window.addEventListener("mousemove", this._onMouseMove);
        window.addEventListener("mouseup", this._onMouseUp);
        window.addEventListener("pointermove", this._onMouseMove);
        window.addEventListener("pointerup", this._onMouseUp);
        window.addEventListener("pointercancel", this._onMouseUp);

        this._contextMenu = document.createElement("div");
        this._contextMenu.style.cssText =
            "position:fixed;display:none;z-index:99999;min-width:150px;" +
            "background:#2a2a2a;border:1px solid #444;border-radius:6px;" +
            "box-shadow:0 4px 12px rgba(0,0,0,0.5);padding:4px 0;pointer-events:auto;";
        const menuItemStyle =
            "padding:6px 16px;color:#ddd;cursor:pointer;font-size:12px;white-space:nowrap;";

        this._contextMenuSave = document.createElement("div");
        this._contextMenuSave.style.cssText = menuItemStyle;
        this._contextMenuSave.innerHTML =
            '<span style="display:inline-block;width:18px;">📥</span> 保存音频';
        this._contextMenuSave.addEventListener("click", (e) => {
            e.stopPropagation();
            this._hideContextMenu();
            this.saveAudio();
        });
        this._contextMenu.addEventListener("mouseleave", () => this._hideContextMenu());
        this._contextMenuSave.addEventListener("mouseenter", () => {
            this._contextMenuSave.style.background = "#3a3a3a";
        });
        this._contextMenuSave.addEventListener("mouseleave", () => {
            this._contextMenuSave.style.background = "";
        });

        this._contextMenu.appendChild(this._contextMenuSave);
        document.body.appendChild(this._contextMenu);

        this._onDocClick = () => this._hideContextMenu();
        this._onDocKeyDown = (e) => { if (e.key === "Escape") this._hideContextMenu(); };
        document.addEventListener("click", this._onDocClick);
        document.addEventListener("keydown", this._onDocKeyDown);
    }

    _showContextMenu(x, y) {
        const menu = this._contextMenu;
        if (!menu) return;
        menu.style.left = x + "px";
        menu.style.top = y + "px";
        menu.style.display = "block";
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + "px";
            if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + "px";
        });
    }

    _hideContextMenu() {
        if (this._contextMenu) this._contextMenu.style.display = "none";
    }

    setAudioUrl(url) {
        if (this._audioUrl === url) return;
        this._audioUrl = url || "";
        this._audio.src = url || "";
        if (url) {
            this._audio.load();
        }
    }

    setFilename(name) {
        this._filename = name || "";
    }

    saveAudio() {
        if (!this._audioUrl || !this._filename) return;
        mkDownloadAudio(this._audioUrl, this._filename);
    }

    setData(peaks, duration) {
        this.peaks = peaks || [];
        this.duration = duration || 0;
        this.startTime = 0;
        this.endTime = this.duration;
        this.playbackTime = this.duration / 2;
        this.volume = 1.0;
        this._applyVolume(1.0);
        if (this.duration > 0 && this._audio && this._audioUrl) {
            const syncCurrentTime = () => {
                try {
                    this._audio.currentTime = this.playbackTime;
                } catch (e) {}
            };
            if (this._audio.readyState >= 1) {
                syncCurrentTime();
            } else {
                const onLoaded = () => {
                    syncCurrentTime();
                    this._audio.removeEventListener("loadedmetadata", onLoaded);
                };
                this._audio.addEventListener("loadedmetadata", onLoaded);
            }
        }
        this._updateTimeDisplay();
        this.onRequestRedraw();
    }

    setRange(startTime, endTime) {
        this.startTime = Math.max(0, startTime || 0);
        this.endTime = Math.min(this.duration, endTime || this.duration);
        if (this.startTime > this.endTime) {
            [this.startTime, this.endTime] = [this.endTime, this.startTime];
        }
        this._updateTimeDisplay();
        this.onRequestRedraw();
    }

    startDecoding(totalDuration) {
        this._decoding = true;
        this._decodeProgress = -1;
        this._decodedTime = 0;
        this._totalDuration = totalDuration || 0;
        this._startDecodeAnim();
    }

    stopDecoding() {
        this._decoding = false;
        this._decodeProgress = 0;
        this._decodedTime = 0;
        this._stopDecodeAnim();
        this.onRequestRedraw();
    }

    updateDecodeProgress(progress, decodedTime, totalDuration) {
        this._decodeProgress = progress;
        this._decodedTime = decodedTime || 0;
        if (totalDuration != null) this._totalDuration = totalDuration;
        this.onRequestRedraw();
    }

    _startDecodeAnim() {
        if (this._decodeAnimId) return;
        const loop = () => {
            if (!this._decoding) return;
            this.onRequestRedraw();
            this._decodeAnimId = requestAnimationFrame(loop);
        };
        this._decodeAnimId = requestAnimationFrame(loop);
    }

    _stopDecodeAnim() {
        if (this._decodeAnimId) {
            cancelAnimationFrame(this._decodeAnimId);
            this._decodeAnimId = null;
        }
    }

    drawProgressBar(ctx, widgetY, widgetW, widgetH) {
        const w = widgetW;
        const h = widgetH;
        const pad = this._getPad();

        ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
        ctx.fillRect(0, widgetY, w, h);

        const maxBarH = Math.min(h * 0.55, 28);
        const minBarH = 3;
        const barW = 3;
        const barGap = 3;
        const usableW = Math.max(40, w - pad * 2);
        const numBars = Math.max(7, Math.floor((usableW + barGap) / (barW + barGap)));
        const totalW = numBars * barW + (numBars - 1) * barGap;
        const startX = pad + (usableW - totalW) / 2;
        const baseY = widgetY + h / 2 + maxBarH / 2 + 2;

        const now = Date.now();
        const progressFactor = this._decodeProgress >= 0 ? this._decodeProgress : 0.5;

        const palette = [
            { dark: '#8B0000', mid: '#FF4444', light: '#FFB3B3' },
            { dark: '#8B4500', mid: '#FF8C00', light: '#FFD9B3' },
            { dark: '#8B6914', mid: '#FFD700', light: '#FFF8DC' },
            { dark: '#006400', mid: '#22C55E', light: '#B3F0C4' },
            { dark: '#006964', mid: '#06B6D4', light: '#B3F0F5' },
            { dark: '#00008B', mid: '#3B82F6', light: '#B3D4FF' },
            { dark: '#4B0082', mid: '#8B5CF6', light: '#D4C4FF' },
        ];

        for (let i = 0; i < numBars; i++) {
            const phase1 = Math.sin(now * 0.006 + i * 0.7) * 0.5 + 0.5;
            const phase2 = Math.sin(now * 0.011 + i * 1.3 + 1.2) * 0.3 + 0.3;
            const phase3 = Math.sin(now * 0.004 + i * 0.4 + 2.5) * 0.2 + 0.2;
            const centerWeight = 1 - Math.abs(i - (numBars - 1) / 2) / ((numBars - 1) / 2) * 0.4;

            let intensity = (phase1 + phase2 + phase3) * centerWeight;
            intensity = intensity * (0.4 + progressFactor * 0.6);
            intensity = Math.max(0, Math.min(1, intensity));

            const barH_i = minBarH + (maxBarH - minBarH) * intensity;
            const x = startX + i * (barW + barGap);
            const y = baseY - barH_i;

            const color = palette[i % palette.length];
            const grad = ctx.createLinearGradient(0, baseY, 0, baseY - maxBarH);
            grad.addColorStop(0, color.dark);
            grad.addColorStop(0.5, color.mid);
            grad.addColorStop(1, color.light);
            ctx.fillStyle = grad;

            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x, y, barW, barH_i, barW / 2);
            } else {
                ctx.rect(x, y, barW, barH_i);
            }
            ctx.fill();
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const textY = baseY + 4;
        if (this._decodeProgress >= 0) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '9px sans-serif';
            ctx.fillText(`解码中... ${Math.round(this._decodeProgress * 100)}%`, w / 2, textY);
        } else {
            ctx.fillStyle = '#FFD700';
            ctx.font = '9px sans-serif';
            ctx.fillText('正在分析音频...', w / 2, textY);
        }

        ctx.fillStyle = '#888';
        ctx.font = '7px sans-serif';
        ctx.textBaseline = 'top';
        const fmt = (t) => {
            if (t >= 60) {
                const m = Math.floor(t / 60);
                const s = Math.floor(t % 60);
                return `${m}:${s.toString().padStart(2, '0')}`;
            }
            return t.toFixed(1) + 's';
        };
        if (this._totalDuration > 0 && this._decodedTime > 0) {
            ctx.fillText(`${fmt(this._decodedTime)} / ${fmt(this._totalDuration)}`, w / 2, textY + 12);
        } else if (this._decodedTime > 0) {
            ctx.fillText(`${fmt(this._decodedTime)}`, w / 2, textY + 12);
        }
    }

    _updateTimeDisplay() {
        this.onRequestRedraw();
    }

    _updatePlayButton() {
        this.onRequestRedraw();
    }

    _ensureAudioGraph() {
        if (this._audioGraphConnected) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            this._audioCtx = new AudioContext();
            this._sourceNode = this._audioCtx.createMediaElementSource(this._audio);
            this._gainNode = this._audioCtx.createGain();
            this._gainNode.gain.value = this.volume;
            this._sourceNode.connect(this._gainNode);
            this._gainNode.connect(this._audioCtx.destination);
            this._audioGraphConnected = true;
            this._audio.volume = 1;
        } catch (e) {
            console.warn("[MK-音频加载] Web Audio 初始化失败，使用原生音量:", e);
            this._audioGraphConnected = false;
        }
    }

    _applyVolume(v) {
        if (this._audioGraphConnected && this._gainNode) {
            this._gainNode.gain.value = v;
        } else if (this._audio) {
            this._audio.volume = Math.min(1, v);
        }
    }

    togglePlay() {
        if (!this._audioUrl || this.duration <= 0) return;
        if (this.isPlaying) {
            this._audio.pause();
            return;
        }
        this._ensureAudioGraph();
        const startPlayback = () => {
            const startTime = this.startTime;
            const endTime = this.endTime;
            const targetTime = this.playbackTime || startTime;
            let t = targetTime;
            if (t < startTime || t >= endTime - 0.05) t = startTime;
            if (Math.abs((this._audio.currentTime || 0) - t) > 0.05) {
                try {
                    this._audio.currentTime = t;
                    this.playbackTime = t;
                } catch (e) {}
            }
            this._audio.play().catch(e => console.warn("[MK-音频加载] 播放失败:", e));
        };
        if (this._audioCtx && this._audioCtx.state === 'suspended') {
            this._audioCtx.resume().then(startPlayback).catch(() => startPlayback());
        } else {
            startPlayback();
        }
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(3.0, v));
        this._applyVolume(this.volume);
        this.onVolumeChange(this.volume);
        this.onRequestRedraw();
    }

    _startPlaybackAnimation() {
        if (this._rafId) return;
        const loop = () => {
            if (!this.isPlaying) return;
            this.playbackTime = this._audio.currentTime;
            if (this._loopPlayback) {
                if (this._audio.currentTime >= this.endTime - 0.02) {
                    this._audio.currentTime = this.startTime;
                    this.playbackTime = this.startTime;
                }
            } else {
                if (this._audio.currentTime >= this.endTime - 0.02) {
                    this.playbackTime = this.endTime;
                    this._audio.pause();
                    this._updateTimeDisplay();
                    this.onRequestRedraw();
                    return;
                }
            }
            this._updateTimeDisplay();
            this.onRequestRedraw();
            this._rafId = requestAnimationFrame(loop);
        };
        this._rafId = requestAnimationFrame(loop);
    }

    _stopPlaybackAnimation() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    _getPad() {
        return Math.min(this._paddingX, Math.max(2, Math.floor(this._drawW / 8)));
    }

    _getTimeFromX(localX) {
        if (this.duration <= 0) return 0;
        const w = this._drawW;
        const pad = this._getPad();
        const usableW = Math.max(1, w - pad * 2);
        const px = localX - pad;
        const cropDur = this.endTime - this.startTime;
        const isCropMode = this._displayMode === 'crop' && cropDur > 0;
        if (isCropMode) {
            const ratio = Math.max(0, Math.min(1, px / usableW));
            return this.startTime + ratio * cropDur;
        }
        return Math.max(0, Math.min(this.duration, (px / usableW) * this.duration));
    }

    _getXFromTime(t) {
        if (this.duration <= 0) return this._getPad();
        const w = this._drawW;
        const pad = this._getPad();
        const usableW = Math.max(1, w - pad * 2);
        const cropDur = this.endTime - this.startTime;
        const isCropMode = this._displayMode === 'crop' && cropDur > 0;
        if (isCropMode) {
            const ratio = Math.max(0, Math.min(1, (t - this.startTime) / cropDur));
            return pad + ratio * usableW;
        }
        return pad + (t / this.duration) * usableW;
    }

    _getVolumeY(widgetY, widgetH) {
        const barPadY = 2;
        const waveH = widgetH - barPadY * 2;
        const v = Math.max(0, Math.min(3.0, this.volume));
        let yRatio;
        if (v <= 1.0) {
            yRatio = 1.0 - v * 0.5;
        } else {
            const t = (v - 1.0) / 2.0;
            yRatio = 0.5 - t * 0.5;
        }
        return widgetY + barPadY + waveH * yRatio;
    }

    _getVolumeFromY(y, widgetY, widgetH) {
        const barPadY = 2;
        const waveH = widgetH - barPadY * 2;
        const yRatio = Math.max(0, Math.min(1, (y - widgetY - barPadY) / waveH));
        if (yRatio >= 0.5) {
            const t = (1.0 - yRatio) / 0.5;
            return Math.max(0, Math.min(1.0, t));
        } else {
            const t = (0.5 - yRatio) / 0.5;
            return Math.max(1.0, Math.min(3.0, 1.0 + t * 2.0));
        }
    }

    drawOnNode(ctx, widgetY, widgetW, widgetH) {
        this._drawY = widgetY;
        const nodeW = this._node?.size?.[0];
        const nodeH = this._node?.size?.[1];
        this._drawW = (nodeW != null && nodeW > 0) ? Math.max(1, Math.min(widgetW, nodeW)) : widgetW;
        this._drawH = (nodeH != null && nodeH > 0) ? Math.max(1, Math.min(widgetH, Math.max(0, nodeH - widgetY))) : widgetH;

        const w = this._drawW;
        const h = this._drawH;
        const pad = this._getPad();
        const usableW = Math.max(1, w - pad * 2);

        const nodeBottom = Math.max(widgetY + h, (this._node?.size?.[1] || widgetY + h + 2));
        const _r = (typeof LiteGraph !== 'undefined' && LiteGraph.ROUND_RADIUS) ? LiteGraph.ROUND_RADIUS : 8;
        const bgRoundedPath = () => {
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(0, widgetY, w, nodeBottom - widgetY, [0, 0, _r, _r]);
            } else {
                ctx.rect(0, widgetY, w, nodeBottom - widgetY);
            }
        };
        ctx.fillStyle = '#000000';
        bgRoundedPath();
        ctx.fill();

        if (pad > 0) {
            ctx.save();
            bgRoundedPath();
            ctx.clip();
            ctx.fillStyle = '#353535';
            const bw = this._borderW || 4;
            ctx.fillRect(0, widgetY, bw, nodeBottom - widgetY);
            ctx.fillRect(w - bw, widgetY, bw, nodeBottom - widgetY);
            ctx.fillRect(0, nodeBottom - 4, w, 4);
            ctx.restore();
        }

        if (this._decoding) {
            this.drawProgressBar(ctx, widgetY, w, h);
            return;
        }

        if (!this.peaks || this.peaks.length === 0) {
            ctx.fillStyle = '#555';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('拖入音频或点击上传', w / 2, widgetY + h / 2);
            return;
        }

        const barPadY = 2;
        const waveH = h - barPadY * 2;
        const waveMid = widgetY + barPadY + waveH / 2;
        const cropDur = this.endTime - this.startTime;
        const isCropMode = this._displayMode === 'crop' && cropDur > 0;

        let startX, endX, playX;
        if (isCropMode) {
            startX = pad;
            endX = w - pad;
            playX = this.playbackTime != null && this.playbackTime >= this.startTime && this.playbackTime <= this.endTime
                ? pad + ((this.playbackTime - this.startTime) / cropDur) * usableW : -1;
        } else {
            startX = this.duration > 0 ? pad + (this.startTime / this.duration) * usableW : pad;
            endX = this.duration > 0 ? pad + (this.endTime / this.duration) * usableW : w - pad;
            playX = this.duration > 0 && this.playbackTime != null && this.playbackTime >= 0
                ? pad + (this.playbackTime / this.duration) * usableW : -1;
        }

        const volScale = this.volume;
        const numBars = this.peaks.length;
        if (isCropMode) {
            const startIdx = Math.floor((this.startTime / this.duration) * numBars);
            const endIdx = Math.ceil((this.endTime / this.duration) * numBars);
            const cropNumBars = Math.max(1, endIdx - startIdx);
            const barWidth = usableW / cropNumBars;
            for (let i = 0; i < cropNumBars; i++) {
                const peakIdx = startIdx + i;
                if (peakIdx < 0 || peakIdx >= numBars) continue;
                const [minVal, maxVal] = this.peaks[peakIdx];
                const x = pad + i * barWidth;
                const bw = Math.max(1, Math.min(barWidth, w - pad - x));
                if (w - pad - x < 1) continue;
                const grad = ctx.createLinearGradient(0, widgetY + barPadY, 0, widgetY + h - barPadY);
                grad.addColorStop(0, '#307960');
                grad.addColorStop(0.5, '#307960');
                grad.addColorStop(1, '#307960');
                ctx.fillStyle = grad;
                const top = waveMid + minVal * (waveH / 2) * volScale;
                const bottom = waveMid + maxVal * (waveH / 2) * volScale;
                const barTop = Math.max(widgetY + barPadY, top);
                const barBottom = Math.min(widgetY + h - barPadY, bottom);
                ctx.fillRect(x, barTop, bw, Math.max(1, barBottom - barTop));
            }
        } else {
            const barWidth = usableW / numBars;
            for (let i = 0; i < numBars; i++) {
                const [minVal, maxVal] = this.peaks[i];
                const x = pad + i * barWidth;
                const bw = Math.max(1, Math.min(barWidth, w - pad - x));
                if (w - pad - x < 1) continue;
                const inRange = x >= startX && x <= endX;
                if (inRange) {
                    const grad = ctx.createLinearGradient(0, widgetY + barPadY, 0, widgetY + h - barPadY);
                    grad.addColorStop(0, '#307960');
                    grad.addColorStop(0.5, '#307960');
                    grad.addColorStop(1, '#307960');
                    ctx.fillStyle = grad;
                } else {
                    ctx.fillStyle = '#444';
                }
                const top = waveMid + minVal * (waveH / 2) * volScale;
                const bottom = waveMid + maxVal * (waveH / 2) * volScale;
                const barTop = Math.max(widgetY + barPadY, top);
                const barBottom = Math.min(widgetY + h - barPadY, bottom);
                ctx.fillRect(x, barTop, bw, Math.max(1, barBottom - barTop));
            }
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(pad, widgetY + barPadY, startX - pad, waveH);
            ctx.fillRect(endX, widgetY + barPadY, w - pad - endX, waveH);
        }

        const volY = this._getVolumeY(widgetY, h);
        const volLineW = 40;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad, volY);
        ctx.lineTo(pad + volLineW, volY);
        ctx.stroke();

        if (this.duration > 0) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX, widgetY);
            ctx.lineTo(startX, widgetY + h);
            ctx.stroke();
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(startX - 4, widgetY);
            ctx.lineTo(startX + 4, widgetY);
            ctx.lineTo(startX, widgetY + 5);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(endX, widgetY);
            ctx.lineTo(endX, widgetY + h);
            ctx.stroke();
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.moveTo(endX - 4, widgetY);
            ctx.lineTo(endX + 4, widgetY);
            ctx.lineTo(endX, widgetY + 5);
            ctx.closePath();
            ctx.fill();

            if (playX >= 0) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(playX, widgetY);
                ctx.lineTo(playX, widgetY + h);
                ctx.stroke();
            }
        }

        const volText = `音量${Math.round(this.volume * 100)}`;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '6px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(volText, pad + 2, widgetY + 3);
        const fmt = (t) => {
            const m = Math.floor(t / 60);
            const s = Math.floor(t % 60);
            return `${m}:${s.toString().padStart(2, '0')}`;
        };
        const curTime = fmt(this.playbackTime || this.startTime);
        const rangeStr = `${fmt(this.startTime)}-${fmt(this.endTime)}`;
        const durLabel = fmt(Math.max(0, this.endTime - this.startTime));
        const timeText = `${curTime} / ${rangeStr} 时长${durLabel}`;
        const volTextW = ctx.measureText(volText).width;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '6px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const timeX = pad + 2 + volTextW + 6;
        ctx.fillText(timeText, timeX, widgetY + 3);
        const timeTextW = ctx.measureText(timeText).width;
        const loopSym = this._loopPlayback ? '⇆' : '→';
        const loopX = timeX + timeTextW + 8;
        ctx.fillStyle = '#FFD700';
        ctx.font = '7px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(loopSym, loopX, widgetY + 2);
        const loopW = ctx.measureText(loopSym).width;
        this._loopBtn = { x: loopX - 3, y: widgetY + 1, w: loopW + 6, h: 10 };
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '5px sans-serif';
        ctx.fillText('单击音频轨道播放/双击音频轨道上传/拖动播放头移动位置', loopX + loopW + 6, widgetY + 4);

        const btnW = 22;
        const btnX = w - pad - btnW - 10;
        const btnY = widgetY + 3;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '6px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(isCropMode ? '细节' : '全览', btnX + btnW, btnY);
        this._modeBtn = { x: btnX, y: btnY, w: btnW, h: 14 };

        const helpIconW = 12;
        const helpIconX = btnX - helpIconW - 4;
        const helpIconY = widgetY + 3;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('📝', helpIconX + helpIconW / 2, helpIconY - 1);
        this._helpBtn = { x: helpIconX, y: helpIconY, w: helpIconW, h: 14 };
    }

    handleMouse(event, localX, localY) {
        if (this.duration <= 0) {
            if (event.type === 'pointerdown' || event.type === 'mousedown') {
                if (event.button === 2 && this._audioUrl) {
                    this._showContextMenu(event.clientX, event.clientY);
                    return true;
                }
                const widgetY = this._drawY;
                const widgetH = this._drawH;
                if (localY >= widgetY && localY <= widgetY + widgetH) {
                    const now = Date.now();
                    const isDoubleClick = (now - this._lastClickTime) < 300;
                    this._lastClickTime = now;
                    if (isDoubleClick) {
                        if (this._clickTimer) {
                            clearTimeout(this._clickTimer);
                            this._clickTimer = null;
                        }
                        this.onUpload();
                    } else {
                        if (this._clickTimer) clearTimeout(this._clickTimer);
                        this._clickTimer = setTimeout(() => {
                            this.onUpload();
                            this._clickTimer = null;
                        }, 250);
                    }
                    return true;
                }
            }
            return false;
        }

        const widgetY = this._drawY;
        const widgetH = this._drawH;

        if (event.type === 'pointerup' || event.type === 'mouseup' || event.type === 'pointercancel') {
            if (this.isDragging) {
                return true;
            }
        }

        if (localY < widgetY || localY > widgetY + widgetH) return false;

        if (event.type === 'pointerdown' || event.type === 'mousedown') {
            const _nd = this._node;
            if (_nd && _nd.size && localX >= _nd.size[0] - 14 && localY >= _nd.size[1] - 14) {
                return false;
            }
            const _bw = this._borderW || 4;
            if (_bw > 0 && (localX < _bw || localX > this._drawW - _bw)) {
                return false;
            }
            const _now = Date.now();
            const _isDoubleClick = (this._lastClickTime && _now - this._lastClickTime < 300);

            const barPadY = 2;
            const waveH = widgetH - barPadY * 2;
            const waveMid = widgetY + barPadY + waveH / 3;
            const lowerHalf = localY >= waveMid;

            if (!_isDoubleClick && !lowerHalf && (this.isDragging || (this._lastPlayheadEnd && _now - this._lastPlayheadEnd < 200))) {
                return true;
            }
            if (event.button === 2) {
                if (this._audioUrl) {
                    this._showContextMenu(event.clientX, event.clientY);
                }
                return true;
            }
            if (this._helpBtn) {
                const btn = this._helpBtn;
                if (localX >= btn.x && localX <= btn.x + btn.w && localY >= btn.y && localY <= btn.y + btn.h) {
                    if (typeof showAudioHelpDialog === 'function') {
                        showAudioHelpDialog();
                    }
                    return true;
                }
            }
            if (this._modeBtn) {
                const btn = this._modeBtn;
                if (localX >= btn.x && localX <= btn.x + btn.w && localY >= btn.y && localY <= btn.y + btn.h) {
                    this._displayMode = this._displayMode === 'crop' ? 'full' : 'crop';
                    this.onRequestRedraw();
                    return true;
                }
            }
            if (this._loopBtn) {
                const btn = this._loopBtn;
                if (localX >= btn.x && localX <= btn.x + btn.w && localY >= btn.y && localY <= btn.y + btn.h) {
                    this._loopPlayback = !this._loopPlayback;
                    this.onRequestRedraw();
                    return true;
                }
            }

            const now = Date.now();
            const isDoubleClick = (now - this._lastClickTime) < 300;
            this._lastClickTime = now;

            const startX = this._getXFromTime(this.startTime);
            const endX = this._getXFromTime(this.endTime);
            const playX = this._getXFromTime(this.playbackTime || 0);

            const volY = this._getVolumeY(widgetY, widgetH);

            const handleWidth = 10;
            const volHandleHeight = 5;
            const volLineW = 40;
            const w = this._drawW;
            const pad = this._getPad();
            let hitHandle = false;
            let hitVolumeInLowerHalf = false;
            const inBorderStrip = localX < pad || localX > w - pad;

            const volLineLeft = pad;
            const volLineRight = pad + volLineW;
            if (Math.abs(localY - volY) <= volHandleHeight && localX >= volLineLeft && localX <= volLineRight) {
                this.dragType = 'volume';
                hitHandle = true;
                hitVolumeInLowerHalf = lowerHalf;
            } else if (Math.abs(localX - startX) <= handleWidth
                || Math.abs(localX - endX) <= handleWidth) {
                this.dragType = Math.abs(localX - startX) <= Math.abs(localX - endX) ? 'start' : 'end';
                hitHandle = true;
            } else if (Math.abs(localX - playX) <= 14) {
                this.dragType = 'playhead';
                hitHandle = true;
            } else {
                if (isDoubleClick) {
                    if (this._clickTimer) {
                        clearTimeout(this._clickTimer);
                        this._clickTimer = null;
                    }
                    this.onUpload();
                    return true;
                }
                this.togglePlay();
                return true;
            }

            if (isDoubleClick) {
                if (this._clickTimer) {
                    clearTimeout(this._clickTimer);
                    this._clickTimer = null;
                }
                if (this.dragType === 'volume') {
                    this.setVolume(1.0);
                } else {
                    this.onUpload();
                }
                return true;
            }

            this.isDragging = true;
            this._dragMoved = false;
            this._dragDirection = null;
            this.dragStartX = event.clientX;
            this.dragStartY = event.clientY;
            this.dragStartTime = this.startTime;
            this.dragEndTime = this.endTime;
            this.dragStartVolume = this.volume;
            this.dragStartVolY = this._getVolumeY(widgetY, widgetH);
            this.dragPlayheadTime = this.playbackTime || 0;
            this._dragStartedInLowerHalf = lowerHalf && !hitVolumeInLowerHalf ? true : (hitVolumeInLowerHalf ? 'volume' : false);
            this._hitPlayheadHandle = hitHandle;
            if (this.dragType === 'playhead') {
                this.dragPlayheadX = localX;
                let t = this._getTimeFromX(localX);
                t = Math.max(this.startTime, Math.min(this.endTime, t));
                t = Math.round(t * 100) / 100;
                this.playbackTime = t;
                try {
                    this._audio.currentTime = t;
                } catch (e) {}
                this._updateTimeDisplay();
                this.onRequestRedraw();
            }

            return true;
        }

        if (event.type === 'pointerup' || event.type === 'mouseup' || event.type === 'pointercancel') {
            if (this.isDragging) {
                return true;
            }
            return false;
        }

        if (event.type === 'pointermove' || event.type === 'mousemove') {
            if (this.isDragging) {
                return true;
            }
        }

        return false;
    }

    _handleMouseMove(e) {
        if (!this.isDragging) return;

        if (e.buttons === 0) {
            this._handleMouseUp(e);
            return;
        }

        const cv = app.canvas;
        const scale = cv?.ds?.scale || 1;

        if (!this._dragMoved) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            if (Math.sqrt(dx * dx + dy * dy) > this._dragThreshold) {
                this._dragMoved = true;
            }
        }

        if (this.dragType === 'volume') {
            if (!this._dragMoved) return;
            const widgetY = this._drawY;
            const widgetH = this._drawH;
            const dy = (e.clientY - this.dragStartY) / scale;
            const currentY = this.dragStartVolY + dy;
            let newVol = this._getVolumeFromY(currentY, widgetY, widgetH);
            newVol = Math.round(newVol * 100) / 100;
            this.setVolume(newVol);
            return;
        }

        if ((this.dragType === 'start' || this.dragType === 'end') && !this._dragMoved) {
            return;
        }

        if (this.dragType === 'playhead') {
            const dx = (e.clientX - this.dragStartX) / scale;
            const newX = this.dragPlayheadX + dx;
            let t = this._getTimeFromX(newX);
            t = Math.max(this.startTime, Math.min(this.endTime, t));
            t = Math.round(t * 100) / 100;
            this.playbackTime = t;
            try {
                this._audio.currentTime = t;
            } catch (e) {}
            this._updateTimeDisplay();
            this.onRequestRedraw();
            return;
        }

        const w = this._drawW;
        const pad = this._getPad();
        const usableW = Math.max(1, w - pad * 2);

        const dx = (e.clientX - this.dragStartX) / scale;
        const dt = (dx / usableW) * this.duration;

        if (this.dragType === 'start') {
            this.startTime = Math.max(0, Math.min(this.endTime - 0.01, this.dragStartTime + dt));
            this.startTime = Math.round(this.startTime * 100) / 100;
        } else if (this.dragType === 'end') {
            this.endTime = Math.min(this.duration, Math.max(this.startTime + 0.01, this.dragEndTime + dt));
            this.endTime = Math.round(this.endTime * 100) / 100;
        }

        this._updateTimeDisplay();
        this.onRequestRedraw();
    }

    _handleMouseUp(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        const wasDragging = this.dragType;
        const startedInLowerHalf = this._dragStartedInLowerHalf;
        const dragMoved = !!this._dragMoved;
        this.dragType = null;
        this._dragMoved = false;
        this._dragDirection = null;
        this._hitPlayheadHandle = false;
        this._dragStartedInLowerHalf = false;
        if (this._clickTimer) {
            clearTimeout(this._clickTimer);
            this._clickTimer = null;
        }
        if (wasDragging === 'playhead') {
            this._lastPlayheadEnd = Date.now();
        }
        if (wasDragging === 'start' || wasDragging === 'end') {
            this._notifyChange();
        }

        if (!dragMoved && startedInLowerHalf) {
            this.togglePlay();
        }
    }

    _notifyChange() {
        if (this.onRangeChange) {
            this.onRangeChange(this.startTime, this.endTime);
        }
    }

    destroy() {
        this._stopPlaybackAnimation();
        this._stopDecodeAnim();
        window.removeEventListener("mousemove", this._onMouseMove);
        window.removeEventListener("mouseup", this._onMouseUp);
        window.removeEventListener("pointermove", this._onMouseMove);
        window.removeEventListener("pointerup", this._onMouseUp);
        window.removeEventListener("pointercancel", this._onMouseUp);
        document.removeEventListener("click", this._onDocClick);
        document.removeEventListener("keydown", this._onDocKeyDown);
        if (this._contextMenu) {
            this._contextMenu.remove();
            this._contextMenu = null;
        }
        this._contextMenuSave = null;
        if (this._audio) {
            this._audio.pause();
            this._audio.src = "";
            this._audio.remove();
        }
        if (this._audioCtx) {
            try { this._audioCtx.close(); } catch (e) {}
            this._audioCtx = null;
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════════
function isAudioFilename(name) {
    if (!name) return false;
    const ext = name.split(".").pop().toLowerCase();
    return AUDIO_EXTS.includes(ext);
}

function getAudioUrl(filename) {
    if (!filename) return "";
    let name = filename;
    let type = "input";
    const suffixes = [" [output]", " [input]", " [temp]"];
    for (const s of suffixes) {
        if (name.endsWith(s)) {
            type = s.trim().slice(1, -1);
            name = name.slice(0, -s.length);
            break;
        }
    }
    const params = new URLSearchParams({ filename: name, type });
    return `/view?${params.toString()}&rand=${Math.random()}`;
}

async function uploadAudioFiles(files) {
    const uploaded = [];
    for (const file of files) {
        try {
            const body = new FormData();
            body.append("image", file);
            body.append("overwrite", "true");
            body.append("type", "input");
            const resp = await api.fetchApi("/upload/image", { method: "POST", body });
            if (resp.status === 200) {
                const data = await resp.json();
                if (data && data.name) {
                    uploaded.push(data.name);
                }
            } else {
                console.warn(`[MK-音频加载] 音频上传失败: ${file.name}, HTTP ${resp.status}`);
            }
        } catch (e) {
            console.warn("[MK-音频加载] 音频上传失败:", e);
        }
    }
    return uploaded;
}

async function refreshAudioCombo(audioWidget, selectName) {
    try {
        const resp = await api.fetchApi("/object_info/MK_AudioLoader");
        if (!resp.ok) return;
        const info = await resp.json();
        const list = info?.MK_AudioLoader?.input?.required?.["音频"]?.[0];
        if (Array.isArray(list)) {
            audioWidget.options.values = list;
            if (selectName && list.includes(selectName)) {
                audioWidget.value = selectName;
            } else if (list.length > 0) {
                audioWidget.value = list[list.length - 1];
            }
            audioWidget.callback?.(audioWidget.value);
        }
    } catch (_) {}
}

async function fetchWaveformData(filename) {
    try {
        const resp = await api.fetchApi(`/mk/audio_waveform?filename=${encodeURIComponent(filename)}`);
        if (!resp.ok) return null;
        return await resp.json();
    } catch (e) {
        console.warn("[MK-音频加载] 获取波形数据失败:", e);
        return null;
    }
}

const _mkWaveformCache = new Map();
const _MK_WAVEFORM_CACHE_MAX = 100;

function _mkWaveformCacheGet(filename) {
    return _mkWaveformCache.get(filename) || null;
}

function _mkWaveformCacheSet(filename, peaks, duration, extra) {
    if (!filename || !peaks || peaks.length === 0) return;
    if (_mkWaveformCache.size >= _MK_WAVEFORM_CACHE_MAX && !_mkWaveformCache.has(filename)) {
        _mkWaveformCache.delete(_mkWaveformCache.keys().next().value);
    }
    _mkWaveformCache.set(filename, {
        peaks,
        duration: duration || 0,
        range: extra?.range || null,
        volume: typeof extra?.volume === 'number' ? extra.volume : 1.0,
    });
}

function _mkWaveformCacheUpdate(filename, patch) {
    if (!filename) return;
    const entry = _mkWaveformCache.get(filename);
    if (!entry) return;
    if (patch?.range) entry.range = { start: patch.range.start, end: patch.range.end };
    if (typeof patch?.volume === 'number') entry.volume = patch.volume;
}

function _mkWaveformCacheInvalidate(plainName) {
    if (!plainName) return;
    for (const key of Array.from(_mkWaveformCache.keys())) {
        if (key === plainName || key.startsWith(`${plainName} [`)) {
            _mkWaveformCache.delete(key);
        }
    }
}

const _MK_MIN_DECODE_ANIM_MS = 300;

async function fetchWaveformWithProgress(filename, onProgress) {
    let result = null;
    try {
        const startResp = await api.fetchApi("/mk/audio_decode_start", {
            method: "POST",
            body: JSON.stringify({ filename }),
            headers: { "Content-Type": "application/json" },
        });
        if (!startResp.ok) {
            return fetchWaveformData(filename);
        }
        const startData = await startResp.json();
        const jobId = startData.job_id;
        const totalDuration = startData.total_duration || 0;

        if (onProgress) onProgress(-1, 0, totalDuration);

        const maxPolls = 6000;
        for (let i = 0; i < maxPolls; i++) {
            await new Promise(r => setTimeout(r, 100));
            const resp = await api.fetchApi(
                `/mk/audio_decode_progress?job_id=${encodeURIComponent(jobId)}`
            );
            if (!resp.ok) {
                console.warn("[MK-音频加载] 轮询解码进度失败:", resp.status);
                return fetchWaveformData(filename);
            }
            const data = await resp.json();

            if (data.error) {
                console.warn("[MK-音频加载] 解码失败:", data.error);
                return fetchWaveformData(filename);
            }

            if (onProgress) {
                onProgress(data.progress, data.decoded_time, data.total_duration);
            }

            if (data.done) {
                result = {
                    peaks: data.peaks || [],
                    duration: data.duration || 0,
                };
                break;
            }
        }

        if (!result) {
            console.warn("[MK-音频加载] 解码轮询超时，回退到普通方式");
            return fetchWaveformData(filename);
        }
    } catch (e) {
        console.warn("[MK-音频加载] 进度解码失败，回退到普通方式:", e);
        return fetchWaveformData(filename);
    }

    return result;
}

function showAudioHelpDialog() {
    const existing = document.querySelector(".mk-audio-help-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "mk-audio-help-overlay";
    overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; font-family: sans-serif;
    `;

    const dialog = document.createElement("div");
    dialog.style.cssText = `
        background: var(--comfy-menu-bg, #1e1e1e); color: #ddd;
        border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        width: 420px; max-width: 90vw; max-height: 80vh;
        display: flex; flex-direction: column;
        border: 1px solid rgba(255,255,255,0.1);
    `;

    dialog.innerHTML = `
        <div style="padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 14px; font-weight: bold; color: #FFD700;">MK-音频加载 · 使用说明</div>
            <button class="mk-audio-help-close" style="background:none; border:none; color:#999; font-size:18px; cursor:pointer; padding:0 4px;">×</button>
        </div>
        <div style="padding: 14px 18px; overflow-y: auto; font-size: 12px; line-height: 1.6;">
            <div style="margin-bottom: 12px;">
                <div style="font-weight: bold; color: #FFD700; margin-bottom: 4px;">📁 添加音频</div>
                <ul style="margin: 0; padding-left: 18px;">
                    <li>点击"上传音频"按钮选择文件</li>
                    <li>双击波形区域上传</li>
                    <li>直接拖拽音频文件到波形区域</li>
                </ul>
            </div>
            <div style="margin-bottom: 12px;">
                <div style="font-weight: bold; color: #FFD700; margin-bottom: 4px;">▶️ 播放控制</div>
                <ul style="margin: 0; padding-left: 18px;">
                    <li>单击任意位置：播放 / 暂停</li>
                    <li>双击：上传音频</li>
                    <li>白色播放头：拖动调整播放进度</li>
                    <li>循环/单次：时间码右侧小符号 ⇆ / → 点击切换</li>
                </ul>
            </div>
            <div style="margin-bottom: 12px;">
                <div style="font-weight: bold; color: #FFD700; margin-bottom: 4px;">🔴🔵 截取范围</div>
                <ul style="margin: 0; padding-left: 18px;">
                    <li>红色线：起始时间（可拖动）</li>
                    <li>蓝色线：结束时间（可拖动）</li>
                    <li>选中区域：绿色波形</li>
                    <li>未选中区域：灰色波形 + 半透明遮罩</li>
                </ul>
            </div>
            <div style="margin-bottom: 12px;">
                <div style="font-weight: bold; color: #FFD700; margin-bottom: 4px;">🔊 音量调节</div>
                <ul style="margin: 0; padding-left: 18px;">
                    <li>白色横线：当前音量线，可上下拖动</li>
                    <li>音量范围：0% ~ 300%</li>
                    <li>双击音量线：重置到 100%</li>
                </ul>
            </div>
            <div style="margin-bottom: 12px;">
                <div style="font-weight: bold; color: #FFD700; margin-bottom: 4px;">👁️ 显示模式</div>
                <ul style="margin: 0; padding-left: 18px;">
                    <li>全览：显示完整音频，截取部分高亮</li>
                    <li>细节：仅显示截取区间，铺满整个波形区</li>
                    <li>点击右上角"全览/细节"文字切换</li>
                </ul>
            </div>
            <div>
                <div style="font-weight: bold; color: #FFD700; margin-bottom: 4px;">💡 小提示</div>
                <ul style="margin: 0; padding-left: 18px;">
                    <li>时长设为 0 表示使用全部音频时长</li>
                    <li>右键波形区域弹出保存菜单</li>
                    <li>支持格式：mp3, wav, ogg, flac, aac, m4a 等</li>
                </ul>
            </div>
        </div>
        <div style="padding: 12px 18px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: flex-end;">
            <button class="mk-audio-help-ok" style="padding: 6px 16px; background: #FFD700; color: #333; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">知道了</button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const close = () => {
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
    };

    dialog.querySelector(".mk-audio-help-close").addEventListener("click", close);
    dialog.querySelector(".mk-audio-help-ok").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
    });

    const onKey = (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
        }
    };
    document.addEventListener("keydown", onKey, true);

    dialog.addEventListener("mousedown", (e) => e.stopPropagation());
    dialog.addEventListener("pointerdown", (e) => e.stopPropagation());
    dialog.addEventListener("click", (e) => e.stopPropagation());
}

function bindAudioLoaderInteractions(node) {
    node.resizable = true;
    node.minWidth = 320;
    node.minHeight = 212;

    const origSetSize = node.setSize;
    node.setSize = function(size) {
        size[0] = Math.max(size[0], this.minWidth || 320);
        size[1] = this._mkFixedH || this.minHeight || 212;
        return origSetSize?.apply(this, arguments);
    };
    node.setSize([320, 212]);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = false;
    fileInput.accept = AUDIO_EXTS.map(e => "." + e).join(",");
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    const triggerUpload = () => {
        app.canvas.node_widget = null;
        fileInput.value = "";
        fileInput.click();
    };

    const uploadBtn = node.addWidget("button", "上传音频", "upload", triggerUpload);
    uploadBtn.options.serialize = false;

    const waveformViewer = new MKWaveformViewer({
        node: node,
        onRangeChange: (start, end) => {
            const startWidget = node.widgets?.find(w => w.name === "起始时间(秒)");
            const durWidget = node.widgets?.find(w => w.name === "时长(秒)");
            if (startWidget) {
                startWidget.value = Math.round(start * 100) / 100;
                startWidget.callback?.(startWidget.value);
            }
            if (durWidget) {
                durWidget.value = Math.round((end - start) * 100) / 100;
                durWidget.callback?.(durWidget.value);
            }
            const audioWidget = node.widgets?.find(w => w.name === "音频");
            if (audioWidget?.value) {
                _mkWaveformCacheUpdate(audioWidget.value, { range: { start, end } });
            }
        },
        onVolumeChange: (vol) => {
            const volWidget = node.widgets?.find(w => w.name === "音量");
            if (volWidget) {
                volWidget.value = Math.round(vol * 100) / 100;
                volWidget.callback?.(volWidget.value);
            }
            const audioWidget = node.widgets?.find(w => w.name === "音频");
            if (audioWidget?.value) {
                _mkWaveformCacheUpdate(audioWidget.value, { volume: vol });
            }
        },
        onRequestRedraw: () => node.setDirtyCanvas?.(true, true),
        onUpload: triggerUpload,
    });
    node._mkWaveformViewer = waveformViewer;

    const waveformWidget = {
        name: AUDIO_WAVEFORM_WIDGET_NAME,
        type: "custom",
        value: "",
        options: { serialize: false },
        _mkDrawW: 0,
        draw: function(ctx, node, width, y, H) {
            this._mkDrawW = width;
            waveformViewer.drawOnNode(ctx, y, width, AUDIO_WAVEFORM_H);
            const targetH = Math.round(y + AUDIO_WAVEFORM_H + 2);
            if (targetH > 60 && Math.abs(node.size[1] - targetH) > 0.5) {
                node._mkFixedH = targetH;
                node.size[1] = targetH;
                node.setDirtyCanvas?.(true, true);
            }
        },
        mouse: function(event, [x, y], node) {
            return waveformViewer.handleMouse(event, x, y);
        },
        computeSize: function(width) {
            return [width, AUDIO_WAVEFORM_H];
        },
        computeLayoutSize: function(width) {
            return { minHeight: AUDIO_WAVEFORM_H, minWidth: 0 };
        },
    };
    node.widgets.push(waveformWidget);

    const canvasEl = app.canvas?.canvas;
    if (canvasEl && !canvasEl._mkAudioDragDrop) {
        canvasEl._mkAudioDragDrop = true;
        function _mkAudioEventToCanvasCoords(ev) {
            const cv = app.canvas;
            if (!cv) return null;
            if (typeof cv.convertEventToCanvasOffset === 'function') {
                try { return cv.convertEventToCanvasOffset(ev); } catch (_) {}
            }
            const rect = canvasEl.getBoundingClientRect();
            const localX = ev.clientX - rect.left;
            const localY = ev.clientY - rect.top;
            const scale = cv.ds?.scale || 1;
            const offset = cv.ds?.offset || [0, 0];
            return [localX / scale - offset[0], localY / scale - offset[1]];
        }
        function _mkAudioGetNodeAt(x, y) {
            const cv = app.canvas;
            if (!cv) return null;
            if (cv.getNodeAtPosition) return cv.getNodeAtPosition(x, y);
            if (cv.getNodeAtPos) return cv.getNodeAtPos(x, y);
            if (cv.graph?.getNodeOnPos) return cv.graph.getNodeOnPos(x, y);
            return null;
        }
        canvasEl.addEventListener('dragover', (e) => {
            const pos = _mkAudioEventToCanvasCoords(e);
            if (!pos) return;
            const nd = _mkAudioGetNodeAt(pos[0], pos[1]);
            if (nd?._mkWaveformViewer) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
        canvasEl.addEventListener('drop', (e) => {
            const pos = _mkAudioEventToCanvasCoords(e);
            if (!pos) return;
            const nd = _mkAudioGetNodeAt(pos[0], pos[1]);
            if (!nd?._mkWaveformViewer) return;
            e.preventDefault();
            e.stopPropagation();
            const files = Array.from(e.dataTransfer?.files || []).filter(f => isAudioFilename(f.name));
            if (files.length === 0) return;
            const dt = new DataTransfer();
            files.forEach(f => dt.items.add(f));
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    let _mkAudioLoadId = 0;

    async function loadWaveformForFile(filename) {
        const loadId = ++_mkAudioLoadId;

        if (!filename) {
            if (loadId !== _mkAudioLoadId) return;
            waveformViewer.stopDecoding();
            waveformViewer.setData([], 0);
            waveformViewer.setAudioUrl("");
            waveformViewer.setFilename("");
            return;
        }

        const audioUrl = getAudioUrl(filename);
        waveformViewer.setAudioUrl(audioUrl);
        let pureName = filename;
        const suffixes = [" [output]", " [input]", " [temp]"];
        for (const s of suffixes) {
            if (pureName.endsWith(s)) {
                pureName = pureName.slice(0, -s.length);
                break;
            }
        }
        waveformViewer.setFilename(pureName);

        const cachedWave = _mkWaveformCacheGet(filename);
        if (cachedWave) {
            waveformViewer.setData(cachedWave.peaks, cachedWave.duration);
            const dur = cachedWave.duration || 0;
            const startWidget = node.widgets?.find(w => w.name === "起始时间(秒)");
            const durWidget = node.widgets?.find(w => w.name === "时长(秒)");
            const volWidget = node.widgets?.find(w => w.name === "音量");
            if (cachedWave.range && dur > 0) {
                let start = Math.max(0, Math.min(dur - 0.01, cachedWave.range.start || 0));
                let end = Math.max(start + 0.01, Math.min(dur, cachedWave.range.end || dur));
                waveformViewer.setRange(start, end);
                if (startWidget) {
                    startWidget.value = Math.round(start * 100) / 100;
                    startWidget._mkMax = Math.max(0, dur - 0.01);
                }
                if (durWidget) {
                    durWidget.value = Math.round((end - start) * 100) / 100;
                    durWidget._mkMax = Math.max(0.01, dur - start);
                }
            } else {
                if (startWidget && dur > 0) startWidget._mkMax = dur - 0.01;
                if (durWidget && dur > 0) durWidget._mkMax = dur;
                if (startWidget) startWidget.value = 0;
                if (durWidget) durWidget.value = 0;
            }
            const vol = (typeof cachedWave.volume === 'number') ? cachedWave.volume : 1.0;
            if (volWidget) volWidget.value = Math.round(vol * 100) / 100;
            if (vol !== 1.0) {
                waveformViewer.setVolume(vol);
            } else {
                waveformViewer._applyVolume(1.0);
            }
            return;
        }

        const animStart = Date.now();
        waveformViewer.startDecoding(0);

        const data = await fetchWaveformWithProgress(filename, (progress, decodedTime, totalDuration) => {
            if (loadId !== _mkAudioLoadId) return;
            waveformViewer.updateDecodeProgress(progress, decodedTime, totalDuration);
        });

        if (loadId !== _mkAudioLoadId) return;

        const elapsed = Date.now() - animStart;
        const remaining = _MK_MIN_DECODE_ANIM_MS - elapsed;
        if (remaining > 0) {
            await new Promise(r => setTimeout(r, remaining));
        }

        if (loadId !== _mkAudioLoadId) return;

        waveformViewer.stopDecoding();

        if (data) {
            waveformViewer.setData(data.peaks, data.duration);
            _syncWidgetsFromViewer();
            _mkWaveformCacheSet(filename, data.peaks, data.duration);
        }
    }

    const _syncWidgetsFromViewer = () => {
        const startWidget = node.widgets?.find(w => w.name === "起始时间(秒)");
        const durWidget = node.widgets?.find(w => w.name === "时长(秒)");
        const volWidget = node.widgets?.find(w => w.name === "音量");
        const duration = waveformViewer.duration || 0;
        if (startWidget && duration > 0) {
            startWidget.value = 0;
            startWidget._mkMax = duration - 0.01;
            startWidget.callback?.(startWidget.value);
        }
        if (durWidget && duration > 0) {
            durWidget.value = 0;
            durWidget._mkMax = duration;
            durWidget.callback?.(durWidget.value);
        }
        if (volWidget) {
            volWidget.value = 1.0;
            volWidget.callback?.(volWidget.value);
        }
    };

    const syncRangeFromWidgets = () => {
        const startWidget = node.widgets?.find(w => w.name === "起始时间(秒)");
        const durWidget = node.widgets?.find(w => w.name === "时长(秒)");
        const startVal = startWidget?.value || 0;
        const durVal = durWidget?.value || 0;
        const duration = waveformViewer.duration || 0;

        const clampedStart = Math.max(0, Math.min(duration > 0 ? duration - 0.01 : Infinity, startVal));
        if (startWidget && clampedStart !== startVal) {
            startWidget.value = Math.round(clampedStart * 100) / 100;
        }

        const maxDur = duration > 0 ? duration - clampedStart : Infinity;
        const clampedDur = durVal === 0 ? maxDur : Math.max(0.01, Math.min(maxDur, durVal || 0));
        if (durWidget && clampedDur !== durVal && durVal !== 0) {
            durWidget.value = Math.round(clampedDur * 100) / 100;
        }

        if (startWidget && duration > 0) {
            startWidget._mkMax = duration - 0.01;
        }
        if (durWidget && duration > 0) {
            durWidget._mkMax = duration - clampedStart;
        }

        const endVal = clampedDur > 0 ? Math.min(duration, clampedStart + clampedDur) : duration;
        waveformViewer.setRange(clampedStart, endVal);
        const audioWidgetForRange = node.widgets?.find(w => w.name === "音频");
        if (audioWidgetForRange?.value && duration > 0) {
            _mkWaveformCacheUpdate(audioWidgetForRange.value, { range: { start: clampedStart, end: endVal } });
        }
    };

    const syncVolumeFromWidget = () => {
        const volWidget = node.widgets?.find(w => w.name === "音量");
        if (volWidget) {
            volWidget.value = 1.0;
            waveformViewer.volume = 1.0;
            waveformViewer._applyVolume(1.0);
        }
    };

    const origOnResize = node.onResize;
    node.onResize = function (size) {
        const r = origOnResize?.apply(this, arguments);
        this.setDirtyCanvas?.(true, true);
        return r;
    };

    const origOnMouseDown = node.onMouseDown;
    node.onMouseDown = function (e, localPos, canvas) {
        const [lx, ly] = localPos;
        const wy = waveformViewer._drawY;
        const wh = waveformViewer._drawH;
        if (wy > 0 && wh > 0 && ly >= wy && ly <= wy + wh) {
            if (e.button === 2) return true;
            const result = waveformViewer.handleMouse(e, lx, ly);
            if (result) return true;
        }
        return origOnMouseDown?.apply(this, arguments);
    };
    const origOnMouseMove = node.onMouseMove;
    node.onMouseMove = function (e, localPos, canvas) {
        const [lx, ly] = localPos;
        const wy = waveformViewer._drawY;
        const wh = waveformViewer._drawH;
        if (wy > 0 && wh > 0 && ly >= wy && ly <= wy + wh) {
            const result = waveformViewer.handleMouse(e, lx, ly);
            if (result) return true;
        }
        return origOnMouseMove?.apply(this, arguments);
    };
    const origOnMouseUp = node.onMouseUp;
    node.onMouseUp = function (e, localPos, canvas) {
        const [lx, ly] = localPos;
        const wy = waveformViewer._drawY;
        const wh = waveformViewer._drawH;
        if (wy > 0 && wh > 0 && ly >= wy && ly <= wy + wh) {
            const result = waveformViewer.handleMouse(e, lx, ly);
            if (result) return true;
        }
        return origOnMouseUp?.apply(this, arguments);
    };

    const origOnRemoved = node.onRemoved;
    node.onRemoved = function () {
        waveformViewer.destroy();
        fileInput.remove();
        return origOnRemoved?.apply(this, arguments);
    };

    const origOnConfigure = node.onConfigure;
    node.onConfigure = function (info) {
        origOnConfigure?.apply(this, arguments);
        requestAnimationFrame(() => {
            _applyAudioWidgetStyles(node);
            syncVolumeFromWidget();
            const w = node.widgets?.find(w => w.name === "音频");
            if (w && w.value) {
                loadWaveformForFile(w.value);
            }
        });
    };

    const origOnExecuted = node.onExecuted;
    node.onExecuted = function (output) {
        origOnExecuted?.apply(this, arguments);
        if (!output) return;
        let audioInfo = null;
        if (output.ui?.audio_info && Array.isArray(output.ui.audio_info)) {
            audioInfo = output.ui.audio_info[0];
        }
        if (audioInfo && audioInfo.full_peaks) {
            waveformViewer.stopDecoding();
            waveformViewer.peaks = audioInfo.full_peaks;
            if (audioInfo.filename) {
                const execStart = audioInfo.start_time || 0;
                const execEnd = execStart + (audioInfo.duration || audioInfo.actual_duration || audioInfo.total_duration || 0);
                _mkWaveformCacheSet(audioInfo.filename, audioInfo.full_peaks,
                    audioInfo.total_duration || audioInfo.duration || 0, {
                        range: { start: execStart, end: execEnd },
                        volume: 1.0,
                    });
            }
            waveformViewer.duration = audioInfo.total_duration;
            const start = audioInfo.start_time || 0;
            const end = start + (audioInfo.duration || audioInfo.actual_duration || audioInfo.total_duration);
            waveformViewer.setRange(start, end);
            waveformViewer.setVolume(1.0);
            const volWidget = node.widgets?.find(w => w.name === "音量");
            if (volWidget) volWidget.value = 1.0;
        }
    };

    fileInput.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files || []).filter(f => isAudioFilename(f.name));
        if (files.length === 0) return;
        const uploaded = await uploadAudioFiles(files);
        if (uploaded.length > 0) {
            uploaded.forEach(name => _mkWaveformCacheInvalidate(name));
            const audioWidget = node.widgets?.find(w => w.name === "音频");
            if (audioWidget) {
                await refreshAudioCombo(audioWidget, uploaded[0]);
                loadWaveformForFile(audioWidget.value);
            }
        }
        fileInput.value = "";
        node.setDirtyCanvas?.(true, true);
    });

    node.onDragOver = function (e) {
        const files = Array.from(e.dataTransfer?.files || []);
        return files.length === 0 || files.some(f => isAudioFilename(f.name));
    };
    const _origOnDragDrop = node.onDragDrop;
    node.onDragDrop = function (e) {
        const files = Array.from(e.dataTransfer?.files || []).filter(f => isAudioFilename(f.name));
        if (files.length > 0) {
            e.preventDefault?.();
            e.stopPropagation?.();
            const dt = new DataTransfer();
            files.forEach(f => dt.items.add(f));
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
        }
        return _origOnDragDrop?.apply(this, arguments);
    };

    requestAnimationFrame(() => {
        node.onResize?.(node.size);

        const audioWidget = node.widgets?.find(w => w.name === "音频");
        if (audioWidget) {
            const origCb = audioWidget.callback;
            audioWidget.callback = function (value) {
                origCb?.apply(this, arguments);
                loadWaveformForFile(value);
            };
            if (audioWidget.value) {
                loadWaveformForFile(audioWidget.value);
            }
        }

        const startWidget = node.widgets?.find(w => w.name === "起始时间(秒)");
        const durWidget = node.widgets?.find(w => w.name === "时长(秒)");

        if (startWidget) {
            const origCb = startWidget.callback;
            startWidget.callback = function (value) {
                origCb?.apply(this, arguments);
                syncRangeFromWidgets();
            };
        }
        if (durWidget) {
            const origCb = durWidget.callback;
            durWidget.callback = function (value) {
                origCb?.apply(this, arguments);
                syncRangeFromWidgets();
            };
        }

        syncRangeFromWidgets();
    });
}

function _applyAudioWidgetStyles(node) {
    for (const w of node.widgets || []) {
        if (!w._mkWidthFixed) {
            w._mkWidthFixed = true;
            try {
                Object.defineProperty(w, 'width', {
                    configurable: true,
                    get() { return node.size?.[0] || 0; },
                    set(_) { },
                });
            } catch (_) {}
        }
        if (w.name === AUDIO_WAVEFORM_WIDGET_NAME) continue;
        if (w.name === '音频') {
            w.draw = _mkDrawComboWidget;
        } else if (w.name === '上传音频') {
            w.draw = _mkDrawButtonWidget;
        } else if (w.name === '起始时间(秒)') {
            w._mkValueColor = '#FF4444';
            w._mkStep = 0.01;
            w.hidden = true;
            w.computeSize = () => [0, 0];
        } else if (w.name === '时长(秒)') {
            w._mkValueColor = '#6699FF';
            w._mkStep = 0.01;
            w.hidden = true;
            w.computeSize = () => [0, 0];
        } else if (w.name === '音量') {
            w._mkValueColor = '#ffffff';
            w._mkStep = 0.01;
            w._mkMin = 0;
            w._mkMax = 3.0;
            w.hidden = true;
            w.computeSize = () => [0, 0];
            w.value = 1.0;
        }
    }
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

function _mkPatchProcessMouseDown(retryCount = 0) {
    const canvasEl = app.canvas?.canvas;
    if (!canvasEl) {
        if (retryCount < 30) {
            setTimeout(() => _mkPatchProcessMouseDown(retryCount + 1), 100);
        }
        return;
    }

    if (window._mkAudioCtxMenuPatched) return;
    window._mkAudioCtxMenuPatched = true;

    window.addEventListener('contextmenu', (e) => {
        const target = e.target;
        if (target !== canvasEl && !canvasEl.contains?.(target)) return;

        const canvas = app.canvas;
        const rect = canvasEl.getBoundingClientRect();

        let x, y;
        if (canvas.convertEventToCanvasCoordinates) {
            try {
                const p = canvas.convertEventToCanvasCoordinates(e);
                if (p) { x = p[0]; y = p[1]; }
            } catch (_) {}
        }
        if (x === undefined || y === undefined) {
            x = (e.clientX - rect.left) / canvas.ds.scale - canvas.ds.offset[0];
            y = (e.clientY - rect.top) / canvas.ds.scale - canvas.ds.offset[1];
        }

        let nd = null;
        if (canvas.getNodeAtPosition) {
            nd = canvas.getNodeAtPosition(x, y);
        } else if (canvas.getNodeAtPos) {
            nd = canvas.getNodeAtPos(x, y);
        } else if (canvas.graph?.getNodeOnPos) {
            nd = canvas.graph.getNodeOnPos(x, y);
        }

        if (nd?._mkWaveformViewer) {
            const viewer = nd._mkWaveformViewer;
            const wy = viewer._drawY;
            const wh = viewer._drawH;
            const nodeLocalY = y - nd.pos[1];
            if (wy > 0 && wh > 0 && nodeLocalY >= wy && nodeLocalY <= wy + wh) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (viewer._audioUrl) {
                    viewer._showContextMenu(e.clientX, e.clientY);
                }
                return false;
            }
        }
    }, true);

    let LGraphCanvas = null;
    try {
        if (typeof LGraphCanvas !== 'undefined' && LGraphCanvas?.prototype) {
            LGraphCanvas = LGraphCanvas;
        }
    } catch (_) {}
    if (!LGraphCanvas) LGraphCanvas = window.LGraphCanvas || null;
    if (!LGraphCanvas && window.LiteGraph?.LGraphCanvas) LGraphCanvas = window.LiteGraph.LGraphCanvas;
    if (!LGraphCanvas && app.canvas?.constructor) LGraphCanvas = app.canvas.constructor;

    if (LGraphCanvas?.prototype?.processMouseDown && !LGraphCanvas.prototype._mkAudioPatched) {
        LGraphCanvas.prototype._mkAudioPatched = true;
        console.log("[MK-音频加载] processMouseDown hook 已安装");
        const origProcessMouseDown = LGraphCanvas.prototype.processMouseDown;
        LGraphCanvas.prototype.processMouseDown = function (e) {
            if (e.button === 2) {
                const cx = e.canvasX ?? e.x ?? 0;
                const cy = e.canvasY ?? e.y ?? 0;
                let nd = null;
                if (this.getNodeAtPosition) nd = this.getNodeAtPosition(cx, cy);
                else if (this.getNodeAtPos) nd = this.getNodeAtPos(cx, cy);
                else if (this.graph?.getNodeOnPos) nd = this.graph.getNodeOnPos(cx, cy);

                if (nd?._mkWaveformViewer) {
                    const viewer = nd._mkWaveformViewer;
                    const wy = viewer._drawY;
                    const wh = viewer._drawH;
                    const localY = cy - nd.pos[1];
                    if (wy > 0 && wh > 0 && localY >= wy && localY <= wy + wh) {
                        e.preventDefault?.();
                        e.stopPropagation?.();
                        if (viewer._audioUrl) {
                            viewer._showContextMenu(e.clientX, e.clientY);
                        }
                        return true;
                    }
                }
            }
            return origProcessMouseDown.apply(this, arguments);
        };
    }

    if (LGraphCanvas?.prototype?.processContextMenu && !LGraphCanvas.prototype._mkAudioCtxPatched) {
        LGraphCanvas.prototype._mkAudioCtxPatched = true;
        console.log("[MK-音频加载] processContextMenu hook 已安装");
        const origProcessContextMenu = LGraphCanvas.prototype.processContextMenu;
        LGraphCanvas.prototype.processContextMenu = function (node, e) {
            if (node?._mkWaveformViewer) {
                const viewer = node._mkWaveformViewer;
                const wy = viewer._drawY;
                const wh = viewer._drawH;
                const cx = e?.canvasX ?? e?.x ?? 0;
                const cy = e?.canvasY ?? e?.y ?? 0;
                const localY = cy - node.pos[1];
                if (wy > 0 && wh > 0 && localY >= wy && localY <= wy + wh) {
                    if (viewer._audioUrl) {
                        viewer._showContextMenu(e?.clientX ?? 0, e?.clientY ?? 0);
                        return;
                    }
                }
            }
            return origProcessContextMenu.apply(this, arguments);
        };
    }
}

app.registerExtension({
    name: "mk.audio_loader",
    setup() {
        _mkPatchProcessMouseDown();
    },
    getCustomWidgets() {
        return {
            MKFLOAT: (node, name, data) => {
                const opts = data[1] || {};
                const w = {
                    name: name,
                    type: 'mk-float',
                    value: opts.default ?? 0,
                    options: {},
                    _mkStep: opts.step || 0.01,
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
            },
        };
    },
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "MK_AudioLoader") {
            for (const inp of Object.values({ ...nodeData.input?.required, ...nodeData.input?.optional })) {
                if (["FLOAT"].includes(inp[0]) && inp[1]) {
                    inp[1].widgetType ??= "MKFLOAT";
                }
            }
            const origOnNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = origOnNodeCreated?.apply(this, arguments);
                bindAudioLoaderInteractions(this);
                _mkPatchCanvasPrompt();
                _applyAudioWidgetStyles(this);
                return r;
            };
        }
    },
});

