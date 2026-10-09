using System.Text.Json;

namespace TyporaPluginInstaller.Core.Menu;

/// <summary>
/// 分组标题与本地化。
///
/// <para>内置分组的 <c>NAME</c>（如 <c>__VISUAL_PLUGINS__</c>）是 i18n 键，真实译名在目标的
/// <c>plugin/global/locales/*.json</c> 里。安装器直接从目标目录读这些文件，所以无论那个目录
/// 被怎么改过，选择列表里显示的名字都和 Typora 里实际看到的一致 —— 不依赖任何内置硬编码表。</para>
/// </summary>
public static class MenuTitles
{
    private const string LocalesRelativePath = "global/locales";

    /// <summary>安装器给"新建分组"的默认名字，按目标语言选择。</summary>
    public static string SuggestedGroupName(string locale) => Normalize(locale) switch
    {
        "zh-TW" => "自訂外掛",
        "zh-CN" => "自定义插件",
        _ => "Custom Plugins",
    };

    /// <summary>把任意区域名收敛到插件系统支持的三种之一。</summary>
    public static string Normalize(string? locale)
    {
        var value = (locale ?? string.Empty).Replace('_', '-');
        if (value.StartsWith("zh-TW", StringComparison.OrdinalIgnoreCase) ||
            value.StartsWith("zh-Hant", StringComparison.OrdinalIgnoreCase) ||
            value.StartsWith("zh-HK", StringComparison.OrdinalIgnoreCase))
        {
            return "zh-TW";
        }
        return value.StartsWith("zh", StringComparison.OrdinalIgnoreCase) ? "zh-CN" : "en";
    }

    /// <summary>
    /// 读目标 <c>global/locales/&lt;locale&gt;.json</c> 的 <c>settings</c> 段。
    /// 文件缺失或格式异常时返回空表（调用方回退到原始 NAME）。
    /// </summary>
    public static IReadOnlyDictionary<string, string> LoadSettingsTitles(string targetPluginDirectory, string locale)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        var directory = Path.Combine(targetPluginDirectory, LocalesRelativePath.Replace('/', Path.DirectorySeparatorChar));

        foreach (var name in new[] { Normalize(locale), "en" })
        {
            var file = Path.Combine(directory, name + ".json");
            if (!File.Exists(file))
            {
                continue;
            }

            try
            {
                using var document = JsonDocument.Parse(File.ReadAllText(file));
                if (!document.RootElement.TryGetProperty("settings", out var settings) ||
                    settings.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                foreach (var property in settings.EnumerateObject())
                {
                    if (property.Value.ValueKind == JsonValueKind.String)
                    {
                        result[property.Name] = property.Value.GetString() ?? property.Name;
                    }
                }
                return result;
            }
            catch (JsonException)
            {
                // 语言文件坏了不该让安装失败 —— 回退到原始 NAME。
            }
        }

        return result;
    }

    /// <summary>取分组的显示名；查不到就原样用 NAME。</summary>
    public static string DisplayTitle(string key, IReadOnlyDictionary<string, string> titles) =>
        titles.TryGetValue(key, out var title) && !string.IsNullOrWhiteSpace(title) ? title : key;
}
