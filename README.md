# Typora plugin

<div align="center">
  <img src="assets/typora_plugin.png" alt="typora_plugin" width="400" />
</div>
通过注入 JavaScript 代码，为 Typora 添加功能。

目前支持的功能：

- search_multi.js：多关键字搜索
- window_tab.js：标签管理
- resize_table.js：调整表格大小
- read_only.js：只读模式
- truncate_text.js：隐藏前面内容，提高大文件渲染性能



## 如何使用

1. 找到包含 `window.html` 的文件夹 A。（不同版本的 Typora 的文件夹结构可能不同，在我这是`Typora/resources/app`，推荐使用 everything 找一下）
2. 打开文件夹 A，将源码的 plugin 文件夹粘贴进该文件夹下。
3. 打开文件 `A/window.html`。搜索文件内容 `<script src="./app/window/frame.js" defer="defer"></script>`，并在后面加入 `<script src="./plugin/index.js" defer="defer"></script>`。保存。
4. 重启 Typora。

> 每个功能都对应 plugin 文件夹下的一个文件（index.js 除外），如若只要其一，按需删除文件即可。

> 每个功能都有对应的配置，且每个配置选项都有注释说明。可以按需修改对应 JS 文件里的 config。



## 实现原理

### 前端

`window.html` 是 Typora 的初始文件，可以写入一个`<script>`标签实现功能。就和 Tampermonkey 脚本一样。



### 后端

1. 因为 Typora 暴露了 `reqnode` 函数（require 的封装），所以可以使用 `reqnode('path')` 导入 Node.js 的 path 库，其他内置库同理。
2. 因为 Typora 使用了不太安全的 `executeJavaScript`功能，所以可以用此注入 JS 代码，从而劫持后端关键对象，进而实现 electron 的后端功能注入。理论上劫持了 electron 对象，你甚至可以在 Typora 里斗地主。

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

// 恭喜你成功让窗口1告诉窗口2它自己的windowID(#title-bar-window-tabs的winid属性是打开页面时已经设置好的)
JSBridge.invoke('executeJavaScript', 1, "_winid=document.getElementById('title-bar-window-tabs').getAttribute('winid'); JSBridge.invoke('executeJavaScript', 2, `console.log(${_winid})`)");
```



## 插件/脚本

### search_multi.js：多关键字搜索

比如搜索同时包含 `golang` 和 `install` 和 `生命周期` 三个关键字的文件。

- ctrl+shift+P：打开搜索框
- esc：关闭搜索框
- enter：搜索
- ArrowUp，ArrowDown：方向键上下选中
- click、ctrl+enter：当前窗口打开
- ctrl+click、ctrl+shift+enter：新窗口打开
- drag：拖动输入框可移动搜索框

> ctrl 在 Mac 中对应 command

![search_mutli](assets/search_mutli.gif)



### window_tab.js：标签管理

![window_tab](assets/window_tab.gif)



### resize_table.js：拖动调整表格大小

ctrl+鼠标拖动，修改表格的行高列宽。

![resize_table](assets/resize_table.gif)



### read_only.js：只读模式

只读模式下文档不可编辑。快捷键：ctrl+shift+R。



### truncate_text.js：隐藏前面内容，提高大文件渲染性能

大文件在 Typora 的渲染性能很糟糕，用此脚本隐藏掉前面的内容（只是隐藏显示，不修改文件），提高渲染性能。

快捷键：ctrl+shift+B。

默认剩余最后的 80 个文本段，前面的都会被隐藏。如果需要查看被隐藏的文本段，重新进入文档即可。

> 原理：通过设置 DOM 元素的 display 样式为 none 来隐藏元素，让元素不占用渲染树中的位置，对隐藏的元素操作不会引发其他元素的重排。



## 瞎聊

Typora 每开一个窗口，就会创建多个 electron BrowserWindow 实例，而且每个实例都有自己的 web 页面和渲染进程。

标签管理本来是应该在 electron 后端实现的，现在强行要在前端实现，只能使用劫持后端关键对象，然后在每个窗口绘制这种非常绿皮的方式实现。

> 本人并非前端开发，JS/CSS 写的很烂。感谢 new bing 对于本项目的大力支持 : ) 

如果对各位有用的话，欢迎 star。

