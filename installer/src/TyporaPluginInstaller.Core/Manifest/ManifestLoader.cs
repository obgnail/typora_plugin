using System.Text.RegularExpressions;
using TyporaPluginInstaller.Core.Toml;

namespace TyporaPluginInstaller.Core.Manifest;

/// <summary>读取并校验 installer.toml。</summary>
public static partial class ManifestLoader
{
    [GeneratedRegex(@"^[A-Za-z_][A-Za-z0-9_]*$")]
    private static partial Regex IdPattern();

    public static InstallManifest Load(string manifestPath)
    {
        if (!File.Exists(manifestPath))
        {
            throw new ManifestException($"找不到安装清单：{manifestPath}");
        }

        var text = File.ReadAllText(manifestPath);
        TomlDocument document;
        try
        {
            document = TomlParser.Parse(text, manifestPath);
        }
        catch (TomlParseException e)
        {
            throw new ManifestException($"installer.toml 解析失败：{e.Message}");
        }

        if (!document.TryGetSection("plugin", out var plugin))
        {
            throw new ManifestException("installer.toml 缺少 [plugin] 段。");
        }

        var id = plugin.GetTrimmedString("id");
        if (id.Length == 0)
        {
            throw new ManifestException("[plugin] 缺少必填项 id。");
        }

        if (!IdPattern().IsMatch(id))
        {
            throw new ManifestException($"[plugin] id 非法：'{id}'。只允许字母/数字/下划线，且不能以数字开头（它同时是文件名与 TOML 键名）。");
        }

        var name = plugin.GetTrimmedString("name");
        if (name.Length == 0)
        {
            throw new ManifestException("[plugin] 缺少必填项 name（它会写进 NAME，并作为右键菜单标题）。");
        }

        var install = document.TryGetSection("install", out var installTable) ? installTable : new TomlTable();
        var menuTable = document.TryGetSection("menu", out var menu) ? menu : new TomlTable();

        var menuMode = menuTable.GetTrimmedString("mode", "auto").ToLowerInvariant() switch
        {
            "auto" => MenuMode.Auto,
            "none" => MenuMode.None,
            var other => throw new ManifestException($"[menu] mode 只支持 \"auto\" 或 \"none\"，收到 \"{other}\"。"),
        };

        var settings = new Dictionary<string, object?>(StringComparer.Ordinal);
        if (document.TryGetSection("settings", out var settingsTable))
        {
            foreach (var (key, value) in settingsTable.Values)
            {
                if (key is "ENABLE" or "NAME")
                {
                    throw new ManifestException($"[settings] 不允许覆盖保留键 {key}（ENABLE 恒为 true，NAME 取自 [plugin].name）。");
                }
                settings[key] = value;
            }
        }

        return new InstallManifest
        {
            Id = id,
            Name = name,
            Version = plugin.GetTrimmedString("version", null!),
            Description = plugin.GetTrimmedString("description", null!),
            Author = plugin.GetTrimmedString("author", null!),
            Homepage = plugin.GetTrimmedString("homepage", null!),
            MinTypora = plugin.GetTrimmedString("min_typora", null!),
            SourceDirectory = install.GetTrimmedString("source", "."),
            Files = install.GetStringArray("files"),
            Overwrite = install.GetBool("overwrite", true),
            WriteSettings = install.GetBool("settings", true),
            SettingsOverwrite = install.GetBool("settings_overwrite", false),
            Menu = menuMode,
            Settings = settings,
            ManifestPath = Path.GetFullPath(manifestPath),
        };
    }
}
