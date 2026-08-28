/**
 * MK-音频保存 前端
 * 显示音频波形、支持右键保存、自定义控件拖拽调节
 */

import { app } from '../../scripts/app.js';
import { api } from '../../scripts/api.js';

const AUDIO_SAVE_WAVEFORM_WIDGET_NAME = "mk_audio_save_waveform";
const AUDIO_SAVE_WAVEFORM_H = 100;

// ============================================================================
// 通用拖拽调节函数（可用于数字、下拉框等）
// ============================================================================

/**
 * 为数字 widget 添加拖拽调节功能
 * @param {Object} widget - ComfyUI widget 对象
 * @param {HTMLElement} node - 节点 DOM 元素
 */
function addDragToNumberWidget(widget, node) {
    if (!widget || !widget.element) return;

    const input = widget.element;
    let isDragging = false;
    let startX = 0;
    let startValue = 0;

    const min = widget.options?.min ?? -Infinity;
    const max = widget.options?.max ?? Infinity;
    const step = widget.options?.step ?? 1;

    const onMouseDown = (e) => {
        // 只拖拽 Shift + 左键
        if (!e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        isDragging = true;
        startX = e.clientX;
        startValue = parseFloat(widget.value) || 0;

        input.style.cursor = 'ew-resize';
        document.body.style.cursor = 'ew-resize';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();

        const dx = e.clientX - startX;
        const delta = dx * step;
        let newValue = startValue + delta;

        newValue = Math.max(min, Math.min(max, newValue));
        widget.value = newValue;
        input.value = newValue;

        if (widget.callback) {
            widget.callback(newValue);
        }
    };

    const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;

        input.style.cursor = '';
        document.body.style.cursor = '';

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    input.addEventListener('mousedown', onMouseDown);
}

/**
 * 为 Combo (下拉框) widget 添加鼠标滚轮切换功能
 * @param {Object} widget - ComfyUI widget 对象
 */
function addWheelToComboWidget(widget) {
    if (!widget || !widget.element) return;

    const select = widget.element;
    const options = widget.options?.values || [];
    if (options.length === 0) return;

    select.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const currentIndex = options.indexOf(widget.value);
        let newIndex = currentIndex;

        if (e.deltaY < 0) {
            // 向上滚动 → 上一个选项
            newIndex = Math.max(0, currentIndex - 1);
        } else if (e.deltaY > 0) {
            // 向下滚动 → 下一个选项
            newIndex = Math.min(options.length - 1, currentIndex + 1);
        }

        if (newIndex !== currentIndex) {
            widget.value = options[newIndex];
            select.value = options[newIndex];
            if (widget.callback) {
                widget.callback(options[newIndex]);
            }
        }
    });
}

// ============================================================================
// MK 音频保存波形查看器
// ============================================================================

class MKAudioSaveWaveformViewer {
    constructor(node) {
        this.node = node;
        this.peaks = [];
        this.duration = 0;
        this.sampleRate = 44100;
        this.format = 'mp3';
        this.quality = 128;
        this.audioUrl = null;
        this.filename = null;
        this.subfolder = '';
        this.type = 'output';
        this.isPreview = false;

        this.audioElement = null;
        this.isPlaying = false;

        this._drawW = 0;
        this._paddingX = 8;
    }

    async updateAudio(savedData) {
        if (!savedData || !savedData.peaks) return;

        this.peaks = savedData.peaks || [];
        this.duration = savedData.duration || 0;
        this.sampleRate = savedData.sample_rate || 44100;
        this.format = savedData.format || 'mp3';
        this.quality = savedData.quality || 128;
        this.filename = savedData.filename || '';
        this.subfolder = savedData.subfolder || '';
        this.type = savedData.type || 'output';
        this.isPreview = savedData.preview || false;

        // 获取音频 URL
        await this.fetchAudioUrl();
    }

    async fetchAudioUrl() {
        if (!this.filename) return;

        try {
            const params = new URLSearchParams({
                filename: this.filename,
                subfolder: this.subfolder,
                type: this.type,
            });

            const response = await fetch(`/mk/audio_saved_url?${params}`);
            if (!response.ok) {
                console.error('[MK-音频保存] Failed to fetch audio URL:', response.statusText);
                return;
            }

            const data = await response.json();
            this.audioUrl = data.url;

            // 创建 audio 元素
            if (this.audioElement) {
                this.audioElement.pause();
                this.audioElement.src = '';
            }

            this.audioElement = new Audio(this.audioUrl);
            this.audioElement.addEventListener('ended', () => {
                this.isPlaying = false;
                this.node.setDirtyCanvas?.(true, true);
            });
            this.audioElement.addEventListener('timeupdate', () => {
                this.node.setDirtyCanvas?.(true, true);
            });

        } catch (err) {
            console.error('[MK-音频保存] Error fetching audio URL:', err);
        }
    }

    drawOnNode(ctx, y, width, height) {
        this._drawW = width;
        const pad = this._paddingX;
        const usableW = Math.max(1, width - pad * 2);
        const usableH = height - 16;

        // 绘制背景
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(pad, y, usableW, height);

        // 绘制边框
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.strokeRect(pad, y, usableW, height);

        const peaks = this.peaks;
        const numSamples = peaks.length;

        if (numSamples === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('无波形数据', width / 2, y + height / 2);
            return;
        }

        const midY = y + height / 2;
        const barWidth = usableW / numSamples;

        // 绘制波形
        ctx.fillStyle = '#4CAF50';
        for (let i = 0; i < numSamples; i++) {
            const [min, max] = peaks[i];
            const minY = midY - min * (usableH / 2);
            const maxY = midY - max * (usableH / 2);
            const barHeight = Math.abs(maxY - minY);
            const x = pad + i * barWidth;

            ctx.fillRect(x, Math.min(minY, maxY), Math.max(1, barWidth), Math.max(1, barHeight));
        }

        // 绘制播放进度指示
        if (this.audioElement && this.isPlaying && this.duration > 0) {
            const currentTime = this.audioElement.currentTime;
            const progress = currentTime / this.duration;
            const playheadX = pad + progress * usableW;

            ctx.strokeStyle = '#FF5722';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(playheadX, y);
            ctx.lineTo(playheadX, y + height);
            ctx.stroke();
        }

        // 绘制文件信息
        ctx.fillStyle = '#999';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const infoText = `${this.format.toUpperCase()} | ${this.quality}kbps | ${this.duration.toFixed(2)}s | ${this.sampleRate}Hz${this.isPreview ? ' [预览]' : ''}`;
        ctx.fillText(infoText, pad + 4, y + height - 2);
    }

    handleMouse(event, x, y) {
        const pad = this._paddingX;
        const usableW = Math.max(1, this._drawW - pad * 2);

        if (x < pad || x > pad + usableW) {
            return false;
        }

        if (event.type === 'pointerdown') {
            if (event.button === 0) {
                // 左键：播放/暂停
                this.togglePlayPause();
                return true;
            } else if (event.button === 2) {
                // 右键：下载
                event.preventDefault();
                this.downloadAudio();
                return true;
            }
        }

        return false;
    }

    togglePlayPause() {
        if (!this.audioElement || !this.audioUrl) return;

        if (this.isPlaying) {
            this.audioElement.pause();
            this.isPlaying = false;
        } else {
            this.audioElement.play();
            this.isPlaying = true;
        }

        this.node.setDirtyCanvas?.(true, true);
    }

    async downloadAudio() {
        if (!this.audioUrl || !this.filename) {
            console.warn('[MK-音频保存] No audio to download');
            return;
        }

        try {
            // 方案1：使用 File System Access API（现代浏览器）
            if (window.showSaveFilePicker) {
                const ext = this.format || 'mp3';
                const handle = await window.showSaveFilePicker({
                    suggestedName: this.filename,
                    types: [{
                        description: `${ext.toUpperCase()} Audio`,
                        accept: { [`audio/${ext}`]: [`.${ext}`] },
                    }],
                });

                const response = await fetch(this.audioUrl);
                const blob = await response.blob();
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();

                console.log('[MK-音频保存] Audio saved to:', this.filename);
            } else {
                // 方案2：传统 <a> 标签下载（兜底）
                const a = document.createElement('a');
                a.href = this.audioUrl;
                a.download = this.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                console.log('[MK-音频保存] Audio download triggered:', this.filename);
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('[MK-音频保存] User cancelled save dialog');
            } else {
                console.error('[MK-音频保存] Error downloading audio:', err);
            }
        }
    }

    destroy() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
            this.audioElement = null;
        }
    }
}

// ============================================================================
// 节点扩展：MK-音频保存
// ============================================================================

app.registerExtension({
    name: 'MK.AudioSave',

    async nodeCreated(node) {
        if (node.comfyClass !== 'MK_AudioSave') return;

        // 创建波形查看器
        const waveformViewer = new MKAudioSaveWaveformViewer(node);
        node._mkAudioSaveViewer = waveformViewer;

        // 创建 custom widget
        const waveformWidget = {
            name: AUDIO_SAVE_WAVEFORM_WIDGET_NAME,
            type: "custom",
            value: "",
            options: { serialize: false },
            _mkDrawW: 0,
            draw: function(ctx, node, width, y, H) {
                this._mkDrawW = width;
                waveformViewer.drawOnNode(ctx, y, width, AUDIO_SAVE_WAVEFORM_H);
                const targetH = Math.round(y + AUDIO_SAVE_WAVEFORM_H + 2);
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
                return [width, AUDIO_SAVE_WAVEFORM_H];
            },
        };
        node.widgets.push(waveformWidget);

        // 清理
        const onRemoved = node.onRemoved;
        node.onRemoved = function () {
            if (this._mkAudioSaveViewer) {
                this._mkAudioSaveViewer.destroy();
                this._mkAudioSaveViewer = null;
            }
            if (onRemoved) onRemoved.apply(this, arguments);
        };

        // 监听执行结果
        const onExecuted = node.onExecuted;
        node.onExecuted = async function (message) {
            if (onExecuted) onExecuted.apply(this, arguments);

            if (message?.audio_saved && message.audio_saved.length > 0) {
                const savedData = message.audio_saved[0];
                if (this._mkAudioSaveViewer) {
                    await this._mkAudioSaveViewer.updateAudio(savedData);
                    this.setDirtyCanvas?.(true, true);
                }
            }
        };

        // 为数字 widgets 添加拖拽功能
        setTimeout(() => {
            if (node.widgets) {
                node.widgets.forEach((w) => {
                    if (w.type === 'number') {
                        addDragToNumberWidget(w, node);
                    } else if (w.type === 'combo') {
                        addWheelToComboWidget(w);
                    }
                });
            }
        }, 100);

        // 添加右键菜单：发送到音频加载器
        const getExtraMenuOptions = node.getExtraMenuOptions;
        node.getExtraMenuOptions = function (_, options) {
            if (getExtraMenuOptions) {
                getExtraMenuOptions.apply(this, arguments);
            }

            if (this._mkAudioSaveViewer?.audioUrl && this._mkAudioSaveViewer?.filename) {
                options.unshift({
                    content: '📤 发送到音频加载器',
                    callback: () => {
                        this.sendToAudioLoader();
                    },
                });

                options.unshift({
                    content: '💾 保存到桌面',
                    callback: () => {
                        if (this._mkAudioSaveViewer) {
                            this._mkAudioSaveViewer.downloadAudio();
                        }
                    },
                });
            }
        };

        // 发送到音频加载器
        node.sendToAudioLoader = function () {
            const viewer = this._mkAudioSaveViewer;
            if (!viewer || !viewer.filename) {
                console.warn('[MK-音频保存] No audio to send');
                return;
            }

            try {
                // 查找画布中的 MK-音频加载 节点
                const loaderNodes = app.graph._nodes.filter(n => n.type === 'MK_AudioLoader');

                if (loaderNodes.length === 0) {
                    // 没有加载器 → 创建一个新的
                    const loaderNode = LiteGraph.createNode('MK_AudioLoader');
                    if (!loaderNode) {
                        console.error('[MK-音频保存] Failed to create MK_AudioLoader node');
                        return;
                    }

                    // 放置在当前节点右侧
                    loaderNode.pos = [this.pos[0] + this.size[0] + 50, this.pos[1]];
                    app.graph.add(loaderNode);

                    // 设置文件名
                    const fileWidget = loaderNode.widgets?.find(w => w.name === '文件名');
                    if (fileWidget) {
                        // 构造完整路径：subfolder/filename
                        const fullPath = viewer.subfolder ? `${viewer.subfolder}/${viewer.filename}` : viewer.filename;
                        fileWidget.value = fullPath;
                        if (fileWidget.callback) {
                            fileWidget.callback(fullPath);
                        }
                    }

                    console.log('[MK-音频保存] Created new MK-音频加载 node with file:', viewer.filename);
                } else {
                    // 使用第一个找到的加载器
                    const targetLoader = loaderNodes[0];
                    const fileWidget = targetLoader.widgets?.find(w => w.name === '文件名');
                    if (fileWidget) {
                        const fullPath = viewer.subfolder ? `${viewer.subfolder}/${viewer.filename}` : viewer.filename;
                        fileWidget.value = fullPath;
                        if (fileWidget.callback) {
                            fileWidget.callback(fullPath);
                        }
                    }

                    console.log('[MK-音频保存] Sent to existing MK-音频加载 node:', viewer.filename);
                }
            } catch (err) {
                console.error('[MK-音频保存] Error sending to audio loader:', err);
            }
        };
    },
});
