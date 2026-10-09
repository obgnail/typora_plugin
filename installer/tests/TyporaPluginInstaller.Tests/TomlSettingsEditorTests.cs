using TyporaPluginInstaller.Core.Toml;
using Xunit;

namespace TyporaPluginInstaller.Tests;

public class TomlSettingsEditorTests
{
    [Fact]
    public void Creates_missing_section_and_keys()
    {
        var editor = new TomlSettingsEditor("# 用户配置\n");
        editor.Apply("myPlugin", new[]
        {
            new KeyWrite("ENABLE", true),
            new KeyWrite("NAME", "我的插件"),
        });

        var text = editor.Text;
        Assert.Contains("[myPlugin]", text);
        Assert.Contains("ENABLE = true", text);
        Assert.Contains("NAME = \"我的插件\"", text);
        Assert.True(editor.IsDirty);
        Assert.Equal(2, editor.Changes.Count(c => c.Inserted));
        // 原有注释必须保留
        Assert.Contains("# 用户配置", text);
    }

    [Fact]
    public void Inserts_keys_into_existing_section_without_touching_neighbours()
    {
        var editor = new TomlSettingsEditor("""
            [window_tab]
            ENABLE = true

            [myPlugin]
            ENABLE = true

            [commander]
            ENABLE = false
            """);

        editor.Apply("myPlugin", new[] { new KeyWrite("NAME", "插件") });
        var text = editor.Text;

        Assert.Contains("[myPlugin]\nENABLE = true\nNAME = \"插件\"\n\n[commander]", text);
        Assert.Contains("[commander]\nENABLE = false", text);
        Assert.Contains("[window_tab]\nENABLE = true", text);
    }

    [Fact]
    public void SetIfMissingOrEmpty_fills_empty_but_keeps_real_value()
    {
        var editor = new TomlSettingsEditor("[p]\nNAME = \"保留我\"\n");
        editor.Apply("p", new[] { new KeyWrite("NAME", "新名字", KeyWritePolicy.SetIfMissingOrEmpty) });
        Assert.False(editor.IsDirty);

        var editor2 = new TomlSettingsEditor("[p]\nNAME = \"\"\n");
        editor2.Apply("p", new[] { new KeyWrite("NAME", "新名字", KeyWritePolicy.SetIfMissingOrEmpty) });
        Assert.True(editor2.IsDirty);
        Assert.Contains("NAME = \"新名字\"", editor2.Text);
    }

    [Fact]
    public void SetIfDifferent_is_a_noop_when_value_already_matches()
    {
        var editor = new TomlSettingsEditor("[right_click_menu]\nFIND_LOST_PLUGINS = true\n");
        editor.Apply("right_click_menu", new[] { new KeyWrite("FIND_LOST_PLUGINS", true, KeyWritePolicy.SetIfDifferent) });
        Assert.False(editor.IsDirty);
    }

    [Fact]
    public void SetIfDifferent_overwrites_false_to_true()
    {
        var editor = new TomlSettingsEditor("[right_click_menu]\nFIND_LOST_PLUGINS = false\n");
        editor.Apply("right_click_menu", new[] { new KeyWrite("FIND_LOST_PLUGINS", true, KeyWritePolicy.SetIfDifferent) });
        Assert.True(editor.IsDirty);
        Assert.Contains("FIND_LOST_PLUGINS = true", editor.Text);
        Assert.DoesNotContain("FIND_LOST_PLUGINS = false", editor.Text);
    }

    [Fact]
    public void Array_of_tables_terminates_the_previous_section()
    {
        var editor = new TomlSettingsEditor("""
            [right_click_menu]
            FIND_LOST_PLUGINS = false

            [[right_click_menu.MENUS]]
            NAME = "G"
            LIST = ["a"]
            """);

        editor.Apply("right_click_menu", new[] { new KeyWrite("FIND_LOST_PLUGINS", true, KeyWritePolicy.SetIfDifferent) });
        var text = editor.Text;

        Assert.Contains("FIND_LOST_PLUGINS = true", text);
        // 新键不能被插到 [[...]] 之后
        var idxKey = text.IndexOf("FIND_LOST_PLUGINS = true", StringComparison.Ordinal);
        var idxArray = text.IndexOf("[[right_click_menu.MENUS]]", StringComparison.Ordinal);
        Assert.True(idxKey < idxArray);
    }

    [Fact]
    public void Preserves_crlf_line_endings()
    {
        var editor = new TomlSettingsEditor("[p]\r\nENABLE = true\r\n");
        editor.Apply("p", new[] { new KeyWrite("NAME", "x") });
        Assert.Contains("\r\n", editor.Text);
        Assert.DoesNotContain("\n\n", editor.Text.Replace("\r\n", "\n").Replace("\n", ""));
    }

    [Fact]
    public void Inline_comment_on_target_key_is_replaced_together()
    {
        var editor = new TomlSettingsEditor("[p]\nENABLE = false # 之前是关的\n");
        editor.Apply("p", new[] { new KeyWrite("ENABLE", true, KeyWritePolicy.SetIfDifferent) });
        Assert.DoesNotContain("false", editor.Text);
        Assert.Contains("ENABLE = true", editor.Text);
    }

    [Fact]
    public void GetRawValue_reads_existing_value()
    {
        var editor = new TomlSettingsEditor("[p]\nNAME = \"abc\" # c\n");
        Assert.Equal("\"abc\"", editor.GetRawValue("p", "NAME"));
        Assert.Null(editor.GetRawValue("p", "MISSING"));
        Assert.Null(editor.GetRawValue("nope", "NAME"));
    }

    [Fact]
    public void Save_creates_backup_and_writes_utf8_without_bom()
    {
        using var temp = new TempDir();
        var path = temp.Write("settings.user.toml", "[p]\nENABLE = false\n");

        var editor = new TomlSettingsEditor(File.ReadAllText(path));
        editor.Apply("p", new[] { new KeyWrite("ENABLE", true, KeyWritePolicy.SetIfDifferent) });
        editor.Save(path);

        Assert.True(File.Exists(path + ".bak"));
        Assert.Contains("ENABLE = true", File.ReadAllText(path));
        Assert.EndsWith("\n", File.ReadAllText(path));
        var bytes = File.ReadAllBytes(path);
        Assert.False(bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF);
        Assert.DoesNotContain(".tmp", string.Join(",", Directory.GetFiles(temp.Path).Select(Path.GetFileName)));
    }
}
