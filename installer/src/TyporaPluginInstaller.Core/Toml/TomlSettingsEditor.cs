using System.Text;

namespace TyporaPluginInstaller.Core.Toml;

/// <summary>写入策略。</summary>
public enum KeyWritePolicy
{
    /// <summary>总是覆盖。</summary>
    SetAlways,

    /// <summary>键不存在时才写入。</summary>
    SetIfMissing,

    /// <summary>键不存在，或现有值为空字符串时才写入。</summary>
    SetIfMissingOrEmpty,

    /// <summary>键不存在，或现有值与目标值不同时才写入。</summary>
    SetIfDifferent,
}

/// <summary>一条待写入的配置项。</summary>
public sealed record KeyWrite(string Key, object? Value, KeyWritePolicy Policy = KeyWritePolicy.SetIfMissing);

/// <summary>一次写入结果的描述，用于日志/UI 展示。</summary>
public sealed record KeyChange(string Section, string Key, string? OldRaw, string NewRaw, bool Inserted)
{
    public override string ToString() =>
        Inserted
            ? $"[{Section}] 新增 {Key} = {NewRaw}"
            : $"[{Section}] {Key}: {OldRaw} → {NewRaw}";
}

/// <summary>
/// 针对 <c>settings.user.toml</c> 的"最小侵入"行级编辑器。
/// <para>它是<strong>编辑器而不是解析器</strong>：只定位目标 section 内的目标键，
/// 其余行（注释、空行、顺序、其它插件配置）原样保留；数组表 <c>[[...]]</c> 与嵌套 section
/// 都会被当作"下一个 section 的起点"，不会被误改。</para>
/// </summary>
public sealed class TomlSettingsEditor
{
    private readonly List<string> _lines;
    private readonly string _newline;
    private readonly List<KeyChange> _changes = new();

    public TomlSettingsEditor(string? text)
    {
        text ??= string.Empty;
        _newline = text.Contains("\r\n", StringComparison.Ordinal) ? "\r\n" : "\n";
        _lines = text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n').ToList();
    }

    public bool IsDirty => _changes.Count > 0;

    public IReadOnlyList<KeyChange> Changes => _changes;

    public string Text => string.Join(_newline, _lines);

    /// <summary>读取某个 section 下某个键的原始文本（不含注释）；不存在返回 null。</summary>
    public string? GetRawValue(string section, string key)
    {
        if (!TryFindSection(section, out var header, out var end))
        {
            return null;
        }

        for (var i = header + 1; i < end; i++)
        {
            if (TryMatchKey(_lines[i], key, out _, out var raw))
            {
                return raw;
            }
        }
        return null;
    }

    /// <summary>按顺序应用一批写入；同一 section 缺失时只创建一次。</summary>
    public void Apply(string section, IEnumerable<KeyWrite> writes)
    {
        var pending = new List<KeyWrite>();

        if (!TryFindSection(section, out var header, out var end))
        {
            // section 不存在：整段追加到文件末尾。
            foreach (var write in writes)
            {
                pending.Add(write);
            }

            TrimTrailingBlankLines();
            if (_lines.Count > 0 && _lines[^1].Length != 0)
            {
                _lines.Add(string.Empty);
            }
            _lines.Add($"[{section}]");
            foreach (var write in pending)
            {
                _lines.Add($"{write.Key} = {TomlTable.FormatValue(write.Value)}");
                _changes.Add(new KeyChange(section, write.Key, null, TomlTable.FormatValue(write.Value), true));
            }
            return;
        }

        foreach (var write in writes)
        {
            var targetLine = -1;
            string? oldRaw = null;
            for (var i = header + 1; i < end; i++)
            {
                if (TryMatchKey(_lines[i], write.Key, out _, out var raw))
                {
                    targetLine = i;
                    oldRaw = raw;
                    break;
                }
            }

            var formatted = TomlTable.FormatValue(write.Value);
            var shouldWrite = write.Policy switch
            {
                KeyWritePolicy.SetAlways => true,
                KeyWritePolicy.SetIfMissing => targetLine < 0,
                KeyWritePolicy.SetIfMissingOrEmpty => targetLine < 0 || IsEmptyValue(oldRaw),
                KeyWritePolicy.SetIfDifferent => targetLine < 0 || !string.Equals(NormalizeRaw(oldRaw), formatted, StringComparison.Ordinal),
                _ => true,
            };

            if (!shouldWrite)
            {
                continue;
            }

            if (targetLine >= 0)
            {
                var indent = LeadingWhitespace(_lines[targetLine]);
                _lines[targetLine] = $"{indent}{write.Key} = {formatted}";
                _changes.Add(new KeyChange(section, write.Key, oldRaw, formatted, false));
            }
            else
            {
                pending.Add(write);
                _changes.Add(new KeyChange(section, write.Key, null, formatted, true));
            }
        }

        if (pending.Count == 0)
        {
            return;
        }

        // 插到 section 正文的最后一行之后（跳过尾部空行）。
        var insertAt = end;
        while (insertAt - 1 > header && _lines[insertAt - 1].Trim().Length == 0)
        {
            insertAt--;
        }
        _lines.InsertRange(insertAt, pending.Select(w => $"{w.Key} = {TomlTable.FormatValue(w.Value)}"));
    }

    /// <summary>原子写回文件，并先生成 <c>*.bak</c> 备份。</summary>
    public void Save(string path, bool createBackup = true)
    {
        var text = Text;
        if (text.Length > 0 && !text.EndsWith(_newline, StringComparison.Ordinal))
        {
            text += _newline;
        }
        SaveText(path, text, createBackup);
    }

    /// <summary>
    /// 把已经构造好的文本原子写回文件（先备份）。
    /// 供"先用本编辑器改标量、再用其它编解码器改数组表"的流程复用。
    /// </summary>
    public static void SaveText(string path, string text, bool createBackup = true)
    {
        var directory = Path.GetDirectoryName(Path.GetFullPath(path));
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        if (createBackup && File.Exists(path))
        {
            File.Copy(path, path + ".bak", overwrite: true);
        }

        var temp = path + ".tmp";
        // UTF-8 无 BOM：与仓库里的 TOML 文件保持一致。
        File.WriteAllText(temp, text, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
        File.Move(temp, path, overwrite: true);
    }

    private static string NormalizeRaw(string? raw) => raw?.Trim() ?? string.Empty;

    /// <summary>判断一个原始值是否"空"：缺失、空串，或 TOML 里的空字符串字面量 "" / ''。</summary>
    private static bool IsEmptyValue(string? raw)
    {
        var value = NormalizeRaw(raw);
        return value.Length == 0 || value is "\"\"" or "''";
    }

    private static string LeadingWhitespace(string line)
    {
        var i = 0;
        while (i < line.Length && (line[i] == ' ' || line[i] == '\t'))
        {
            i++;
        }
        return line[..i];
    }

    /// <summary>判断一行是否 `KEY = value`（可带引号键名与缩进），并返回原始值文本。</summary>
    private static bool TryMatchKey(string line, string key, out string matchedKey, out string rawValue)
    {
        matchedKey = string.Empty;
        rawValue = string.Empty;

        var trimmed = line.TrimStart();
        if (trimmed.Length == 0 || trimmed[0] is '#' or '[')
        {
            return false;
        }

        var eq = trimmed.IndexOf('=');
        if (eq <= 0)
        {
            return false;
        }

        var candidate = trimmed[..eq].Trim().Trim('"', '\'');
        if (!string.Equals(candidate, key, StringComparison.Ordinal))
        {
            return false;
        }

        matchedKey = candidate;
        var rest = trimmed[(eq + 1)..];
        var hash = rest.IndexOf('#');
        if (hash >= 0)
        {
            rest = rest[..hash];
        }
        rawValue = rest.Trim();
        return true;
    }

    /// <summary>定位 section 头行号与其正文结束行号（不含下一个 section 头）。</summary>
    private bool TryFindSection(string section, out int header, out int end)
    {
        header = -1;
        end = _lines.Count;

        for (var i = 0; i < _lines.Count; i++)
        {
            var trimmed = _lines[i].Trim();
            if (trimmed.Length == 0 || trimmed[0] != '[')
            {
                continue;
            }

            var isHeader = trimmed.StartsWith('[') && !trimmed.StartsWith("[[", StringComparison.Ordinal);
            var name = isHeader && trimmed.EndsWith(']')
                ? trimmed[1..^1].Trim()
                : null;

            if (header < 0)
            {
                if (isHeader && string.Equals(name, section, StringComparison.Ordinal))
                {
                    header = i;
                }
                continue;
            }

            // 已经找到目标 section，这一行是下一个 section 头（或数组表）→ 正文到此为止。
            end = i;
            return true;
        }

        return header >= 0;
    }

    private void TrimTrailingBlankLines()
    {
        while (_lines.Count > 0 && _lines[^1].Trim().Length == 0)
        {
            _lines.RemoveAt(_lines.Count - 1);
        }
    }
}
