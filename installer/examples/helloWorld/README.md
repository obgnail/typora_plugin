# 示例插件包（helloWorld）

一个可被安装器安装的插件包的最小范例，用来对照 [../../README.md](../../README.md) 的「插件包需要提供什么」。

```text
helloWorld/
├── installer.toml        # 必需：安装清单
├── core/                 # 核心文件目录（install.source 指向它）
│   └── helloWorld.js     # 会被原样复制成 plugin/helloWorld.js
└── README.md             # 可选：不会被打包进 plugin/
```

试运行（不写盘）：

```bash
typora-plugin-installer-cli \
  --source examples/helloWorld \
  --target "<plugin目录>" \
  --dry-run
```

真正安装（不指定分组时，会新建一个按目标语言命名的分组并放在最前）：

```bash
typora-plugin-installer-cli \
  --source examples/helloWorld \
  --target "<plugin目录>"
```

装完重启 Typora，在正文区点右键，就能在你选的那个分组里看到 **Hello World（示例）**。
