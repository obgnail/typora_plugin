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
}

/// <summary>计划复制的一个条目。</summary>
public sealed record PlannedFile(string SourcePath, string TargetPath, string RelativePath, bool Overwrites);

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
