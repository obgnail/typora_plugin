// 示例插件：最小可用形态。
//
// 必需：
//   1) 继承 BasePlugin（安装到 plugin/ 后由插件系统注入 global.BasePlugin）
//   2) 覆盖 call —— 右键菜单点击时会被调用；不覆盖的话菜单项会被置灰且无法点击
//
// 可选：style / html / hotkey / init / process / postprocess，基类里都是空实现。

class helloWorld extends BasePlugin {
  // 右键菜单点击时触发（普通二级菜单项是无参调用）
  call = () => {
    const greeting = this.config.GREETING || "Hello World"
    this.utils.notification.show(`${greeting} —— 来自 helloWorld 插件`)
  }
}

module.exports = { plugin: helloWorld }
