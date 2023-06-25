# Typora plugin

通过注入 JavaScript 代码，为 Typora 添加功能。



## 如何使用

1. 打开目录 `Typora/resources/app`，将源码的 plugin 目录粘贴进该目录下。
2. 打开文件 `Typora/resources/app/window.html`。搜索文件内容 `<script src="./app/window/frame.js" defer="defer"></script>`，并在后面加入 `<script src="./plugin/index.js" defer="defer"></script>`。保存。
3. 重启 Typora。

> 每个功能对应一个文件，如若只要其一，只需删除对应文件即可。



## 实现原理

### 前端

`Typora/resources/app/window.html` 是 Typora 的初始文件，可以写入一个`<script>`标签实现功能。就和 Tampermonkey 脚本一样。



### 后端

1. 因为 Typora 暴露了 `reqnode` 函数（require 的封装），所以可以使用 `reqnode('path')` 导入 Node.js 的 path 库。
2. 因为 Typora 使用了不太安全的 `executeJavaScript` 事件，所以可以用此注入 JS 代码，从而劫持后端关键对象，进而实现 electron 的后端功能注入。理论上有了 electron 对象，你甚至可以在 Typora 里斗地主。

```javascript
// 控制台输入下面四条命令:

// 恭喜你成功让第二个窗口打印消息
JSBridge.invoke("executeJavaScript", 2, `console.log("i am logging")`);

// 恭喜你成功让所有窗口打印消息
ClientCommand.execForAll(`console.log("i am logging")`);

// 恭喜你成功获取到本窗口的BrowserWindow对象
global.reqnode('electron').remote.require('electron').BrowserWindow;

// 恭喜你成功获取到所有窗口的BrowserWindow对象
ClientCommand.execForAll(`console.log(global.reqnode('electron').remote.require('electron').BrowserWindow)`);
```



## 插件/脚本

### search_multi.js：多关键字搜索

比如搜索同时包含 `golang` 和 `install` 和 `生命周期` 三个关键字的文件。

- ctrl/command + shift + P：打开搜索框
- esc：关闭搜索框
- enter：搜索
- ArrowUp，ArrowDown：选中
- click、ctrl+enter：当前窗口打开
- ctrl+click、ctrl+shift+enter：新窗口打开
- drag：拖动输入框可移动

![search_mutli](assets/search_mutli.gif)



### window_tab.js：标签管理

![window_tab](assets/window_tab.gif)



## 瞎聊

Typora 每开一个窗口，就会创建多个 electron BrowserWindow 实例，而且每个实例都有自己的 web 页面和渲染进程。

标签管理本来是应该在 electron 后端实现的，现在强行要在前端实现，只能使用劫持后端关键对象，然后在每个窗口绘制这种非常绿皮的方式实现。

> 本人并非前端开发，JS/CSS 写的很烂。感谢 new bing 对于本项目的大力支持 : ) 

如果对各位有用的话，欢迎 star。

