"""
MK-音频保存
将 AUDIO tensor 保存为多种格式（MP3/WAV/FLAC），支持质量调节、文件前缀自定义
前端显示波形预览，右键音轨直接保存到桌面
"""

import os
import subprocess
import json
import numpy as np
import torch
import folder_paths
from comfy.utils import ProgressBar

# 添加 PromptServer 路由
from server import PromptServer

# ---------- MK路由安全装饰器 ----------
import asyncio as _mk_asyncio
import functools as _mk_ft
import traceback as _mk_tb
try:
    from aiohttp import web as _mk_web
except Exception:
    import types as _mk_t
    _mk_web = _mk_t.ModuleType('aiohttp.web')
    class _R:
        def __init__(self, *a, **kw): pass
    _mk_web.Response = _R
    _mk_web.json_response = lambda *a, **kw: {'_json': (a, kw)}
    class _HTTPE(Exception): pass
    _mk_web.HTTPException = _HTTPE

def mk_safe_handler(fn):
    def _fmt_resp(exc, status=500):
        tb_s = ''.join(_mk_tb.format_exception(type(exc), exc, exc.__traceback__))
        try:
            return _mk_web.json_response(
                {'error': '%s: %s' % (type(exc).__name__, exc), 'traceback': tb_s},
                status=status,
            )
        except Exception:
            return _mk_web.Response(status=500, text='%s: %s\n\n%s' % (type(exc).__name__, exc, tb_s))
    if _mk_asyncio.iscoroutinefunction(fn):
        @_mk_ft.wraps(fn)
        async def _aw(*a, **kw):
            try:
                return await fn(*a, **kw)
            except _mk_web.HTTPException:
                raise
            except BaseException as e:
                print('[MK路由异常] %s: %s: %s' % (fn.__name__, type(e).__name__, e))
                _mk_tb.print_exc()
                return _fmt_resp(e)
        return _aw
    else:
        @_mk_ft.wraps(fn)
        def _sw(*a, **kw):
            try:
                return fn(*a, **kw)
            except _mk_web.HTTPException:
                raise
            except BaseException as e:
                print('[MK路由异常] %s: %s: %s' % (fn.__name__, type(e).__name__, e))
                _mk_tb.print_exc()
                return _fmt_resp(e)
        return _sw

def _safe_dir(fn_name, fallback_subdir):
    import folder_paths as _fp
    d = getattr(_fp, fn_name)()
    if d:
        os.makedirs(d, exist_ok=True)
        return d
    fallback = os.path.join(getattr(_fp, 'models_dir', os.getcwd()), fallback_subdir)
    os.makedirs(fallback, exist_ok=True)
    print('[MK] folder_paths.%s() 返回 None，兜底使用: %s' % (fn_name, fallback))
    return fallback
# ---------------- END ----------------
from aiohttp import web


ENCODE_ARGS = ['utf-8', 'replace']


def ffmpeg_suitability(path):
    """评估 ffmpeg 的适用性"""
    try:
        version = subprocess.run([path, "-version"], check=True, capture_output=True).stdout.decode(*ENCODE_ARGS)
    except:
        return 0
    score = 0
    simple_criterion = [("libmp3lame", 20), ("flac", 5)]
    for criterion in simple_criterion:
        if version.find(criterion[0]) >= 0:
            score += criterion[1]
    copyright_index = version.find('2000-2')
    if copyright_index >= 0:
        try:
            score += int(version[copyright_index + 5:copyright_index + 9]) // 10
        except:
            pass
    return score


def _get_ffmpeg_path():
    """查找 ffmpeg 路径"""
    import shutil

    if "VHS_FORCE_FFMPEG_PATH" in os.environ:
        return os.environ.get("VHS_FORCE_FFMPEG_PATH")

    ffmpeg_paths = []
    try:
        from imageio_ffmpeg import get_ffmpeg_exe
        ffmpeg_paths.append(get_ffmpeg_exe())
    except:
        pass

    if "VHS_USE_IMAGEIO_FFMPEG" in os.environ and len(ffmpeg_paths) > 0:
        return ffmpeg_paths[-1]

    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg is not None:
        ffmpeg_paths.append(system_ffmpeg)

    if os.path.isfile("ffmpeg"):
        ffmpeg_paths.append(os.path.abspath("ffmpeg"))
    if os.path.isfile("ffmpeg.exe"):
        ffmpeg_paths.append(os.path.abspath("ffmpeg.exe"))

    comfyui_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    ffmpeg_bin = os.path.join(comfyui_dir, "ffmpeg", "bin")
    if os.path.isdir(ffmpeg_bin):
        for exe in ["ffmpeg.exe", "ffmpeg"]:
            p = os.path.join(ffmpeg_bin, exe)
            if os.path.isfile(p):
                ffmpeg_paths.append(p)

    if len(ffmpeg_paths) == 0:
        print("[MK-音频保存] No valid ffmpeg found.")
        return None
    elif len(ffmpeg_paths) == 1:
        return ffmpeg_paths[0]
    else:
        return max(ffmpeg_paths, key=ffmpeg_suitability)


ffmpeg_path = _get_ffmpeg_path()

# 音频格式定义：编码器 + 扩展名 + MIME
AUDIO_FORMATS = {
    "mp3": {"encoder": "libmp3lame", "extension": "mp3", "mime": "audio/mpeg"},
    "wav": {"encoder": "pcm_s16le",   "extension": "wav", "mime": "audio/wav"},
    "flac":{"encoder": "flac",       "extension": "flac","mime": "audio/flac"},
}

WAVEFORM_SAMPLES = 500  # 前端波形显示的采样点数


def generate_waveform_peaks(waveform, num_samples=WAVEFORM_SAMPLES):
    """从完整波形生成降采样的峰值数据用于前端显示"""
    if waveform is None or waveform.numel() == 0:
        return []

    # 取左声道（或混合双声道）
    if waveform.shape[0] >= 2:
        mono = (waveform[0] + waveform[1]) / 2.0
    else:
        mono = waveform[0]

    total_samples = mono.shape[0]
    if total_samples <= num_samples:
        peaks = []
        for i in range(total_samples):
            v = float(mono[i].item())
            peaks.append([v, v])
        return peaks

    samples_per_bin = total_samples / num_samples
    peaks = []
    mono_np = mono.numpy()

    for i in range(num_samples):
        start_idx = int(i * samples_per_bin)
        end_idx = int((i + 1) * samples_per_bin)
        if end_idx > total_samples:
            end_idx = total_samples
        if start_idx >= end_idx:
            peaks.append([0.0, 0.0])
            continue
        chunk = mono_np[start_idx:end_idx]
        peaks.append([float(np.min(chunk)), float(np.max(chunk))])

    return peaks


def save_audio_to_file(waveform, sample_rate, output_path, format_name="mp3", quality=128):
    """使用 FFmpeg 将音频 tensor 保存为指定格式文件

    Args:
        waveform: [batch, channels, samples] float32 tensor，范围 [-1, 1]
        sample_rate: 采样率（如 44100）
        output_path: 输出文件完整路径
        format_name: "mp3" / "wav" / "flac"
        quality: 质量参数。MP3=比特率(kbps)，FLAC/WAV忽略（无损）
    """
    if ffmpeg_path is None:
        raise RuntimeError("FFmpeg not found. Please install FFmpeg.")

    fmt = AUDIO_FORMATS.get(format_name, AUDIO_FORMATS["mp3"])
    encoder = fmt["encoder"]

    # 如果是 3D tensor [batch, channels, samples]，取第一个 batch
    if waveform.dim() == 3:
        waveform = waveform[0]

    # 转为 numpy [channels, samples]
    audio_np = waveform.cpu().numpy()

    # 交错排列 → [samples * channels]
    # ffmpeg -f f32le 期望交错格式：L R L R ...
    audio_interleaved = audio_np.T.flatten()

    # 转为字节流
    audio_bytes = audio_interleaved.astype(np.float32).tobytes()

    # 构建 ffmpeg 命令
    args = [
        ffmpeg_path,
        "-y",  # 覆盖已存在文件
        "-f", "f32le",
        "-ar", str(sample_rate),
        "-ac", str(audio_np.shape[0]),
        "-i", "pipe:0",
    ]

    # 编码器参数
    if encoder == "libmp3lame":
        args += ["-c:a", encoder, "-b:a", f"{quality}k"]
    elif encoder == "flac":
        args += ["-c:a", encoder]
    elif encoder == "pcm_s16le":
        args += ["-c:a", encoder]
    else:
        args += ["-c:a", encoder]

    args.append(output_path)

    try:
        proc = subprocess.run(
            args,
            input=audio_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            timeout=600
        )
        if proc.returncode != 0:
            err = proc.stderr.decode(*ENCODE_ARGS) if proc.stderr else ""
            raise RuntimeError(f"FFmpeg encoding failed (rc={proc.returncode}):\n{err[:500]}")
    except subprocess.TimeoutExpired:
        raise RuntimeError("FFmpeg encoding timed out (>600s)")

    return output_path


class MK_AudioSave:
    """MK-音频保存 - 将 AUDIO tensor 保存为多种格式"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "音频": ("AUDIO",),
                "格式": (["mp3", "wav", "flac"], {"default": "mp3"}),
                "质量": (["320", "192", "128"], {"default": "128"}),
                "文件名前缀": ("STRING", {"default": "mk-audio"}),
            },
            "optional": {
                "模式": (["保存", "预览"], {"default": "保存"}),
                # 音量：仅前端监听预览用，不影响最终文件输出
                "音量": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 3.0, "step": 0.01}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    RETURN_NAMES = ()
    FUNCTION = "save_audio"
    CATEGORY = "MK"
    OUTPUT_NODE = True

    def save_audio(self, 音频, 格式, 质量, 文件名前缀,
                   模式="保存", 音量=1.0, **kwargs):
        if ffmpeg_path is None:
            raise RuntimeError("FFmpeg not found. Please install FFmpeg.")

        waveform = None
        sample_rate = 44100

        try:
            waveform = 音频.get("waveform")
            sample_rate = 音频.get("sample_rate", 44100)
        except Exception:
            pass

        if waveform is None or waveform.numel() == 0:
            raise ValueError("Invalid audio data")

        is_preview = (模式 == "预览")

        # 质量转为 int（无损格式忽略）
        quality_val = int(质量) if str(质量).isdigit() else 128

        # 生成波形峰值数据（保存和预览模式都需要）
        w_for_peaks = waveform.squeeze(0) if waveform.dim() == 3 else waveform
        peaks = generate_waveform_peaks(w_for_peaks)
        actual_duration = w_for_peaks.shape[-1] / sample_rate if w_for_peaks.numel() > 0 else 0.0

        # 扩展名（两种模式都要用）
        ext = AUDIO_FORMATS[格式]["extension"]

        # ── 预览模式：仍编码音频，但保存到 ComfyUI temp 目录（不落盘到 output） ──
        if is_preview:
            import uuid
            temp_dir = _safe_dir('get_temp_directory',   'temp')
            os.makedirs(temp_dir, exist_ok=True)
            random_tag = uuid.uuid4().hex[:12]
            preview_filename = f"mk_preview_{random_tag}.{ext}"
            preview_filepath = os.path.join(temp_dir, preview_filename)
            # 复用同一套 ffmpeg 编码逻辑，输出到 temp
            save_audio_to_file(waveform, sample_rate, preview_filepath, format_name=格式, quality=quality_val)
            return {
                "result": (),
                "ui": {
                    "audio_saved": [{
                        "filename": preview_filename,
                        "subfolder": "",
                        "type": "temp",
                        "format": 格式,
                        "quality": quality_val,
                        "duration": actual_duration,
                        "sample_rate": sample_rate,
                        "peaks": peaks,
                        "preview": True,
                    }],
                },
            }

        # 保存模式：输出到 output 目录
        output_dir = _safe_dir('get_output_directory', 'output')

        # 文件名前缀可含子目录（如 "123123/123123"，或 "a/b/c" 多级嵌套），
        # get_save_image_path 会解析出 subfolder、自动创建父目录并返回文件所在目录，
        # 与视频保存（xzg_video_combine）保持一致。
        # 返回：full_output_folder, filename(前缀), counter, subfolder, filename_prefix
        full_output_folder, filename, _, subfolder, _ = folder_paths.get_save_image_path(
            文件名前缀, output_dir
        )

        # 计算下一个可用计数器（按实际扩展名扫描目标目录，避免 get_save_image_path
        # 基于 .png 的计数与该格式不符）
        import re
        max_counter = 0
        matcher = re.compile(f"{re.escape(filename)}_(\\d+)\\D*\\.{ext}$", re.IGNORECASE)
        try:
            for existing_file in os.listdir(full_output_folder):
                match = matcher.fullmatch(existing_file)
                if match:
                    file_counter = int(match.group(1))
                    if file_counter > max_counter:
                        max_counter = file_counter
        except Exception:
            pass

        counter = max_counter + 1
        filename = f"{filename}_{counter:05d}.{ext}"
        filepath = os.path.join(full_output_folder, filename)

        # 保存文件
        save_audio_to_file(waveform, sample_rate, filepath, format_name=格式, quality=quality_val)

        return {
            "result": (),
            "ui": {
                "audio_saved": [{
                    "filename": filename,
                    "subfolder": subfolder,
                    "type": "output",
                    "format": 格式,
                    "quality": quality_val,
                    "duration": actual_duration,
                    "sample_rate": sample_rate,
                    "peaks": peaks,
                }],
            },
        }


# ═══════════════════════════════════════════════════════════════════════
# API 路由：获取已保存音频的 URL（供前端右键下载用）
# ═══════════════════════════════════════════════════════════════════════

# 防御性：只有 PromptServer 已初始化 instance 时注册路由
if getattr(PromptServer, 'instance', None) is not None:
    @PromptServer.instance.routes.get("/mk/audio_saved_url")
    @mk_safe_handler
    async def get_audio_saved_url(request):
        """根据文件名返回可访问的音频 URL"""
        filename = request.query.get("filename", "")
        subfolder = request.query.get("subfolder", "")
        file_type = request.query.get("type", "output")

        if not filename:
            return web.json_response({"error": "filename required"}, status=400)

        try:
            if file_type == "temp":
                base_dir = _safe_dir('get_temp_directory',   'temp')
            else:
                base_dir = _safe_dir('get_output_directory', 'output')

            full_path = os.path.join(base_dir, subfolder, filename) if subfolder else os.path.join(base_dir, filename)

            if not os.path.isfile(full_path):
                return web.json_response({"error": "file not found"}, status=404)

            # 返回 view URL（ComfyUI 标准）
            url_params = f"?filename={filename}"
            if subfolder:
                url_params += f"&subfolder={subfolder}"
            url_params += f"&type={file_type}"

            return web.json_response({
                "url": f"/view{url_params}",
                "filename": filename,
            })
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)


# 注册节点映射
NODE_CLASS_MAPPINGS = {
    "MK_AudioSave": MK_AudioSave
}
