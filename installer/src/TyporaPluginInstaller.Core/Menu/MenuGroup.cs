namespace TyporaPluginInstaller.Core.Menu;

/// <summary>
/// <c>right_click_menu</c> 的第一级菜单分组：标题 + 插件条目列表。
/// <para><see cref="Name"/> 会原样写进 <c>MENUS[].NAME</c>。运行时用
/// <c>i18n._t("settings", NAME)</c> 查翻译，查不到就直接显示这个字符串，
/// 所以自定义分组可以直接用字面文本（第三方插件无法往共享 locales 里加 key）。</para>
/// <para><see cref="List"/> 的条目是 <c>plugin</c> 或 <c>plugin.action</c>；分隔线写作 <c>---</c>。</para>
/// </summary>
public sealed record MenuGroup(string Name, IReadOnlyList<string> List);

/// <summary>新建分组时放在哪里。</summary>
public enum MenuGroupPosition
{
    /// <summary>
    /// 放在最前（默认）。既显眼，又能让 <c>FIND_LOST_PLUGINS</c> 的兜底插件
    /// （框架固定追加到<b>最后</b>一个分组）落在内置分组里。
    /// </summary>
    First,

    /// <summary>放在最后。注意：兜底插件会被追加进这个分组。</summary>
    Last,
}
