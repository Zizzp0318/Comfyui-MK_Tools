import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// ═══════════════════════════════════════════════════════════════════════
// MK-视频加载 - 简化版（使用 ComfyUI 默认 UI）
// ═══════════════════════════════════════════════════════════════════════

const VIDEO_EXTS = ["webm", "mp4", "mkv", "gif", "mov", "avi", "flv", "wmv", "m4v", "mpg", "mpeg", "ts"];
const VIDEO_PREVIEW_WIDGET_NAME = "mk_video_preview";
const VIDEO_PREVIEW_MIN_H = 100;

// ═══════════════════════════════════════════════════════════════════════
// 视频上传 - 分片上传逻辑
// ═══════════════════════════════════════════════════════════════════════
const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_VIDEO_SIZE = 1024 * 1024 * 1024; // 1GB
const MAX_CONCURRENT_CHUNKS = 3;
const MAX_RETRIES = 3;

async function _mkUploadChunk(sessionId, chunkIndex, chunkOffset, blob, retryCount = 0) {
    const formData = new FormData();
    formData.append("session_id", sessionId);
    formData.append("chunk_index", String(chunkIndex));
    formData.append("chunk_offset", String(chunkOffset));
    formData.append("chunk", blob);

    try {
        const response = await fetch("/mk/video_upload_chunk", {
            method: "POST",
            body: formData,
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            console.log(`[MK-视频加载] 分片 ${chunkIndex} 上传失败，重试 ${retryCount + 1}/${MAX_RETRIES}:`, error);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return _mkUploadChunk(sessionId, chunkIndex, chunkOffset, blob, retryCount + 1);
        } else {
            throw new Error(`分片 ${chunkIndex} 上传失败: ${error.message}`);
        }
    }
}

async function _mkUploadAllChunks(sessionId, file, onProgress) {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const results = new Array(totalChunks);
    let completedChunks = 0;

    const uploadQueue = [];
    for (let i = 0; i < totalChunks; i++) {
        uploadQueue.push(i);
    }

    const workers = [];
    for (let w = 0; w < MAX_CONCURRENT_CHUNKS; w++) {
        workers.push((async () => {
            while (uploadQueue.length > 0) {
                const chunkIndex = uploadQueue.shift();
                if (chunkIndex === undefined) break;

                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const blob = file.slice(start, end);

                try {
                    const result = await _mkUploadChunk(sessionId, chunkIndex, start, blob);
                    results[chunkIndex] = result;
                    completedChunks++;
                    if (onProgress) {
                        onProgress(completedChunks, totalChunks);
                    }
                } catch (error) {
                    throw new Error(`分片 ${chunkIndex} 上传失败: ${error.message}`);
                }
            }
        })());
    }

    await Promise.all(workers);
    return results;
}

async function uploadVideoFile(file, onProgress) {
    if (file.size > MAX_VIDEO_SIZE) {
        throw new Error(`视频文件大小超过限制 (${(MAX_VIDEO_SIZE / (1024 * 1024 * 1024)).toFixed(1)}GB)`);
    }

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const startResponse = await fetch("/mk/video_upload_start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            filename: file.name,
            total_size: file.size,
            total_chunks: totalChunks,
        }),
    });

    if (!startResponse.ok) {
        throw new Error(`开始上传失败: ${startResponse.status}`);
    }

    const startData = await startResponse.json();
    const sessionId = startData.session_id;

    await _mkUploadAllChunks(sessionId, file, onProgress);

    const statusResponse = await fetch(`/mk/video_upload_status?session_id=${sessionId}`);
    if (!statusResponse.ok) {
        throw new Error(`检查上传状态失败: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    if (!statusData.done) {
        throw new Error("上传未完成");
    }

    return statusData.filename;
}

// ═══════════════════════════════════════════════════════════════════════
// 简单视频播放器
// ═══════════════════════════════════════════════════════════════════════
function createSimpleVideoPlayer(container) {
    const videoEl = document.createElement('video');
    videoEl.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;';
    videoEl.controls = true;
    videoEl.loop = true;
    container.appendChild(videoEl);

    return {
        _destroyed: false,
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
        destroy() {
            this._destroyed = true;
            videoEl.remove();
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════
// 节点扩展
// ═══════════════════════════════════════════════════════════════════════
app.registerExtension({
    name: "mk.video_loader",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData?.name !== "MKVideoLoader") return;

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnNodeCreated?.apply(this, arguments);

            const node = this;

            // 创建视频播放器容器
            const playerContainer = document.createElement("div");
            playerContainer.style.cssText = "width:100%;background:#1a1a1a;position:relative;";

            // Bypass 遮罩
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

            // 设置节点大小
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

            // 添加视频预览 widget
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
                        if (!v) {
                            player.load("");
                            return;
                        }
                        if (typeof v === "string") {
                            if (v !== player.getSrc()) {
                                player.load(v);
                            }
                            return;
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

            // 监听视频 widget 变化
            const videoWidget = node.widgets?.find(w => w.name === '视频');
            if (videoWidget) {
                const origCallback = videoWidget.callback;
                videoWidget.callback = function(value) {
                    if (origCallback) {
                        origCallback.call(this, value);
                    }
                    if (value && typeof value === 'string') {
                        const url = `/view?filename=${encodeURIComponent(value)}&type=input`;
                        player.load(url);
                    } else {
                        player.load("");
                    }
                };

                // 初始加载
                if (videoWidget.value) {
                    const url = `/view?filename=${encodeURIComponent(videoWidget.value)}&type=input`;
                    player.load(url);
                }
            }

            // 找到"帧数上限" widget 的索引，在其后插入上传按钮
            const maxFramesIndex = node.widgets?.findIndex(w => w.name === '帧数上限');
            const uploadButtonIndex = maxFramesIndex >= 0 ? maxFramesIndex + 1 : node.widgets?.length || 0;

            // 添加上传视频按钮
            const uploadButton = {
                type: "button",
                name: "上传视频",
                callback: () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = VIDEO_EXTS.map(ext => `.${ext}`).join(',');
                    input.style.display = 'none';
                    document.body.appendChild(input);

                    input.onchange = async () => {
                        const file = input.files?.[0];
                        if (!file) return;

                        try {
                            const videoPath = await uploadVideoFile(file, (completed, total) => {
                                console.log(`[MK-视频加载] 上传进度: ${completed}/${total}`);
                            });

                            // 确保视频格式兼容浏览器（转码为 H.264）
                            let finalPath = videoPath;
                            try {
                                const h264Response = await fetch("/mk/video_ensure_h264", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        filename: videoPath,
                                        type: "input",
                                        subfolder: "",
                                        force: false,
                                    }),
                                });

                                if (h264Response.ok) {
                                    const h264Data = await h264Response.json();
                                    if (h264Data.transcoded && h264Data.filename) {
                                        finalPath = h264Data.filename;
                                        console.log(`[MK-视频加载] 视频已转码为 H.264: ${finalPath}`);
                                    }
                                }
                            } catch (error) {
                                console.warn('[MK-视频加载] 视频格式检查失败，使用原始文件:', error);
                            }

                            const videoWidget = node.widgets?.find(w => w.name === '视频');
                            if (videoWidget) {
                                videoWidget.value = finalPath;
                                if (videoWidget.callback) {
                                    videoWidget.callback(finalPath);
                                }
                            }

                            // 构建正确的视频URL，处理子文件夹路径
                            let url;
                            if (finalPath.includes('/')) {
                                // 如果路径包含子文件夹（如 mk-h264/xxx.mp4），需要特殊处理
                                const parts = finalPath.split('/');
                                const subfolder = parts.slice(0, -1).join('/');
                                const filename = parts[parts.length - 1];
                                url = `/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=input`;
                            } else {
                                url = `/view?filename=${encodeURIComponent(finalPath)}&type=input`;
                            }
                            player.load(url);

                            node.setDirtyCanvas?.(true, true);
                        } catch (error) {
                            console.error('[MK-视频加载] 上传失败:', error);
                            alert(`上传失败: ${error.message}`);
                        } finally {
                            input.remove();
                        }
                    };

                    input.click();
                },
                serialize: false,
            };

            // 插入到指定位置
            if (node.widgets) {
                node.widgets.splice(uploadButtonIndex, 0, uploadButton);
            } else {
                node.widgets = [uploadButton];
            }

            const origOnRemoved = node.onRemoved;
            node.onRemoved = function () {
                player.destroy();
                return origOnRemoved?.apply(this, arguments);
            };

            const origOnConfigure = node.onConfigure;
            node.onConfigure = function (info) {
                origOnConfigure?.apply(this, arguments);
                requestAnimationFrame(() => {
                    if (player._destroyed) return;
                    const videoWidget = node.widgets?.find(w => w.name === '视频');
                    if (videoWidget?.value) {
                        const url = `/view?filename=${encodeURIComponent(videoWidget.value)}&type=input`;
                        player.load(url);
                    }
                });
            };

            node._mkVideoPlayer = player;
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
