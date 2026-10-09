using System.Globalization;
using System.Text;

namespace TyporaPluginInstaller.Core.Toml;

/// <summary>
/// 一个 TOML 表（<c>[section]</c> 或根）。只承载 installer.toml 需要的简单值类型：
/// string / bool / long / double / List&lt;string&gt;。
/// </summary>
public sealed class TomlTable
{
    private readonly Dictionary<string, object?> _values = new(StringComparer.Ordinal);

    public IReadOnlyDictionary<string, object?> Values => _values;

    public IEnumerable<string> Keys => _values.Keys;

    public bool Has(string key) => _values.ContainsKey(key);

    public object? Get(string key) => _values.TryGetValue(key, out var value) ? value : null;

    public void Set(string key, object? value) => _values[key] = value;

    /// <summary>读取字符串；键不存在或类型不符时返回 <paramref name="fallback"/>。</summary>
    public string? GetString(string key, string? fallback = null) => Get(key) as string ?? fallback;

    /// <summary>读取字符串并去掉首尾空白；空串按缺失处理。</summary>
    public string GetTrimmedString(string key, string fallback = "")
    {
        var value = GetString(key);
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    public bool GetBool(string key, bool fallback) => Get(key) is bool value ? value : fallback;

    /// <summary>读取数字；整数与浮点都接受。</summary>
    public double? GetNumber(string key) => Get(key) switch
    {
        long l => l,
        double d => d,
        _ => null,
    };

    /// <summary>读取字符串数组；标量字符串会被当成单元素数组，缺失返回空数组。</summary>
    public IReadOnlyList<string> GetStringArray(string key) => Get(key) switch
    {
        List<string> list => list,
        string single when single.Length > 0 => new[] { single },
        _ => Array.Empty<string>(),
    };

    /// <summary>把值格式化为 TOML 字面量（用于写回 settings.user.toml）。</summary>
    public static string FormatValue(object? value) => value switch
    {
        null => "\"\"",
        bool b => b ? "true" : "false",
        long l => l.ToString(CultureInfo.InvariantCulture),
        int i => i.ToString(CultureInfo.InvariantCulture),
        double d => d.ToString("R", CultureInfo.InvariantCulture),
        string s => FormatString(s),
        IEnumerable<string> items => "[" + string.Join(", ", items.Select(FormatString)) + "]",
        _ => FormatString(value.ToString() ?? string.Empty),
    };

    public static string FormatString(string value)
    {
        var sb = new StringBuilder(value.Length + 2);
        sb.Append('"');
        foreach (var ch in value)
        {
            switch (ch)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (ch < 0x20)
                    {
                        sb.Append("\\u").Append(((int)ch).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else
                    {
                        sb.Append(ch);
                    }
                    break;
            }
        }
        sb.Append('"');
        return sb.ToString();
    }
}

/// <summary>解析后的 TOML 文档：根表 + 具名 section。</summary>
public sealed class TomlDocument
{
    private readonly Dictionary<string, TomlTable> _sections = new(StringComparer.Ordinal);

    public TomlTable Root { get; } = new();

    public IEnumerable<string> SectionNames => _sections.Keys;

    public bool TryGetSection(string name, out TomlTable table)
    {
        var found = _sections.TryGetValue(name, out var value);
        table = value!;
        return found;
    }

    /// <summary>获取 section，不存在则创建空表（仅用于读取时的宽松处理）。</summary>
    public TomlTable GetOrCreateSection(string name)
    {
        if (!_sections.TryGetValue(name, out var table))
        {
            table = new TomlTable();
            _sections[name] = table;
        }
        return table;
    }
}
