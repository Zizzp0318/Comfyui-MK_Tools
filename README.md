# ComfyUI-MK_Tools

从 [LAOGOU-666/Comfyui_LG_Tools](https://github.com/LAOGOU-666/Comfyui_LG_Tools) 提取的图像选择和填充空洞节点，按照 ComfyUI v3 规范重构的模块化插件。

## 节点功能

### 🖼️ 图像选择器 (MK Image Selector)
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

**输入：**
- `images`: 输入图像批次
- `mode`: 工作模式

**输出：**
- `selected_images`: 选中的图像列表
- `selected_indices`: 选中的图像索引（逗号分隔的字符串）

**分类：** `MK_Tools/Image`

### 🔧 填充空洞 (MK Fill Holes)
填充遮罩中的空洞区域，使用 OpenCV 的 floodFill 算法。

**功能特点：**
- 自动检测遮罩内部的空洞
- 使用 floodFill 算法从外部填充
- 批量处理支持
- 保持原始遮罩边界

**输入：**
- `mask`: 输入遮罩 (B, H, W)

**输出：**
- `filled_mask`: 填充后的遮罩 (B, H, W)

**分类：** `MK_Tools/Mask`

## 安装

### 方法 1: 手动安装

1. 将此文件夹复制到 ComfyUI 的 `custom_nodes` 目录：
```bash
cd ComfyUI/custom_nodes/
# 复制整个 Comyui-MK_Tools 文件夹到这里
```

2. 安装依赖：
```bash
cd Comyui-MK_Tools
pip install -r requirements.txt
```

3. 重启 ComfyUI

### 方法 2: Git 克隆

```bash
cd ComfyUI/custom_nodes/
git clone <your-repository-url> Comyui-MK_Tools
cd Comyui-MK_Tools
pip install -r requirements.txt
```

## 项目结构

```
Comyui-MK_Tools/
├── __init__.py                 # 插件入口，注册所有节点
├── nodes/                      # 节点实现目录
│   ├── __init__.py
│   ├── image_selection.py      # 图像选择器节点
│   └── fill_holes.py           # 填充空洞节点
├── web/                        # 前端 JavaScript
│   └── mk_tools.js             # UI 扩展（图像选择器交互）
├── requirements.txt            # Python 依赖
├── package.json                # 包配置信息
└── README.md                   # 本文档
```

## 使用示例

### 图像选择器

1. 在工作流中添加 `MK Image Selector` 节点
2. 连接图像批次输入
3. 选择工作模式：
   - 使用 `always_pause` 进行手动选择
   - 使用 `keep_last_selection` 重复使用上次选择
   - 使用 `passthrough` 自动通过所有图像
4. 运行工作流后，点击图像进行选择
5. 点击"确认选择"按钮继续执行

### 填充空洞

1. 在工作流中添加 `MK Fill Holes` 节点
2. 连接遮罩输入
3. 运行工作流，自动填充遮罩中的空洞
4. 输出填充后的遮罩

## 技术细节

### ComfyUI v3 兼容性

本插件完全遵循 ComfyUI v3 迁移指南：
- ✅ 模块化结构，每个节点独立文件
- ✅ 前端代码独立在 `web/` 目录
- ✅ 正确的 `NODE_CLASS_MAPPINGS` 和 `NODE_DISPLAY_NAME_MAPPINGS`
- ✅ 使用 `WEB_DIRECTORY` 指定 web 资源目录
- ✅ 标准的 `__init__.py` 入口

### 依赖

- **opencv-python** >= 4.5.0 - 用于 floodFill 算法
- **numpy** >= 1.23.0 - 数组处理
- **torch** >= 2.0.0 - ComfyUI 核心依赖

### API 端点

图像选择器节点注册了以下 API 端点：

- `POST /image_selector/select` - 处理用户的图像选择操作

## 原始来源

本插件的节点源自 [LAOGOU-666/Comfyui_LG_Tools](https://github.com/LAOGOU-666/Comfyui_LG_Tools)：

- **图像选择器**: 原 `ImageSelector` 节点（`LG_图像选择器`）
- **填充空洞**: 原 `LG_MaskHoleFiller` 节点（`LG_填充空洞`）

感谢原作者的贡献！本项目对原代码进行了模块化重构以符合 ComfyUI v3 规范。

## 许可证

遵循原项目许可证。

## 更新日志

### v1.0.0 (2024-08-28)
- 从 Comfyui_LG_Tools 提取图像选择和填充空洞节点
- 重构为符合 ComfyUI v3 规范的模块化结构
- 完整的前端交互支持
- 添加完整文档

## 问题反馈

如有问题或建议，请提交 Issue。

## 相关链接

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
- [ComfyUI v3 迁移指南](https://docs.comfy.org/custom-nodes/v3_migration)
- [原始项目: Comfyui_LG_Tools](https://github.com/LAOGOU-666/Comfyui_LG_Tools)
