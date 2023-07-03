# Markdown Padding
[![npm version](https://img.shields.io/npm/v/md-padding.svg)](https://www.npmjs.org/package/md-padding)
[![downloads](https://img.shields.io/npm/dm/md-padding.svg)](https://www.npmjs.org/package/md-padding)
[![Build Status](https://travis-ci.com/harttle/md-padding.svg?branch=master)](https://travis-ci.com/harttle/md-padding)
[![Coveralls](https://img.shields.io/coveralls/harttle/md-padding.svg)](https://coveralls.io/github/harttle/md-padding?branch=master)
[![dependencies](https://img.shields.io/david/harttle/md-padding.svg)](https://david-dm.org/harttle/md-padding)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/harttle/md-padding)
[![GitHub issues](https://img.shields.io/github/issues-closed/harttle/md-padding.svg)](https://github.com/harttle/md-padding/issues)
[![David](https://img.shields.io/david/harttle/md-padding.svg)](https://david-dm.org/harttle/md-padding)
[![David Dev](https://img.shields.io/david/dev/harttle/md-padding.svg)](https://david-dm.org/harttle/md-padding?type=dev)
[![DUB license](https://img.shields.io/dub/l/vibe-d.svg)](https://github.com/harttle/md-padding/blob/master/LICENSE)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#commits)

**排版中只有空格不能忍**，修复你 Markdown 中缺少的空格：

* 中英文混排时，*中文* 与 *英文* 之间，*中文* 与 *数字* 之间添加空格。
* *特定英文标点* 后面添加空格，但 *全角标点* 前后不加空格。
* 文字和 *行内代码* 之间、文字与 *链接* 之间、文字与 *加粗*、*强调*、*删除线* 之间添加空格。
* 会解析生成 Markdown + 自然语言构成的 AST，最大限度解决问题同时避免误处理。

[这里](https://github.com/harttle/md-padding/tree/master/demo) 有个例子：

![raw.md 和 formated.md 之间的 Diff](https://user-images.githubusercontent.com/4427974/73588871-6e8d5600-4509-11ea-8c42-9debaaad9008.png)

## 使用说明
### 在命令行使用

可以 `npm i -g md-padding` 后使用，也可以用 `npx md-padding`：

```bash
# 输出 README.md 格式化后的内容
npx md-padding README.md
```

还可以接受标准输入（用在管道中），也可以原址（in-place）更改文件。详见 `md-padding --help`。

```none
> npx md-padding --help
md-padding [OPTION]... <FILE>

Options:
  --help, -h      Show help                  [boolean]
  --version       Show version number        [boolean]
  --in-place, -i  edit file in place         [boolean]

Examples:
  stdout    md-padding README.md
  in-place  md-padding -i README.md
  pipe      cat README.md | md-padding
```

### 在 Vim 中使用

可以绑定一个快捷键 `F6` 来修复当前文件：

```vim
" 绑一个 Vim Filter
noremap <buffer> <F6> <Esc>:%!npx md-padding<CR>
```

### 在 VS Code 中使用

从 Marketplace 安装 [Markdown Padding](https://marketplace.visualstudio.com/items?itemName=harttle.md-padding-vscode)。
打开一个 Markdown 文件后，支持这些操作：

- Command。打开 *命令面板*，输入 Markdown Padding 并回车。*命令面板* 快捷键：
  - Windows：Ctrl + Shift + P
  - Mac：Command + Shift + P
  - Linux：Ctrl + Shift + P
- Formatting。在编辑器里右键点格式化，或者：
  - Windows：Shift + Alt + F
  - Mac：Shift + Option + F
  - Linux：Ctrl + Shift + I

## 支持说明

### 中英混排
中英混排的正文内容，会确保中英之间的空格。

### 标点符号
需要空格的标点（比如半角逗号），会在适当的位置追加空格。

### 代码注释
代码格式化不是本仓库的功能之一，请使用对应语言的 prettifier。但代码中的注释会被当做 Markdown 正文来格式化，目前支持这些语言的注释：

- cpp, c, java, javascript, typescript, csharp, go
- sql
- bash, python, ruby
