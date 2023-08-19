## 开放平台（WIP）

### window_tab

```js
// 打开文件路径
const openTab = wantOpenPath => {
    return null
}

// 切换到第几个tab
const switchTab = idx =>  {
    return null
}

// 根据文件路径切换tab
const switchTabByPath = path => {
    return null
}

// 切换到上一个tab
const previousTab = () => {
    return null
}

// 切换到下一个tab
const nextTab = () => {
    return null
}

// 关闭tab
const closeTab = idx => {
    return null
}

// 关闭当前tab
const closeActiveTab = () => {
    return null
}

// 新窗口打开
const openFileNewWindow = (path, isFolder) => {
    return null
}

// 新标签页打开
const openFile = filePath => {
    return null
}

// 当前标签页打开
const OpenFileLocal = filePath => {
    return null
}

// 关闭窗口
const closeWindow = () => {
    return null
}

// type(string):
//  1. new_tab_open: 总是新标签页打开文件
//  2. local_open: 总是在当前标签页打开文件
//  3. save_tabs: 将当前标签页保存起来
//  4. open_save_tabs: 打开保存的标签页
const call = type => {
    return null
}
```



### datatables

```js
// 将普通表格转为增强表格
// args:
//   1.target(Element): 表格标签，如 document.querySelector("#write table.md-table")
// return:
//   2. uuid(string): 增强表格的uuid，后续可以使用此uuid将其转化回普通表格
const newDataTable = target => {
    return uuid
}

// 将增强表格转为普通表格
// args:
//   1. uuid(string): newDataTable 函数返回的uuid
const removeDataTable = uuid => {
    return null
}
```



### md-padding

```js
// 提供markdown字符串，将其格式化
// args:
//   1. content(string): markdown字符串
// return:
//   2. formattedContent(string): 格式化后的字符串
const formatFile = content => {
    return formattedContent
}

// 格式化当前文件
const call = () => {
    return null
}
```

### multi_highlighter

```js
// 给出关键字数组，高亮当前文档的关键字
// args:
//  1. keyArr(Array[string]): 关键字数组
//  2. resfreshResult(Boolean): 是否刷新模态框里的结果
const doSearch = (keyArr, refreshResult = true) => {
    return null
}

// doSearch 的封装，从input中获取KeyArr
const highlight = (refreshResult = true) => {
    return null
}

// 清除所有的高亮
const clearHighlight = () => {
    return null
}

// 展示/隐藏模态框
const call = () => {
    return null
}
```



### auto_number

```js
// type(string):
//  1. disable: 禁用
//  2. enable: 启用
//  3. set_outline: 启用/禁用大纲编号
//  4. set_content: 启用/禁用标题编号
//  5. set_toc: 启用/禁用TOC编号
//  6. set_table: 启用/禁用表格编号
//  7. set_image: 启用/禁用图片编号
//  8. set_fence: 启用/禁用代码块编号
const call = type => {
    return null
}
```



### collaspe_paragraph

```js
// 切换标题的收缩/展开状态
// args:
//   1. paragraph(Element): 目标标题。 如：document.querySelector(`#write h1`)
//   2. collapsed(Boolean): 为ture则展开，为false则收缩
const trigger = (paragraph, collapsed) => {
    return null
}

// 给出一个开始标签，展开前面的所有【必要的】标签
// args:
//   1. starth(Element): #write标签下的任意一个直接子标签
const rollback = start => {
    return null
}

// type(string):
//  1. collapse_all: 折叠全部章节
//  2. expand_all: 展开全部章节
const call = type => {
    return null
}
```



### commander

```js
// 执行命令时，是否弹出模态框
// 	always: 总是弹出
// 	error: 只在异常时弹出
// 	silent: 总是静默（可以在console中看到）
// args:
//   1. shell(string): 执行命令的shell：cmd/bash、powershell、gitbash、wsl
//   2. cmd(string): 命令
const silentExec = (cmd, shell) => { return null }
const errorExec = (cmd, shell) => { return null }
const alwaysExec = (cmd, shell) => { return null }

// 显示/隐藏模态框
const call = () => {
    return null
}
```



### export_enhance

```js
// type(string):
//  1. download_network_image: 导出HTML时下载网络图片
//  2. dont_download_network_image: 导出HTML时不下载网络图片
//  3. disable: 禁用
//  4. enable: 启用
const call = type => {
    return null
}
```



### fence_enhance

```js
// type(string):
//  1. disable_or_enable_fold: 禁用/启用折叠按钮
//  2. disable_or_enable_copy: 禁用/启用复制按钮
//  3. disable_or_enable_indent: 禁用/启用缩进调整按钮
//  4. fold_all: 总是折叠代码块
//  5. expand_all: 总是展开代码块
//  6. set_auto_hide: 自动隐藏/显示按钮
const call = type => {
    return null
}

// 复制代码，调整缩进代码，折叠/展开代码
// args: 
//   target(Element): 如 document.querySelector("#write .md-fences") 
const copyFence = target => { return null }
const indentFence = target => { return null }
const foldFence = target => => { return null }
```



todo…

