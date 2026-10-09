using TyporaPluginInstaller.Core.Menu;
using Xunit;

namespace TyporaPluginInstaller.Tests;

public class MenuArrayCodecTests
{
    private const string Sample = """
        # 顶部注释
        [global]
        ENABLE = true

        [right_click_menu]
        ENABLE = true
        FIND_LOST_PLUGINS = false

        [[right_click_menu.MENUS]]
        NAME = "__VISUAL_PLUGINS__"
        LIST = [
          "static_markers",   # 行内注释
          "auto_number",
        ]

        [[right_click_menu.MENUS]]
        NAME = "__INTERACTIVE_PLUGINS__"
        LIST = ["window_tab", "commander"]

        [other]
        KEY = "keep me"
        """;

    [Fact]
    public void Extracts_array_of_tables_including_multiline_lists()
    {
        var groups = MenuArrayCodec.Extract(Sample);

        Assert.Equal(2, groups.Count);
        Assert.Equal("__VISUAL_PLUGINS__", groups[0].Name);
        Assert.Equal(new[] { "static_markers", "auto_number" }, groups[0].List);
        Assert.Equal("__INTERACTIVE_PLUGINS__", groups[1].Name);
        Assert.Equal(new[] { "window_tab", "commander" }, groups[1].List);
    }

    [Fact]
    public void Extraction_is_empty_when_the_table_is_absent()
    {
        Assert.Empty(MenuArrayCodec.Extract("[global]\nENABLE = true\n"));
    }

    [Fact]
    public void Detects_the_inline_assignment_form_only()
    {
        Assert.True(MenuArrayCodec.HasInlineAssignment("[right_click_menu]\nMENUS = [{ NAME = \"x\", LIST = [] }]\n"));
        Assert.False(MenuArrayCodec.HasInlineAssignment(Sample));
        // 别的 section 里的同名键不算
        Assert.False(MenuArrayCodec.HasInlineAssignment("[other]\nMENUS = []\n"));
    }

    [Fact]
    public void Replace_round_trips_and_keeps_the_rest_of_the_file()
    {
        var groups = new[]
        {
            new MenuGroup("自定义插件", new[] { "tagora.call" }),
            new MenuGroup("__VISUAL_PLUGINS__", new[] { "static_markers" }),
        };

        var result = MenuArrayCodec.Replace(Sample, groups);

        Assert.True(MenuArrayCodec.SameGroups(groups, MenuArrayCodec.Extract(result)));
        // 其它 section 与注释原样保留
        Assert.Contains("# 顶部注释", result);
        Assert.Contains("[other]", result);
        Assert.Contains("KEY = \"keep me\"", result);
        Assert.Contains("FIND_LOST_PLUGINS = false", result);
        // 分组块必须在 [right_click_menu] 的标量之后，否则 TOML 会把它们算进数组表的元素里
        Assert.True(result.IndexOf("FIND_LOST_PLUGINS", StringComparison.Ordinal) <
                    result.IndexOf("[[right_click_menu.MENUS]]", StringComparison.Ordinal));
    }

    [Fact]
    public void Replace_removes_the_inline_assignment_form()
    {
        var text = "[right_click_menu]\nMENUS = [{ NAME = \"x\", LIST = [\"a\"] }]\nFIND_LOST_PLUGINS = true\n";
        var groups = new[] { new MenuGroup("自定义插件", new[] { "tagora.call" }) };

        var result = MenuArrayCodec.Replace(text, groups);

        Assert.False(MenuArrayCodec.HasInlineAssignment(result));
        Assert.DoesNotContain("MENUS = [", result);
        Assert.True(MenuArrayCodec.SameGroups(groups, MenuArrayCodec.Extract(result)));
        Assert.Contains("FIND_LOST_PLUGINS = true", result);
    }

    [Fact]
    public void Replace_also_removes_a_multiline_inline_assignment()
    {
        var text = "[right_click_menu]\nMENUS = [\n  { NAME = \"x\", LIST = [\"a\"] },\n]\n";
        var groups = new[] { new MenuGroup("G", new[] { "p" }) };

        var result = MenuArrayCodec.Replace(text, groups);

        Assert.DoesNotContain("{ NAME", result);
        Assert.True(MenuArrayCodec.SameGroups(groups, MenuArrayCodec.Extract(result)));
    }

    [Fact]
    public void Replace_preserves_crlf()
    {
        var result = MenuArrayCodec.Replace("[global]\r\nENABLE = true\r\n", new[] { new MenuGroup("G", new[] { "p" }) });
        Assert.Contains("\r\n", result);
        // 不能出现裸 LF
        Assert.DoesNotContain("\n", result.Replace("\r\n", string.Empty));
    }

    [Fact]
    public void Replace_creates_missing_sections_and_ends_with_a_newline()
    {
        var result = MenuArrayCodec.Replace("", new[] { new MenuGroup("G", new[] { "p.call" }) });

        Assert.StartsWith("[[right_click_menu.MENUS]]", result);
        Assert.EndsWith("\n", result);
        Assert.True(MenuArrayCodec.SameGroups(
            new[] { new MenuGroup("G", new[] { "p.call" }) },
            MenuArrayCodec.Extract(result)));
    }

    [Fact]
    public void Quoted_names_with_escapes_survive_the_round_trip()
    {
        var groups = new[] { new MenuGroup("A \"quoted\" name", new[] { "p" }) };
        var result = MenuArrayCodec.Replace("", groups);
        Assert.True(MenuArrayCodec.SameGroups(groups, MenuArrayCodec.Extract(result)));
    }
}
