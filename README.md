# ComfyUI-MK_Tools

精心挑选并优化的 ComfyUI 实用节点集合，按照 ComfyUI v3 规范重构的模块化插件。

## 📦 节点列表

### 🖼️ 图像类

#### MK-图像选择器 (MK Image Selector)
交互式图像选择节点，允许从批量图像中选择特定图像。

**功能特点：**
- 可视化图像网格显示
- 点击选择/取消选择图像
- 三种工作模式：
  - `always_pause`: 每次都暂停等待用户选择
  - `keep_last_selection`: 自动使用上次的选择
  - `passthrough`: 直接通过所有图像
- 显示选中数量和序号
- 支持取消操作

**来源：** [LAOGOU-666/Comfyui_LG_Tools](https://github.com/LAOGOU-666/Comfyui_LG_Tools)

---

#### MK-简易图像对比 (MK Simple Image Compare)
通过滑动对比两张图像的差异。

**功能特点：**
- 滑动条对比模式
- 性能优化，智能重绘
- 支持多图像选择
- 流畅的交互体验

**来源：** [ComfyUI-Danbooru-Gallery](https://github.com/AlekPet/ComfyUI-Danbooru-Gallery)

---

#### MK-图像保存 (MK Save Image)
增强的图像保存节点，支持多种格式和质量设置。

**功能特点：**
- 支持 PNG / JPEG / WEBP 三种格式
- 可调整图像质量 (1-100)
- 可选择是否保存元数据
- 「仅预览」模式：只预览不保存到输出目录
- 自定义文件名前缀

**来源：** [comfyui-zxx-tool](https://github.com/GentlemanHu/ComfyUI-ZXXNodes)

---

### 🎭 遮罩类

#### MK-遮罩填充空洞 (MK Fill Holes)
填充遮罩中的空洞区域，使用 OpenCV 的 floodFill 算法。

**功能特点：**
- 自动检测遮罩内部的空洞
- 使用 floodFill 算法从外部填充
- 批量处理支持
- 保持原始遮罩边界

**来源：** [LAOGOU-666/Comfyui_LG_Tools](https://github.com/LAOGOU-666/Comfyui_LG_Tools)

---

### 🔀 工具类

#### MK-任意切换 (MK Any Switch)
动态类型切换节点，自动检测并适配连接类型。

**功能特点：**
- 动态输入端（最多10个）
- 自动类型检测和适配
- 通过索引选择输出
- 智能添加/移除输入端

**来源：** [rgthree-comfy](https://github.com/rgthree/rgthree-comfy)

---

#### MK-提示词拼接 (MK Prompt Concat)
智能拼接多个提示词。

**功能特点：**
- 动态输入端（最多10个）
- 自定义分隔符
- 自动处理列表/元组类型
- 智能添加/移除输入端

**来源：** [ComfyUI-Easy-Use](https://github.com/yolain/ComfyUI-Easy-Use)

---

### 🎲 随机类

#### MK-随机种子 (MK Seed)
功能完整的随机种子管理节点。

**功能特点：**
- 🎲 每次随机 (-1)
- 🎲 新固定随机
- ♻️ 使用上次排队的种子
- 支持种子递增/递减
- 完整的前端交互

**来源：** [rgthree-comfy](https://github.com/rgthree/rgthree-comfy)

---

### 🔧 加载器类

#### MK-Lora堆加载 (MK Lora Loader Stack)
批量加载多个 Lora 模型。

**功能特点：**
- 5 个 Lora 加载槽
- 每个 Lora 独立强度控制 (-10.0 到 10.0)
- 依次叠加应用
- 智能跳过 None 和强度为 0 的 Lora
- 只输出 MODEL（不包含 CLIP）

**来源：** [rgthree-comfy](https://github.com/rgthree/rgthree-comfy)

---

## 🚀 安装

### 方法 1: ComfyUI Manager（推荐）

在 ComfyUI Manager 中搜索 `MK_Tools` 并安装。

### 方法 2: Git 克隆

```bash
cd ComfyUI/custom_nodes/
git clone https://github.com/Zizzp0318/Comfyui-MK_Tools.git
cd Comfyui-MK_Tools
pip install -r requirements.txt
```

### 方法 3: 手动安装

1. 下载本仓库的 ZIP 文件
2. 解压到 `ComfyUI/custom_nodes/Comyui-MK_Tools`
3. 安装依赖：
```bash
cd ComfyUI/custom_nodes/Comyui-MK_Tools
pip install -r requirements.txt
```

4. 重启 ComfyUI

## 📁 项目结构

```
Comyui-MK_Tools/
├── __init__.py                      # 插件入口
├── nodes/                           # 节点实现
│   ├── image_selection.py           # 图像选择器
│   ├── fill_holes.py                # 填充空洞
│   ├── any_switch.py                # 任意切换
│   ├── seed.py                      # 随机种子
│   ├── lora_loader_stack.py         # Lora堆加载
│   ├── prompt_concat.py             # 提示词拼接
│   ├── simple_image_compare.py      # 简易图像对比
│   └── save_image.py                # 图像保存
├── web/                             # 前端代码
│   ├── mk_tools.js                  # 入口
│   ├── seed.js                      # 随机种子前端
│   ├── any_switch.js                # 任意切换前端
│   ├── prompt_concat.js             # 提示词拼接前端
│   └── simple_image_compare.js      # 图像对比前端
├── requirements.txt                 # Python 依赖
└── README.md                        # 本文档
```

## 💡 使用示例

### 图像选择器工作流
```
图像批次 → MK-图像选择器 → 选中的图像
                ↓
          (交互式选择)
```

### Lora 堆叠工作流
```
模型 → MK-Lora堆加载 → 应用多个Lora的模型
       (lora_01: style.safetensors, 强度: 0.8)
       (lora_02: detail.safetensors, 强度: 0.5)
       (lora_03: lighting.safetensors, 强度: 0.3)
```

### 提示词拼接工作流
```
提示词1 → MK-提示词拼接 → 完整提示词
提示词2 →        ↓
提示词3 →   (分隔符: ", ")
```

### 图像对比工作流
```
图像A → MK-简易图像对比 → (预览对比)
图像B →        ↓
          (鼠标滑动查看差异)
```

## 🔧 技术细节

### ComfyUI v3 兼容性

本插件完全遵循 ComfyUI v3 迁移指南：
- ✅ 模块化结构，每个节点独立文件
- ✅ 前端代码独立在 `web/` 目录
- ✅ 正确的 `NODE_CLASS_MAPPINGS` 和 `NODE_DISPLAY_NAME_MAPPINGS`
- ✅ 使用 `WEB_DIRECTORY` 指定 web 资源目录
- ✅ 标准的 `__init__.py` 入口
- ✅ 完全汉化的界面和参数

### 依赖

- **opencv-python** >= 4.5.0 - 用于遮罩处理
- **numpy** >= 1.23.0 - 数组处理
- **torch** >= 2.0.0 - ComfyUI 核心依赖
- **Pillow** >= 9.0.0 - 图像处理

## 📝 更新日志

### v1.2.0 (2025-01-XX)
- 新增 MK-图像保存节点（支持多格式、质量调整、仅预览模式）
- 新增 MK-简易图像对比节点（滑动对比）
- 优化 MK-任意切换 和 MK-提示词拼接 的动态输入逻辑

### v1.1.0 (2025-01-XX)
- 新增 MK-任意切换节点
- 新增 MK-随机种子节点（完整功能）
- 新增 MK-Lora堆加载节点（5个槽位）
- 新增 MK-提示词拼接节点（动态输入）

### v1.0.0 (2024-08-28)
- 从 Comfyui_LG_Tools 提取图像选择和填充空洞节点
- 重构为符合 ComfyUI v3 规范的模块化结构
- 完整的前端交互支持

## 🙏 致谢

本插件的节点来自以下优秀项目：

- [LAOGOU-666/Comfyui_LG_Tools](https://github.com/LAOGOU-666/Comfyui_LG_Tools) - 图像选择器、填充空洞
- [rgthree/rgthree-comfy](https://github.com/rgthree/rgthree-comfy) - 任意切换、随机种子、Lora堆加载
- [yolain/ComfyUI-Easy-Use](https://github.com/yolain/ComfyUI-Easy-Use) - 提示词拼接
- [AlekPet/ComfyUI-Danbooru-Gallery](https://github.com/AlekPet/ComfyUI-Danbooru-Gallery) - 简易图像对比
- [GentlemanHu/ComfyUI-ZXXNodes](https://github.com/GentlemanHu/ComfyUI-ZXXNodes) - 图像保存

感谢所有原作者的贡献！

## 📄 许可证

MIT License

## 🔗 相关链接

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
- [ComfyUI v3 迁移指南](https://docs.comfy.org/custom-nodes/v3_migration)
- [项目主页](https://github.com/Zizzp0318/Comfyui-MK_Tools)

## 💬 问题反馈

如有问题或建议，请提交 [Issue](https://github.com/Zizzp0318/Comfyui-MK_Tools/issues)。
