# Typora plugin

<div align="center">
  <img src="assets/typora_plugin.png" alt="typora_plugin" width="400" />
</div>

通过注入 JavaScript 代码，为 Typora 添加功能。

目前支持的功能：

- search_multi.js：多关键字搜索
- window_tab.js：标签页管理
- window_tab_drag.js：标签页管理，可拖拽排序
- resize_table.js：调整表格大小
- read_only.js：只读模式
- truncate_text.js：隐藏前面内容，提高大文件渲染性能



## 如何使用

1. 去到 Typora 安装路径，找到包含 `window.html` 的文件夹 A。（不同版本的 Typora 的文件夹结构可能不同，在我这是`Typora/resources/app`，推荐使用 everything 找一下）
2. 打开文件夹 A，将源码的 plugin 文件夹粘贴进该文件夹下。
3. 打开文件 `A/window.html`。搜索文件内容 `<script src="./app/window/frame.js" defer="defer"></script>`，并在后面加入 `<script src="./plugin/index.js" defer="defer"></script>`。保存。（不同版本的 Typora 查找的内容可能不同，其实就是查找导入 frame.js 的 script 标签）
4. 重启 Typora。

![where_is_windowhtml](assets/where_is_windowhtml.png)

![where_is_framejs](assets/where_is_framejs.png)

> 每个功能都对应 plugin 文件夹下的一个同名文件（index.js 除外），如若不需要某些功能，按需删除文件即可。

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

// 恭喜你成功让窗口1执行语句_myValue=123，然后将变量_myValue传给窗口2
JSBridge.invoke('executeJavaScript', 1, "_myValue=123; JSBridge.invoke('executeJavaScript', 2, `console.log(${_myValue})`)");
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



### window_tab.js / window_tab_drag.js：标签页管理

![window_tab](assets/window_tab.gif)

window_tab_drag.js 和 window_tab.js 的区别是：是否支持拖拽排序。

> 默认使用 window_tab_drag.js，关闭 window_tab.js。



### resize_table.js：拖动调整表格大小

ctrl+鼠标拖动，修改表格的行高列宽。

![resize_table](assets/resize_table.gif)



### read_only.js：只读模式

只读模式下文档不可编辑。快捷键：ctrl+shift+R。



### truncate_text.js：隐藏前面内容，提高大文件渲染性能

大文件在 Typora 的渲染性能很糟糕，用此脚本隐藏掉前面的内容（只是隐藏显示，不修改文件），提高渲染性能。

- ctrl+shift+B：隐藏最前面的文本段
- ctrl+shift+U：重新显示所有文本段
- ctrl+shift+Y：根据当前可视范围显示上下段

> 原理：通过设置 DOM 元素的 display 样式为 none 来隐藏元素，让元素不占用渲染树中的位置，对隐藏的元素操作不会引发其他元素的重排。



## 瞎聊

### 为什么要区分 window_tab.js 和 window_tab_drag.js ?

理由是：**支持排序会复杂很多**。

Typora 每开一个窗口，就会创建一个 electron BrowserWindow 实例，而且每个实例都有自己的 web 页面和渲染进程。标签管理本来是应该在 electron 后端实现的，现在强行要在前端实现，只能使用劫持后端关键对象，然后在每个窗口绘制这种非常绿皮的方式实现。

排序意味着状态的引入 —— 当创建第五个窗口的时候，新建的窗口必须要知道前面四个窗口的顺序：

- 如果此功能在后端实现的话就很好办，搞一个全局对象保存现有的窗口列表，创建窗口的时候传给他。
- 如果在前端实现的话就很痛苦，如上所述，每个窗口都有自己的 web 页面和渲染进程，你无法跨进程获取变量。

最可行的方案是使用 localStroge 存储当前的窗口列表。但是我希望脚本是无状态的，每次打开都是一次全新开始 —— 如果 Typora 崩溃，处在 localStroge 里的脏数据就会影响下次启动。

我采取的方法是应答。第五个窗口创建的时候就会通过 IPC 去询问第四个窗口当前的窗口列表，等第四个窗口回复之后，第五个窗口进行数据处理，再将新的窗口列表通知给所有的窗口，让它们重新渲染。

**这种方式就是带着脚铐跳舞，是奇技淫巧，绿皮中的绿皮**。



### 脚本会失效吗

Typora 是闭源软件，要是有一天作者改了代码，是不是就不能用了？从原理来说，是的。实际上我是解包 Typora，看了部分源码才实现了这些功能。

同时值得注意的是， Typora 的历史包袱还蛮重的。比如说 github 已经有无数个 Typora theme，这决定了它的页面它不可能大改，就算改变也大概率是向下兼容的。

具体来看：

- search_multi.js、resize_table.js、read_only.js、truncate_text.js 这些功能几乎不依赖 Typora 实现。**如果这些功能失效了，那么 github 上的 Typora theme 会大面积失效**，所以应该会保持长时间的有效性。
- 比较特殊的是 window_tab.js 和 window_tab_drag.js，这个功能本质是入侵式脚本；通过原型链攻击，将后端 electron 对象劫持到前端来，该脚本通过该手段成功调用了 Typora 的核心实现，并且这个核心实现同时被大量运用，历史包袱一样很大。**如果 Typora 或 electron 有了重构级别的更新，那么大概率会失效**。

> 总结：标签页管理功能比较危险，其他脚本保持长时间的有效性。



## 结语

本人并非前端开发，JS/CSS 写的很烂。感谢 new bing 对于本项目的大力支持 : ) 

如果对各位有用的话，欢迎 star ⭐（吸星大法，发动！

