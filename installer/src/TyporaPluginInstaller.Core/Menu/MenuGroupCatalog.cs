namespace TyporaPluginInstaller.Core.Menu;

/// <summary>
/// 一个可选的分组（给 GUI 下拉框 / CLI <c>--list-groups</c> 用）。
/// </summary>
/// <param name="Key">写进 <c>MENUS[].NAME</c> 的原始值，也是分组的唯一标识。</param>
/// <param name="DisplayTitle">从目标语言文件里读出来的显示名。</param>
/// <param name="PluginCount">该分组当前列了多少个插件条目。</param>
/// <param name="IsBuiltin">是否看起来像插件系统自带的分组（<c>__XXX__</c> 形式）。</param>
public sealed record MenuGroupInfo(string Key, string DisplayTitle, int PluginCount, bool IsBuiltin)
{
    public override string ToString() =>
        DisplayTitle == Key ? $"{Key}（{PluginCount} 项）" : $"{DisplayTitle} [{Key}]（{PluginCount} 项）";
}

/// <summary>目标目录当前的菜单分组总览。</summary>
/// <param name="Locale">已收敛到 en / zh-CN / zh-TW 的目标语言。</param>
/// <param name="SuggestedGroupName">"新建分组"时预填的名字。</param>
/// <param name="Groups">当前生效的全部分组。</param>
/// <param name="BaseSource">这些分组是从哪来的（默认配置 / 用户配置）。</param>
public sealed record MenuGroupCatalog(
    string Locale,
    string SuggestedGroupName,
    IReadOnlyList<MenuGroupInfo> Groups,
    string BaseSource);
