本文件介绍如何通过 `user_styles` 目录自定义软件样式。



## 工作原理

插件系统加载样式时，位于 `./plugin/global/user_styles` 目录下的文件会优先于 `./plugin/global/styles` 目录下的同名文件加载。因此，您可以通过在 `user_styles` 目录中创建与 `styles` 目录中同名的 CSS 文件来覆盖默认样式，从而实现自定义。



## 如何使用

1. **复制文件**：将您希望修改的 `styles` 目录下的 CSS 文件 **复制** 到 `user_styles` 目录中。
2. **修改文件**：在 `user_styles` 目录中直接修改复制过来的 CSS 文件即可。
3. **添加自定义样式**：如果您只需要添加少量自定义样式，可以在 `user_styles` 目录下创建一个名为 `customize.css` 的文件，并将您的 CSS 代码写入其中。



## 渲染变量

在 `styles` 和 `user_styles` 目录下的 CSS 文件中，支持使用 `${变量}` 的语法来表示渲染变量，类似于 Less 中的 `@` 变量。这些变量在样式加载过程中会被替换为具体数值。例如：

```css
/* styles/toolbar.css */
#plugin-toolbar {
    /* 加载时 ${topPercent} 会被替换为具体数值 */
    top: ${topPercent};
}
```



## 重要提示：开发者建议

**开发者原则上不建议用户手动修改样式**，原因如下：

- 许多样式调整可以通过修改配置实现，无需直接修改 CSS 文件。
- 插件迭代过程中，样式和 JavaScript 代码可能深度绑定，手动修改可能导致样式错乱或 BUG。

如果您有更好的样式或交互建议，欢迎提交 Pull Request。如果手动修改样式后出现问题，请尝试删除或移动 `user_styles` 目录下的所有文件。
