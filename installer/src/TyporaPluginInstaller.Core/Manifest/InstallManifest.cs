namespace TyporaPluginInstaller.Core.Manifest;

/// <summary>
/// 插件清单能对右键菜单表达的全部意愿：<b>要不要</b>上菜单。
/// <para>"放到哪个分组"完全由安装器在安装时决定，插件无权过问 —— 所以这里没有
/// <c>group</c> / <c>position</c> 之类的字段。</para>
/// </summary>
public enum MenuMode
{
    /// <summary>上菜单（默认）。具体分组由安装器选择。</summary>
    Group,

    /// <summary>不注册菜单（插件仍会被加载，只是不出现在右键菜单里）。</summary>
    None,
}

/// <summary>installer.toml 的强类型模型。</summary>
public sealed class InstallManifest
{
    /// <summary>用于安装的清单文件名（放在插件包根目录）。</summary>
    public const string FileName = "installer.toml";

    /// <summary>固定名：同时是 <c>plugin/&lt;id&gt;.js</c> / <c>plugin/&lt;id&gt;/</c> 与 settings 段名。</summary>
    public required string Id { get; init; }

    /// <summary>显示名：写入 <c>NAME</c>，也是右键菜单里的标题。</summary>
    public required string Name { get; init; }

    public string? Version { get; init; }

    public string? Description { get; init; }

    public string? Author { get; init; }

    public string? Homepage { get; init; }

    public string? MinTypora { get; init; }

    /// <summary>核心文件所在目录（相对 installer.toml）。</summary>
    public string SourceDirectory { get; init; } = ".";

    /// <summary>显式要复制的条目（相对 <see cref="SourceDirectory"/>）；为空表示整目录复制。</summary>
    public IReadOnlyList<string> Files { get; init; } = Array.Empty<string>();

    /// <summary>目标已存在同名文件时是否覆盖。</summary>
    public bool Overwrite { get; init; } = true;

    /// <summary>是否写入 <c>settings.user.toml</c>。</summary>
    public bool WriteSettings { get; init; } = true;

    /// <summary>写入 settings 时是否覆盖用户已有的同名配置值（ENABLE 恒为 true，不受此开关影响）。</summary>
    public bool SettingsOverwrite { get; init; }

    public MenuMode Menu { get; init; } = MenuMode.Group;

    /// <summary>额外写入 <c>[&lt;id&gt;]</c> 的配置项。</summary>
    public IReadOnlyDictionary<string, object?> Settings { get; init; } =
        new Dictionary<string, object?>(StringComparer.Ordinal);

    /// <summary>清单文件自身的绝对路径（由 loader 填充）。</summary>
    public string ManifestPath { get; init; } = string.Empty;
}

/// <summary>清单缺失或非法。</summary>
public sealed class ManifestException : Exception
{
    public ManifestException(string message) : base(message)
    {
    }
}
