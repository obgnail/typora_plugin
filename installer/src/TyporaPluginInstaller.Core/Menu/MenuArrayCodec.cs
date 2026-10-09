using TyporaPluginInstaller.Core.Toml;

namespace TyporaPluginInstaller.Core.Menu;

/// <summary>
/// 读写 <c>[[right_click_menu.MENUS]]</c> 数组表的纯文本编解码器。
///
/// <para><b>为什么是"纯文本编解码"而不是完整 TOML 解析：</b>
/// 目标的 <c>settings.default.toml</c> 有 3700 多行，含有行内表和多行字符串，
/// 为了取一个 MENUS 去实现完整 TOML 不划算，也更容易在别人改配置时崩掉。
/// 这里只做三件事：抽出 MENUS、删掉旧的 MENUS、写出新的 MENUS，其余内容原样保留。</para>
///
/// <para><b>为什么必须删干净：</b>TOML 里 <c>MENUS = [...]</c> 与
/// <c>[[right_click_menu.MENUS]]</c> 同时存在就是重复定义，整个 settings 文件会解析失败，
/// 而插件系统遇到解析失败会退回空配置、直接把自己关掉。所以写入前一定要保证
/// 只剩一种写法，并在写盘前用 <see cref="SameGroups"/> 复核。</para>
/// </summary>
public static class MenuArrayCodec
{
    public const string Section = "right_click_menu";
    public const string Key = "MENUS";

    public static string Header(string section, string key) => $"[[{section}.{key}]]";

    /// <summary>抽出 <c>[[section.key]]</c> 数组表；文件里没有该数组时返回空列表。</summary>
    public static IReadOnlyList<MenuGroup> Extract(string tomlText, string section = Section, string key = Key)
    {
        var groups = new List<MenuGroup>();
        var lines = SplitLines(tomlText);
        var header = Header(section, key);

        for (var i = 0; i < lines.Count; i++)
        {
            if (!string.Equals(TomlParser.StripComment(lines[i]).Trim(), header, StringComparison.Ordinal))
            {
                continue;
            }

            string? name = null;
            IReadOnlyList<string>? list = null;

            for (i++; i < lines.Count; i++)
            {
                var current = TomlParser.StripComment(lines[i]).Trim();
                if (current.StartsWith('['))
                {
                    i--;   // 交给外层循环重新判断这一行是不是下一个 [[...]]
                    break;
                }
                if (current.Length == 0)
                {
                    continue;
                }

                var eq = current.IndexOf('=');
                if (eq <= 0)
                {
                    continue;
                }

                var keyName = current[..eq].Trim();
                var value = current[(eq + 1)..].Trim();

                if (keyName == "NAME")
                {
                    name = ParseName(value, i + 1);
                }
                else if (keyName == "LIST")
                {
                    var buffer = value;
                    while (!TomlParser.IsBalanced(buffer) && i + 1 < lines.Count)
                    {
                        i++;
                        buffer += "\n" + TomlParser.StripComment(lines[i]);
                    }
                    list = TomlParser.ParseStringArray(buffer, i + 1);
                }
            }

            if (name != null)
            {
                groups.Add(new MenuGroup(name, list ?? Array.Empty<string>()));
            }
        }

        return groups;
    }

    /// <summary>
    /// <c>[section]</c> 里是否存在 <c>key = ...</c> 赋值。
    /// 这种写法（数组里嵌行内表）本编解码器读不了，调用方应当拒绝安装而不是覆盖掉它。
    /// </summary>
    public static bool HasInlineAssignment(string tomlText, string section = Section, string key = Key)
    {
        foreach (var (current, inSection) in WalkSectionLines(tomlText, section))
        {
            if (!inSection)
            {
                continue;
            }
            var eq = current.IndexOf('=');
            if (eq > 0 && current[..eq].Trim().Trim('"') == key)
            {
                return true;
            }
        }
        return false;
    }

    /// <summary>把 <c>[[section.key]]</c> 数组表整体替换成给定内容，并清掉旧的两种写法。</summary>
    public static string Replace(string tomlText, IReadOnlyList<MenuGroup> groups, string section = Section, string key = Key)
    {
        var newline = tomlText.Contains("\r\n", StringComparison.Ordinal) ? "\r\n" : "\n";
        var lines = SplitLines(tomlText);

        RemoveBlocks(lines, section, key);
        RemoveInlineAssignment(lines, section, key);
        TrimTrailingBlank(lines);

        if (lines.Count > 0 && lines[^1].Length != 0)
        {
            lines.Add(string.Empty);
        }
        lines.AddRange(Render(section, key, groups));
        TrimTrailingBlank(lines);

        return lines.Count == 0 ? string.Empty : string.Join(newline, lines) + newline;
    }

    public static IReadOnlyList<string> Render(string section, string key, IReadOnlyList<MenuGroup> groups)
    {
        var lines = new List<string>();
        foreach (var group in groups)
        {
            lines.Add(Header(section, key));
            lines.Add($"NAME = {TomlTable.FormatString(group.Name)}");
            lines.Add($"LIST = [{string.Join(", ", group.List.Select(TomlTable.FormatString))}]");
            lines.Add(string.Empty);
        }
        return lines;
    }

    public static bool SameGroups(IReadOnlyList<MenuGroup> left, IReadOnlyList<MenuGroup> right)
    {
        if (left.Count != right.Count)
        {
            return false;
        }
        for (var i = 0; i < left.Count; i++)
        {
            if (!string.Equals(left[i].Name, right[i].Name, StringComparison.Ordinal))
            {
                return false;
            }
            if (!left[i].List.SequenceEqual(right[i].List, StringComparer.Ordinal))
            {
                return false;
            }
        }
        return true;
    }

    // ------------------------------------------------------------------ helpers

    private static string ParseName(string value, int line) =>
        value.StartsWith('\'') ? value.Trim('\'') : TomlParser.ParseBasicString(value, line);

    /// <summary>逐行遍历，并标出该行是否位于 <c>[section]</c> 正文内（数组表不算）。</summary>
    private static IEnumerable<(string Line, bool InSection)> WalkSectionLines(string tomlText, string section)
    {
        var inSection = false;
        foreach (var raw in SplitLines(tomlText))
        {
            var current = TomlParser.StripComment(raw).Trim();
            if (current.StartsWith('['))
            {
                inSection = !current.StartsWith("[[", StringComparison.Ordinal)
                            && current.EndsWith(']')
                            && current[1..^1].Trim() == section;
                continue;
            }
            yield return (current, inSection);
        }
    }

    private static void RemoveBlocks(List<string> lines, string section, string key)
    {
        var header = Header(section, key);
        for (var i = 0; i < lines.Count;)
        {
            if (!string.Equals(lines[i].Trim(), header, StringComparison.Ordinal))
            {
                i++;
                continue;
            }

            lines.RemoveAt(i);
            while (i < lines.Count && !lines[i].TrimStart().StartsWith('['))
            {
                lines.RemoveAt(i);
            }
        }
    }

    private static void RemoveInlineAssignment(List<string> lines, string section, string key)
    {
        var inSection = false;
        for (var i = 0; i < lines.Count;)
        {
            var current = TomlParser.StripComment(lines[i]).Trim();
            if (current.StartsWith('['))
            {
                inSection = !current.StartsWith("[[", StringComparison.Ordinal)
                            && current.EndsWith(']')
                            && current[1..^1].Trim() == section;
                i++;
                continue;
            }

            var eq = current.IndexOf('=');
            if (!inSection || eq <= 0 || current[..eq].Trim().Trim('"') != key)
            {
                i++;
                continue;
            }

            // 值是（可能跨行的）数组：把它连同续行一起删掉。
            var accumulated = current[(eq + 1)..];
            lines.RemoveAt(i);
            while (!TomlParser.IsBalanced(accumulated) && i < lines.Count && !lines[i].TrimStart().StartsWith('['))
            {
                accumulated += "\n" + TomlParser.StripComment(lines[i]);
                lines.RemoveAt(i);
            }
        }
    }

    private static void TrimTrailingBlank(List<string> lines)
    {
        while (lines.Count > 0 && lines[^1].Trim().Length == 0)
        {
            lines.RemoveAt(lines.Count - 1);
        }
    }

    private static List<string> SplitLines(string text) =>
        text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n').ToList();
}
