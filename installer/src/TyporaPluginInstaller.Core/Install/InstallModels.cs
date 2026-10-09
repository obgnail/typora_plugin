namespace TyporaPluginInstaller.Core.Install;

/// <summary>安装请求参数。</summary>
public sealed class InstallOptions
{
    /// <summary>插件包目录（含 installer.toml）。</summary>
    public required string SourceDirectory { get; init; }

    /// <summary>Typora 的 <c>plugin</c> 目录（通常 &lt;Typora&gt;/resources/plugin）。</summary>
    public required string TargetPluginDirectory { get; init; }

    /// <summary>显式指定清单文件；默认取 <c>&lt;SourceDirectory&gt;/installer.toml</c>。</summary>
    public string? ManifestPath { get; init; }

    /// <summary>只演练、不写盘。</summary>
    public bool DryRun { get; init; }

    /// <summary>允许目标目录看起来不像 Typora 插件目录（默认不允许，避免选错目录后到处撒文件）。</summary>
    public bool AllowNonPluginTarget { get; init; }

    /// <summary>
    /// 把插件放进哪个右键菜单分组。为空时使用安装器的默认行为
    /// （新建一个按目标语言命名的分组，放在最前）。
    /// </summary>
    public MenuChoice? MenuChoice { get; init; }
}

/// <summary>安装时的菜单去向。</summary>
public enum MenuChoiceKind
{
    /// <summary>放进已有分组。</summary>
    ExistingGroup,

    /// <summary>新建分组；名字已存在时等价于放进那个分组。</summary>
    NewGroup,

    /// <summary>不注册右键菜单。</summary>
    None,
}

/// <summary>
/// 安装器侧的菜单选择。这些信息刻意不放在插件清单里：分组由使用安装器的人决定，
/// 不同插件装进来才不会各自开一个组。
/// </summary>
/// <param name="Kind">去向类型。</param>
/// <param name="GroupName">已有分组的 <c>NAME</c>（含内置键如 <c>__INTERACTIVE_PLUGINS__</c>），或新分组的标题。</param>
/// <param name="Position">仅新建分组时有效。</param>
public sealed record MenuChoice(
    MenuChoiceKind Kind,
    string? GroupName = null,
    Menu.MenuGroupPosition Position = Menu.MenuGroupPosition.First)
{
    public static MenuChoice Existing(string groupKey) => new(MenuChoiceKind.ExistingGroup, groupKey);

    public static MenuChoice New(string name, Menu.MenuGroupPosition position = Menu.MenuGroupPosition.First) =>
        new(MenuChoiceKind.NewGroup, name, position);

    public static MenuChoice Skip { get; } = new(MenuChoiceKind.None);
}

/// <summary>计划复制的一个条目。</summary>
public sealed record PlannedFile(string SourcePath, string TargetPath, string RelativePath, bool Overwrites);

/// <summary>
/// 自定义右键菜单分组的规划结果。
/// <para><see cref="BaseMenus"/> 是安装前目标里"实际生效"的 MENUS（来自 default.toml，
/// 或被用户配置覆盖），<see cref="FinalMenus"/> 是把本插件加进自定义分组之后、准备整段写回
/// <c>settings.user.toml</c> 的内容。</para>
/// </summary>
public sealed record MenuPlan(
    string Title,
    IReadOnlyList<Menu.MenuGroup> BaseMenus,
    IReadOnlyList<Menu.MenuGroup> FinalMenus,
    string BaseSource,
    int GroupIndex,
    bool GroupCreated);

/// <summary>执行前的完整计划（dry-run 展示的就是它）。</summary>
public sealed class InstallPlan
{
    public required Manifest.InstallManifest Manifest { get; init; }

    public required string SourceDirectory { get; init; }

    /// <summary>核心文件根目录（已解析为绝对路径）。</summary>
    public required string ContentDirectory { get; init; }

    public required string TargetPluginDirectory { get; init; }

    /// <summary>将要改写的 settings 文件（等价于运行时 <c>getUserTomlPath()</c> 的结果）。</summary>
    public required string SettingsPath { get; init; }

    public required bool SettingsFileExists { get; init; }

    /// <summary>settings 文件来自用户目录（~/.config/typora_plugin）还是插件目录。</summary>
    public required bool SettingsFromUserProfile { get; init; }

    public required IReadOnlyList<PlannedFile> Files { get; init; }

    public required IReadOnlyList<string> Warnings { get; init; }

    /// <summary>自定义右键菜单分组的规划；<c>[menu] mode</c> 不是 <c>group</c> 时为 null。</summary>
    public MenuPlan? Menu { get; init; }

    /// <summary>插件入口是否已存在于目标目录。</summary>
    public required bool EntryAlreadyPresent { get; init; }
}

/// <summary>执行结果。</summary>
public sealed class InstallResult
{
    public required InstallPlan Plan { get; init; }

    public required IReadOnlyList<string> Log { get; init; }

    public required IReadOnlyList<string> CopiedFiles { get; init; }

    public required IReadOnlyList<Toml.KeyChange> SettingsChanges { get; init; }

    public bool DryRun { get; init; }

    public string? SettingsBackupPath { get; init; }
}

/// <summary>安装流程中可预期的失败（UI 直接展示 message 即可）。</summary>
public sealed class InstallException : Exception
{
    public InstallException(string message) : base(message)
    {
    }
}
