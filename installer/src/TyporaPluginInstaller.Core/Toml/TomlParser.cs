using System.Globalization;
using System.Text;

namespace TyporaPluginInstaller.Core.Toml;

/// <summary>installer.toml 解析失败。</summary>
public sealed class TomlParseException : Exception
{
    public TomlParseException(string message, int line) : base($"{message} (第 {line} 行)") => Line = line;

    public int Line { get; }
}

/// <summary>
/// 极简 TOML 解析器：只覆盖 installer.toml 用得到的子集。
/// <para>支持：注释、<c>[section]</c>、<c>key = value</c>，值类型为字符串（含转义）、字面量字符串、
/// 布尔、整数、浮点、以及（可跨行的）字符串数组。根层键会进入 <see cref="TomlDocument.Root"/>。</para>
/// <para>不支持：<c>[[array of tables]]</c>、内联表、日期时间。遇到即抛出带行号的
/// <see cref="TomlParseException"/>，避免"看起来装好了其实配置没读到"。</para>
/// </summary>
public static class TomlParser
{
    public static TomlDocument Parse(string text, string sourceName = "installer.toml")
    {
        var document = new TomlDocument();
        var table = document.Root;
        var lines = text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');

        for (var i = 0; i < lines.Length; i++)
        {
            var raw = lines[i];
            var line = StripComment(raw).Trim();
            if (line.Length == 0)
            {
                continue;
            }

            if (line.StartsWith("[[", StringComparison.Ordinal))
            {
                throw new TomlParseException($"不支持数组表（[[...]]）：{line}", i + 1);
            }

            if (line.StartsWith('['))
            {
                if (!line.EndsWith(']'))
                {
                    throw new TomlParseException($"section 头缺少 ']'：{line}", i + 1);
                }

                var name = line[1..^1].Trim();
                if (name.Length == 0)
                {
                    throw new TomlParseException("section 名为空", i + 1);
                }

                table = document.GetOrCreateSection(name);
                continue;
            }

            var eq = IndexOfAssignment(line);
            if (eq < 0)
            {
                throw new TomlParseException($"不是合法的 `key = value`：{line}", i + 1);
            }

            var key = line[..eq].Trim().Trim('"');
            if (key.Length == 0)
            {
                throw new TomlParseException("键名为空", i + 1);
            }

            var valueText = line[(eq + 1)..].Trim();

            // 数组可以跨行：把后续行拼进来直到括号闭合。
            if (valueText.StartsWith('[') && !IsBalanced(valueText))
            {
                var buffer = new StringBuilder(valueText);
                var startLine = i + 1;
                while (!IsBalanced(buffer.ToString()))
                {
                    i++;
                    if (i >= lines.Length)
                    {
                        throw new TomlParseException($"数组未闭合（起始于第 {startLine} 行）", startLine);
                    }
                    buffer.Append('\n').Append(StripComment(lines[i]));
                }
                valueText = buffer.ToString().Trim();
            }

            table.Set(key, ParseValue(valueText, i + 1, sourceName));
        }

        return document;
    }

    /// <summary>找第一个不在字符串内的 '='。</summary>
    private static int IndexOfAssignment(string line)
    {
        var quote = '\0';
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (quote != '\0')
            {
                if (ch == '\\' && quote == '"')
                {
                    i++;
                }
                else if (ch == quote)
                {
                    quote = '\0';
                }
                continue;
            }

            if (ch is '"' or '\'')
            {
                quote = ch;
            }
            else if (ch == '=')
            {
                return i;
            }
        }
        return -1;
    }

    /// <summary>去掉行尾注释（不触碰字符串里的 '#')。</summary>
    internal static string StripComment(string line)
    {
        var quote = '\0';
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (quote != '\0')
            {
                if (ch == '\\' && quote == '"')
                {
                    i++;
                }
                else if (ch == quote)
                {
                    quote = '\0';
                }
                continue;
            }

            if (ch is '"' or '\'')
            {
                quote = ch;
            }
            else if (ch == '#')
            {
                return line[..i];
            }
        }
        return line;
    }

    internal static bool IsBalanced(string text)
    {
        var depth = 0;
        var quote = '\0';
        for (var i = 0; i < text.Length; i++)
        {
            var ch = text[i];
            if (quote != '\0')
            {
                if (ch == '\\' && quote == '"')
                {
                    i++;
                }
                else if (ch == quote)
                {
                    quote = '\0';
                }
                continue;
            }

            switch (ch)
            {
                case '"':
                case '\'':
                    quote = ch;
                    break;
                case '[':
                    depth++;
                    break;
                case ']':
                    depth--;
                    break;
            }
        }
        return depth <= 0 && quote == '\0';
    }

    private static object? ParseValue(string text, int line, string sourceName)
    {
        text = text.Trim();
        if (text.Length == 0)
        {
            throw new TomlParseException("值为空", line);
        }

        if (text[0] == '"')
        {
            return ParseBasicString(text, line);
        }

        if (text[0] == '\'')
        {
            var end = text.IndexOf('\'', 1);
            if (end < 0)
            {
                throw new TomlParseException("字面量字符串未闭合", line);
            }
            return text[1..end];
        }

        if (text.StartsWith('['))
        {
            return ParseStringArray(text, line);
        }

        if (text is "true" or "false")
        {
            return text == "true";
        }

        if (long.TryParse(text, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var l))
        {
            return l;
        }

        if (double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var d))
        {
            return d;
        }

        throw new TomlParseException($"无法识别的值（{sourceName}）：{text}", line);
    }

    internal static string ParseBasicString(string text, int line)
    {
        var sb = new StringBuilder();
        for (var i = 1; i < text.Length; i++)
        {
            var ch = text[i];
            if (ch == '\\')
            {
                i++;
                if (i >= text.Length)
                {
                    throw new TomlParseException("字符串转义未完成", line);
                }
                sb.Append(text[i] switch
                {
                    'n' => '\n',
                    'r' => '\r',
                    't' => '\t',
                    '"' => '"',
                    '\\' => '\\',
                    _ => text[i],
                });
                continue;
            }

            if (ch == '"')
            {
                return sb.ToString();
            }

            sb.Append(ch);
        }

        throw new TomlParseException("字符串未闭合", line);
    }

    internal static List<string> ParseStringArray(string text, int line)
    {
        var result = new List<string>();
        var i = text.IndexOf('[') + 1;
        while (i < text.Length)
        {
            while (i < text.Length && (char.IsWhiteSpace(text[i]) || text[i] == ','))
            {
                i++;
            }

            if (i >= text.Length)
            {
                break;
            }

            if (text[i] == ']')
            {
                return result;
            }

            if (text[i] == '"')
            {
                var sb = new StringBuilder();
                i++;
                var closed = false;
                while (i < text.Length)
                {
                    var ch = text[i];
                    if (ch == '\\')
                    {
                        i++;
                        sb.Append(text[i]);
                        i++;
                        continue;
                    }
                    if (ch == '"')
                    {
                        closed = true;
                        i++;
                        break;
                    }
                    sb.Append(ch);
                    i++;
                }
                if (!closed)
                {
                    throw new TomlParseException("数组中的字符串未闭合", line);
                }
                result.Add(sb.ToString());
                continue;
            }

            // 数组里允许出现非字符串标量，按原文本收进来（installer.toml 用不到，但不必报错）。
            var start = i;
            while (i < text.Length && text[i] != ',' && text[i] != ']')
            {
                i++;
            }
            result.Add(text[start..i].Trim());
        }

        throw new TomlParseException("数组未闭合", line);
    }
}
