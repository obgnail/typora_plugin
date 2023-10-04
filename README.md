# Typora Plugin

<div align="center">
  <img src="assets/typora_plugin.png" alt="typora_plugin" width="400" />
</div>

目前支持的功能：

| 序号 | 文件名                     | 功能                                 |
| ---- | -------------------------- | ------------------------------------ |
| 1    | window_tab                 | 标签页管理                           |
| 2    | search_multi               | 全局多关键字搜索                     |
| 3    | multi_highlighter          | 多关键字高亮                         |
| 4    | collapse_paragraph         | 章节折叠                             |
| 5    | md_padding                 | 中英文混排优化                       |
| 6    | templater                  | 文件模板                             |
| 7    | resource_operation         | 一键清除无用图片，生成报告           |
| 8    | fence_enhance              | 一键复制代码，折叠代码               |
| 9    | commander                  | 命令行环境                           |
| 10   | mindmap                    | 根据文档大纲一键生成思维导图         |
| 11   | toolbar                    | 多功能搜索栏                         |
| 12   | markmap                    | 提供 markmap 组件支持                |
| 13   | echarts                    | 提供 echarts 组件支持                |
| 14   | chart                      | 提供 chartjs 组件支持                |
| 15   | callouts                   | 提供 callouts 支持                   |
| 16   | read_only                  | 只读模式                             |
| 17   | blur                       | 模糊模式                             |
| 18   | kanban                     | 看板                                 |
| 19   | timeline                   | 时间线                               |
| 20   | file_counter               | 显示目录下的文件数                   |
| 21   | outline                    | 以表格、图片、代码块形式的大纲       |
| 22   | auto_number                | 章节、表格、图片、代码块等自动编号   |
| 23   | chinese_symbol_auto_pairer | 中文符号自动补全                     |
| 24   | datatables                 | 表格增强（搜索、过滤、分页、排序等） |
| 25   | resize_table               | 调整表格行高列宽                     |
| 26   | resize_image               | 调整图片显示大小                     |
| 27   | export_enhance             | 导出 html 时避免图片丢失             |
| 28   | go_top                     | 一键到文章顶部                       |
| 29   | truncate_text              | 暂时隐藏内容，提高大文件渲染性能     |
| 30   | markdown_lint              | markdown 格式规范检测                 |
| 31   | hotkey_hub                 | 快捷键注册中心（高级）               |
| 32   | custom                     | 用户自定义命令（高级）               |
| 33   | plugin_updater             | 一键升级插件                         |
| 34   | right_click_menu           | 右键菜单统一管理、调用插件           |
| 35   | mermaid_replace            | 替换 mermaid 组件                    |
| 36   | old_window_tab             | 标签页管理（已废弃）                 |

> 尊重用户的一切选择。本项目的任何插件、任何功能皆可永久启用 / 禁用

> 如果各位有其他的需求，或发现 BUG，欢迎提 issue，欢迎 PR。如果能给我颗 star ⭐ 就更好了  : )



## 如何使用：方法一（自动）

> 目前此方法仅限 windows 平台。

1. [下载](https://github.com/obgnail/typora_plugin/releases/latest) 插件源码的压缩包，并解压

2. 进入 Typora 安装路径，找到包含 `window.html` 的文件夹 A（一般是 `Typora/resources/window.html` 或者  `Typora/resources/app/window.html`）

3. 打开文件夹 A，将源码的 plugin 文件夹粘贴进该文件夹下（参考方法二的图片）

4. 进入文件夹 `A/plugin/updater/`，双击运行 `updater.exe`。如果看到下图，说明成功

   ![installer](assets/installer.png)

5. 验证：重启 Typora，在正文区域点击鼠标右键，弹出右键菜单栏，如果能看到 `常用插件` 栏目，说明一切顺利

> 可以通过修改配置文件 **永久** 启用 / 禁用任何插件。打开配置文件方式：`非常用插件 -> 右键菜单 -> 打开插件配置文件`

> 本插件系统支持一键升级：`常用插件 -> 自定义插件 -> 升级插件`



---



## 如何使用：方法二（手动）

1. [下载](https://github.com/obgnail/typora_plugin/releases/latest) 插件源码的压缩包，并解压。
2. 进入 Typora 安装路径，找到包含 `window.html` 的文件夹 A（一般是 `Typora/resources/window.html` 或者  `Typora/resources/app/window.html`，推荐使用 everything 找一下）
3. 打开文件夹 A，将源码的 plugin 文件夹粘贴进该文件夹下。
4. 打开文件 `A/window.html`。搜索文件内容 `<script src="./app/window/frame.js" defer="defer"></script>` 或者 `<script src="./appsrc/window/frame.js" defer="defer"></script>`，并在 **后面** 加入 `<script src="./plugin/index.js" defer="defer"></script>`。保存。
6. 验证：重启 Typora，在正文区域点击鼠标右键，弹出右键菜单栏，如果能看到 `启动插件` 栏目，说明一切顺利。



### 新版本操作

> 根据文件夹 A 下是否有 `appsrc` 目录判断是否为新版本，有则新版本，无则旧版本。

![new_typora_dir](assets/new_typora_dir.png)

![new_typora_framejs](assets/new_typora_framejs.png)



### 旧版本操作

![where_is_windowhtml](assets/where_is_windowhtml.png)

![where_is_framejs](assets/where_is_framejs.png)

> 虽然操作简单，还请务必对照上图谨慎操作。如果修改完 Typora 白屏了，很可能是你修改的时候疏忽了。

## 如何使用：方法三（自动）

> 目前此方法仅限 archlinux 平台，aur 见 [aur/typora-plugin](https://aur.archlinux.org/packages/typora-plugin)

```
yay -S typora-plugin
```


## 实现原理

### 前端

`window.html` 是 Typora 的初始文件，可以写入一个 `<script>` 标签实现功能，就和 Tampermonkey 脚本一样。



### 后端

1. 因为 Typora 暴露了 `reqnode` 函数（require 的封装），所以可以使用 `reqnode('path')` 导入 Node.js 的 path 库，其他内置库同理。
2. 因为 Typora 使用了不太安全的 `executeJavaScript` 功能，所以可以用此注入 JS 代码，从而劫持后端关键对象，进而实现 electron 的后端功能注入。理论上劫持了 electron 对象，你甚至可以在 Typora 里斗地主。

```javascript
// 控制台输入下面命令:

// 恭喜你成功让第二个窗口打印消息
JSBridge.invoke("executeJavaScript", 2, `console.log("i am logging")`);

// 恭喜你成功让所有窗口打印消息
ClientCommand.execForAll(`console.log("i am logging")`);

// 恭喜你成功获取到本窗口的BrowserWindow对象
global.reqnode('electron').remote.require('electron').BrowserWindow;

// 恭喜你成功获取到所有窗口的BrowserWindow对象
ClientCommand.execForAll(`console.log(global.reqnode('electron').remote.require('electron').BrowserWindow)`);

// 恭喜你成功让窗口1执行语句_myValue=123，然后将变量_myValue传给窗口2
JSBridge.invoke('executeJavaScript', 1, "_myValue=123; JSBridge.invoke('executeJavaScript', 2, `console.log(${_myValue})`)");
```



## 插件使用说明

[插件使用说明](./USAGE.md)



## Q&A

### 我的 Typora 版本能用吗？

所有插件都在 0.9.8 版本和最新版本测试过，理论上支持所有 Typora 版本。



### 插件会失效吗?

理论上能保持长时间有效。且我在维护中。



### 支持 Typora for Mac 吗？

没有 Mac，故没做测试。



### 如何永久禁用/启用某些插件？

修改配置文件。具体修改方法请看 `./plugin/golbal/settings/请读我.md`。



## 小众软件推荐

[通过注入 js 代码，为 Typora 额外增加 4 个功能](https://www.appinn.com/typora-4-plugin/)

> 第一次上榜小众软件，心情非常冲动。同时祝小众软件越办越好。

![appinn](assets/appinn.png)



## 结语

本人并非前端开发，前端技术全靠 Google，JS/CSS 写的很烂。

感谢 [md-padding](https://github.com/harttle/md-padding) 提供的 space padding 功能。感谢 [typora-tabbar-plugin](https://github.com/gatziourasd/typora-tabbar-plugin) 提供思路 :) 

如果对各位有用的话，欢迎 star ⭐

