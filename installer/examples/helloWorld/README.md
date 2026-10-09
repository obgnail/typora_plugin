# 示例插件包（helloWorld）

这是"一个可被安装器安装的插件包"的最小范例，用来对照 [../../README.md](../../README.md) 里的清单规范。

```
helloWorld/
├── installer.toml        # 必需：安装清单
├── core/                 # 核心文件（install.source 指向它）
│   └── helloWorld.js     # 会被原样复制成 plugin/helloWorld.js
└── README.md             # 可选：不会被打包进 plugin/
```

试运行（不写盘）：

```bash
typora-plugin-installer-cli \
  --source examples/helloWorld \
  --target "<Typora>/resources/plugin" \
  --dry-run
```

真正安装：

```bash
typora-plugin-installer-cli \
  --source examples/helloWorld \
  --target "<Typora>/resources/plugin"
```

装完重启 Typora，在正文区点右键，菜单最下方（`__INTERACTIVE_PLUGINS__` 组）会出现 **Hello World（示例）**。
