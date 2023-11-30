## 开放平台

> 约定：基础插件的 fixedName 统一使用蛇形，如 `window_tab`。自定义插件的 fixedName 统一使用小驼峰，如 `fullPathCopy`。



### 基础插件

本小节下的所有插件可以使用 `this.utils.getPlugin(XXX)` 获取到插件实例，之后就可以调用其 API。

```js
// 以 window_tab 为例

// 插件功能：总是切换到第一个标签
class switchFirstTab extends BaseCustomPlugin {
    hint => "切换到第一个标签"
    callback = () => {
        // 获取到window_tab插件的实例
        const windowTabInstance = this.utils.getPlugin("window_tab");
        // 调用插件示例的switchTab方法，切换到第一个标签
        windowTabInstance && windowTabInstance.switchTab(0);
    }
}
```



#### window_tab

```js
class windowTabBarPlugin extends BasePlugin {
    // 打开文件路径（wantOpenPath：文件的绝对路径）
    openTab = wantOpenPath => {
        return null
    }

    // 切换到第几个tab
    switchTab = idx => {
        return null
    }

    // 根据文件路径切换tab（path：文件的绝对路径）
    switchTabByPath = path => {
        return null
    }

    // 切换到上一个tab
    previousTab = () => {
        return null
    }

    // 切换到下一个tab
    nextTab = () => {
        return null
    }

    // 关闭tab
    closeTab = idx => {
        return null
    }

    // 关闭当前tab
    closeActiveTab = () => {
        return null
    }

    // 新窗口打开
    //  1. path：文件（夹）的绝对路径
    //  2. isFolder: 是否是文件夹
    openFileNewWindow = (path, isFolder) => {
        return null
    }

    // 新标签页打开（filePath：文件的绝对路径）
    openFile = filePath => {
        return null
    }

    // 当前标签页打开（filePath：文件的绝对路径）
    OpenFileLocal = filePath => {
        return null
    }

    // 关闭窗口
    closeWindow = () => {
        return null
    }

    // 保存当前的所有tab
    saveTabs = () => {
        return null
    }

    // 打开保存的tab
    openSaveTabs = () => {
        return null
    }
    
    // type(string):
    //  1. new_tab_open: 总是新标签页打开文件
    //  2. local_open: 总是在当前标签页打开文件
    //  3. save_tabs: 将当前标签页保存起来
    //  4. open_save_tabs: 打开保存的标签页
    call = type => {
        return null
    }
}
```



#### search_multi

```js
class windowTabBarPlugin extends BasePlugin {
    // 显示/隐藏模态框
    call = () => {
        return null
    }
}
```



#### multi_highlighter

```js
class multiHighlighterPlugin extends BasePlugin {
    // 给出关键字数组，高亮当前文档的关键字
    // args:
    //  1. keyArr(Array[string]): 关键字数组
    //  2. resfreshResult(Boolean): 是否刷新模态框里的结果
    doSearch = (keyArr, refreshResult = true) => {
        return null
    }

    // doSearch 的封装，从input中获取KeyArr
    highlight = (refreshResult = true) => {
        return null
    }

    // 清除所有的高亮
    clearHighlight = () => {
        return null
    }

    // 展示/隐藏模态框
    call = () => {
        return null
    }
}
```



#### outline

```js
class outlinePlugin extends BasePlugin {
    // 切换类别大纲
    // Type: fence/image/table/all
    collectAndShow = Type => {
        return null
    }

    // 刷新
    refresh = () => {
        return null
    }

    // 显示/隐藏
    call = () => {
        return null
    }
}
```



#### commander

```js
class commanderPlugin extends BasePlugin {
    // 执行命令时，是否弹出模态框
    // 	always: 总是弹出
    // 	error: 只在异常时弹出
    // 	silent: 总是静默（可以在console中看到）
    //  echo: 立刻回显
    // args:
    //   1. shell(string): 执行命令的shell：cmd/bash、powershell、gitbash、wsl
    //   2. cmd(string): 命令
    //   3. callback: 执行完命令的回调函数
    //   4. hint(string): 执行命令前添加提示信息
    //   5. options(Object): childProcess.exec的option参数
    silentExec = (cmd, shell, callback, hint, options) => {
        return null
    }
    errorExec = (cmd, shell, callback, hint, options) => {
        return null
    }
    alwaysExec = (cmd, shell, callback, hint, options) => {
        return null
    }
    echoExec = (cmd, shell, callback, hint, options) => {
        return null
    }

    // 显示/隐藏模态框
    call = () => {
        return null
    }
}
```



#### md_padding

```js
class mdPaddingPlugin extends BasePlugin {
    // 提供markdown字符串，将其格式化
    // args:
    //   1. content(string): markdown字符串
    // return:
    //   2. formattedContent(string): 格式化后的字符串
    formatFile = content => {
        return formattedContent
    }

    // 格式化当前文件
    call = () => {
        return null
    }
}
```



#### read_only

```js
class readOnlyPlugin extends BasePlugin {
    // 进入/退出只读模式
    call = () => {
        return nil
    }
}
```



#### blur

```js
class blurPlugin extends BasePlugin {
    // 进入/退出模糊模式
    call = () => {
        return nil
    }
}
```



#### resize_image

```js
class resizeImagePlugin extends BasePlugin {
    // 缩放图片
    // args:
    //   1.image(Element): 图片标签，如 document.querySelector("#write img")
    //   2.zoomOut(bool): true为缩小，false为放大
    //   3.scale(float): 缩放倍率，建议为0.2
    zoom = (image, zoomOut, scale) => {
        return nil
    }
    
    // type(string):
    //  1. allow_oversize: 允许/禁止图片超出范围
    call = type => {
        return null
    }
}
```



#### datatables

```js
class datatablesPlugin extends BasePlugin {
    // 将普通表格转为增强表格
    // args:
    //   1.target(Element): 表格标签，如 document.querySelector("#write table.md-table")
    // return:
    //   2. uuid(string): 增强表格的uuid，后续可以使用此uuid将其转化回普通表格
    newDataTable = async target => {
        return uuid
    }

    // 将增强表格转为普通表格
    // args:
    //   1. uuid(string): newDataTable 函数返回的uuid
    removeDataTable = async uuid => {
        return null
    }
}
```



#### go_top

```js
class goTopPlugin extends BasePlugin {
    // 置顶/置底
    // direction(string): go-bottom、go-top
    call = direction => {
        return null
    }
}
```



#### mindmap

```js
class mindmapPlugin extends BasePlugin {
    // 生成页面的思维导图，并写入剪切板
    // Type(string): set_clipboard_mindmap/set_clipboard_graph
    call = Type => {
        return null
    }
}
```



#### markmap

```js
class markmapPlugin extends BasePlugin {
    // type: draw_toc/draw_fence
    call = async type => {
        return null
    }
}
```



#### auto_number

```js
class autoNumberPlugin extends BasePlugin {
    // type(string):
    //  1. disable: 禁用
    //  2. enable: 启用
    //  3. set_outline: 启用/禁用大纲编号
    //  4. set_content: 启用/禁用标题编号
    //  5. set_toc: 启用/禁用TOC编号
    //  6. set_table: 启用/禁用表格编号
    //  7. set_image: 启用/禁用图片编号
    //  8. set_fence: 启用/禁用代码块编号
    call = type => {
        return null
    }
}
```



#### fence_enhance

```js
class fenceEnhancePlugin extends BasePlugin {
    // 注册button
    // args:
    //   className: button的class name
    //   action: 取个名字
    //   hint: 提示
    //   iconClassName: 通过className设置icon
    //   enable: 是否使用
    //   listener(ev, button)=>{}: 点击按钮的回调函数(ev: 时间，button: 按钮本身element)
    //   extraFunc(button)=>{}: 插入html后的额外操作
    registerBuilder = (className, action, hint, iconClassName, enable, listener, extraFunc) => {
        return null
    }

    //移除button（使用上面的action删除）
    removeBuilder = action => {
        return null
    }

    // 复制代码，调整缩进代码，折叠/展开代码
    // args: 
    //   target(Element): 如 document.querySelector("#write .md-fences") 
    copyFence = target => {
        return null
    }
    indentFence = target => {
        return null
    }
    foldFence = target => {
        return null
    }

    // type(string):
    //  1. disable_or_enable_fold: 禁用/启用折叠按钮
    //  2. disable_or_enable_copy: 禁用/启用复制按钮
    //  3. disable_or_enable_indent: 禁用/启用缩进调整按钮
    //  4. fold_all: 总是折叠代码块
    //  5. expand_all: 总是展开代码块
    //  6. set_auto_hide: 自动隐藏/显示按钮
    call = type => {
        return null
    }
}
```



#### collaspe_paragraph

```js
class collapseParagraphPlugin extends BasePlugin {
    // 切换标题的收缩/展开状态
    // args:
    //   1. paragraph(Element): 目标标题。 如：document.querySelector(`#write h1`)
    //   2. collapsed(Boolean): 为ture则展开，为false则收缩
    trigger = (paragraph, collapsed) => {
        return null
    }

    // 给出一个开始标签，展开前面的所有【必要的】标签
    // args:
    //   1. starth(Element): #write标签下的任意一个直接子标签
    rollback = start => {
        return null
    }

    // type(string):
    //  1. collapse_all: 折叠全部章节
    //  2. expand_all: 展开全部章节
    call = type => {
        return null
    }
}
```



#### truncate_text

```js
class truncateTextPlugin extends BasePlugin {
    // 隐藏最前面的文本段，只留下最后 80 段。
    hideFront = () => {
        return null
    }

    // 根据当前可视范围显示：根据当前可视范围显示文本段。
    hideBaseView = () => {
        return null
    }

    // 重新显示之前隐藏的所有文本段。
    showAll = () => {
        return null
    };
}
```



#### export_enhance

```js
class exportEnhancePlugin extends BasePlugin {
    // type(string):
    //  1. download_network_image: 导出HTML时下载网络图片
    //  2. dont_download_network_image: 导出HTML时不下载网络图片
    //  3. disable: 禁用
    //  4. enable: 启用
    call = type => {
        return null
    }
}
```



#### custom

无



#### right_click_menu

```js
class rightClickMenuPlugin extends BasePlugin {
    // type(string):
    //  1. about: 打开帮助页面
    //  2. do_not_hide: 右键菜单点击后保持显示/隐藏
    //  3. open_setting_folder: 打开插件配置文件
    call = type => {
        return null
    }
}
```



#### file_counter

```js
class fileCounterPlugin extends BasePlugin {
    // 刷新
    setAllDirCount = () => {
        return nil
    }
}
```



#### resize_table

无



#### mermaid_replace

无



### 自定义插件

本小节下的所有插件可以使用 `this.utils.getPlugin(XXX)` 获取到插件实例，之后就可以调用其 API。

```js
// 以 pluginUpdater 为例

// 插件功能：每次打开Typora，就自动更新所有插件。
class autoUpdatePlugin extends BaseCustomPlugin {
    hint => "自动更新所有插件"
	// 每当打开 Typora，就会自动调用 init 方法。
    init = () => {
        // 获取到pluginUpdater插件的实例
        const pluginUpdaterInstance = this.utils.getCustomPlugin("pluginUpdater");
        // 调用插件示例的callback方法，更新所有插件
        pluginUpdaterInstance && pluginUpdaterInstance.callback();
    }
    callback = () => null
}
```



#### kanban

```js
class kanbanPlugin extends BaseCustomPlugin {
    // 在当前位置插入默认看板
    callback = () => {
        return nil
    }
}
```



#### echarts

```js
class echartsPlugin extends BaseCustomPlugin {
    // 在当前位置插入默认echarts
    callback = () => {
        return nil
    }
}
```



#### fullPathCopy

```js
class fullPathCopy extends BaseCustomPlugin {
    // 获取所在的标题路径
    // anchorNode(Element): 目标标题。 如：document.querySelector(`#write h1`)
    callback = anchorNode => {
        return nil
    }
}
```



#### extractRangeToNewFile

```js
class extractRangeToNewFile extends BaseCustomPlugin {
    // 提取选取文字到新文件
    // 注意调用此函数时必须保证鼠标有选区
    callback = () => {
        return nil
    }
}
```



#### templater

```js
class templater extends BaseCustomPlugin {
    // 弹出文件模板的模态框
    callback = () => {
        return nil
    }
}
```



#### resourceOperation

```js
class resourceOperation extends BaseCustomPlugin {
    // 资源管理
    callback = () => {
        return nil
    }
}
```



#### openInTotalCommander

```js
class openInTotalCommander extends BaseCustomPlugin {
    // total commander 打开此文件
    callback = () => {
        return nil
    }
}
```



#### hotkeyHub

无



#### pluginUpdater

```js
class pluginUpdater extends BaseCustomPlugin {
    // 升级插件
    callback = () => {
        return nil
    }
}
```

