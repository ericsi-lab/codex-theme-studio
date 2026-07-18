# 安装 Theme Studio for Codex

## 最简单：把仓库链接发给 Codex

在 Codex 新任务中发送：

```text
安装这个主题插件：https://github.com/ericsi-lab/codex-theme-studio
如果尚未配置 Marketplace，请将 ericsi-lab/codex-theme-studio 的 main 分支添加为
Codex Plugin Marketplace，再安装 codex-theme-studio。
不要让我打开终端；需要重启 ChatGPT 时先询问我。
安装后请告诉我：是否成功、启动器在哪里、是否必须打开，以及默认主题是否生效。
```

在允许本地命令、GitHub 访问和插件安装的环境中，Codex 可以读取仓库清单并完成
Marketplace、Plugin、本地运行时和启动器安装；涉及应用重启时仍会先征得同意。这是
代理安装流程，不是 GitHub 链接本身拥有静默安装权限。受管理的工作区可能限制该能力。

## 从 Codex Plugins 手动安装

1. 打开 ChatGPT 桌面端的 Plugins 页面（旧版 Codex.app 也兼容）。
2. 添加本 GitHub 仓库提供的 Marketplace。
3. 找到 **Theme Studio for Codex**，点击安装。
4. 新建一个任务，对 Codex 说“安装主题”。

Skill 会把运行时安装到 `~/.codex/codex-theme-studio/`，把预设复制到 `~/Library/Application Support/CodexThemeStudio/themes/`。不需要管理员权限。

安装结果会反馈 Plugin/运行时是否成功、启动器位置、启动器是否必需、默认主题和下一步。
安装时还会创建 `~/Applications/Theme Studio for Codex.app`。它是可选的一次性启动器，
不是常驻主题应用。首次打开并确认启用后，会自动应用 **万妖图录·龙渊灵姬**；以后打开
会恢复现有主题，不覆盖用户选择或主动恢复的原始界面。用户也可以完全不打开启动器，
继续在 Codex 对话中确认安全重启。

启动器使用项目原创图标。旧版本升级时，安装器只会迁移带有本项目管理标记的
`Codex Theme Studio.app`；不会覆盖或删除无管理标记的同名 App。

用户安装的是 Plugin，不需要再单独安装或理解 Skill。Skill 负责理解自然语言，实际修改由 Plugin 内的确定性 CLI 执行。

## 首次启用本地调试端口

主题引擎只通过本机回环地址工作，并会自动识别新版 `ChatGPT.app` 或旧版 `Codex.app`。如果安全检查提示端口未开启：

1. 保存工作并确认 Skill 显示的“安全重启并启用主题模式”。
2. Skill 自动关闭并重新打开 ChatGPT，只为新进程添加
   `--remote-debugging-address=127.0.0.1` 和本机端口参数。
3. 没有指定其他主题时，首次重开会自动应用“万妖图录·龙渊灵姬”；已指定主题时以用户
   选择为准。

主题模式已启用时，切换主题不需要重启。只有 ChatGPT 之后又从普通图标启动、没有本机
CDP 参数时，才需要再次确认一次安全重启；也可以始终使用
`~/Applications/Theme Studio for Codex.app` 启动。

启动器会自动选择身份匹配的新版 `ChatGPT.app` 或旧版 `Codex.app`，自身不会常驻。
官方桌面应用升级后可以说“检查升级兼容性”；Skill 会验证新构建和页面结构，但不会读取
任务正文、提示词、项目名或用户名。

不要把调试地址设置为 `0.0.0.0`，也不要把端口转发给其他设备。

官方 Codex 升级为 ChatGPT 桌面端属于已识别的迁移路径，不需要用户反复下载应用，也不
需要手工运行签名命令。首次使用和应用升级后，运行时会检查 Bundle ID、OpenAI Team ID、
Apple Developer ID 指定要求，并让 macOS 验证当前运行进程确实有效。静态完整资源封签
保留为诊断项，但不会因为官方更新过程中的瞬时误报阻止首次应用主题。

## 自然语言生成自己的背景

可以直接说：

```text
生成一个东方仙神风、右侧是哪吒的背景
用这张本地图片生成一个深色主题
先预览“赤金财神”30 秒
```

图像生成能力可用时，Skill 会生成原创背景并交给本地导入器做格式、尺寸、像素数和路径校验，再提取焦点、左侧安全区、配色和低强度特效。默认只预览 30 秒，收到确认后才应用。图像能力不可用时，Skill 会请你提供本地 PNG、JPEG 或 WebP。

图片必须小于等于 16 MiB、总像素不超过 12 MP、单边不超过 8192 px；动画图片、符号链接、伪造扩展名和不安全路径会在解码前拒绝。

## 更新和卸载

- “更新主题工具”：更新运行时和内置预设，不覆盖用户主题。
- “恢复默认界面”：立即移除当前主题和演示模式。
- “卸载主题工具”：删除运行时，默认保留用户主题。
- “卸载并删除我的主题”：只有明确确认后才删除用户素材。

Release ZIP 会同时提供 SHA-256 校验值，下载后应先核对再安装。
