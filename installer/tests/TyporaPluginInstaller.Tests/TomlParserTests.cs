using TyporaPluginInstaller.Core.Toml;
using Xunit;

namespace TyporaPluginInstaller.Tests;

public class TomlParserTests
{
    [Fact]
    public void Parses_sections_and_scalar_values()
    {
        var document = TomlParser.Parse("""
            # 顶部注释
            [plugin]
            id = "helloWorld"
            name = 'Hello'
            version = "1.0.0"
            count = 3
            ratio = 1.5
            enabled = true

            [install]
            source = "core"
            """);

        var plugin = document.GetOrCreateSection("plugin");
        Assert.Equal("helloWorld", plugin.GetString("id"));
        Assert.Equal("Hello", plugin.GetString("name"));
        Assert.Equal("1.0.0", plugin.GetString("version"));
        Assert.Equal(3d, plugin.GetNumber("count"));
        Assert.Equal(1.5d, plugin.GetNumber("ratio"));
        Assert.True(plugin.GetBool("enabled", false));
        Assert.Equal("core", document.GetOrCreateSection("install").GetString("source"));
    }

    [Fact]
    public void Parses_multiline_string_arrays()
    {
        var document = TomlParser.Parse("""
            [install]
            files = [
              "a.js",   # 行内注释
              "assets/",
            ]
            """);

        Assert.Equal(new[] { "a.js", "assets/" }, document.GetOrCreateSection("install").GetStringArray("files"));
    }

    [Fact]
    public void Handles_escapes_and_hashes_inside_strings()
    {
        var document = TomlParser.Parse("""
            [plugin]
            name = "a \"quoted\" # value\nline2"
            """);

        Assert.Equal("a \"quoted\" # value\nline2", document.GetOrCreateSection("plugin").GetString("name"));
    }

    [Fact]
    public void Rejects_arrays_of_tables()
    {
        var error = Assert.Throws<TomlParseException>(() => TomlParser.Parse("[[files]]\nid = \"x\"\n"));
        Assert.Contains("[[", error.Message);
    }

    [Fact]
    public void Rejects_unterminated_string()
    {
        Assert.Throws<TomlParseException>(() => TomlParser.Parse("[plugin]\nid = \"oops\n"));
    }

    [Fact]
    public void Rejects_unknown_value_syntax()
    {
        Assert.Throws<TomlParseException>(() => TomlParser.Parse("[plugin]\nid = @nope\n"));
    }

    [Fact]
    public void Formats_values_back_to_toml()
    {
        Assert.Equal("true", TomlTable.FormatValue(true));
        Assert.Equal("42", TomlTable.FormatValue(42));
        Assert.Equal("\"a\\nb\"", TomlTable.FormatValue("a\nb"));
        Assert.Equal("[\"a\", \"b\"]", TomlTable.FormatValue(new[] { "a", "b" }));
    }
}
