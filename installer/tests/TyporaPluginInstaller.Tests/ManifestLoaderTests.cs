using TyporaPluginInstaller.Core.Manifest;
using Xunit;

namespace TyporaPluginInstaller.Tests;

public class ManifestLoaderTests
{
    private static string WriteManifest(TempDir temp, string content) => temp.Write("installer.toml", content);

    [Fact]
    public void Loads_a_complete_manifest()
    {
        using var temp = new TempDir();
        var path = WriteManifest(temp, """
            [plugin]
            id = "helloWorld"
            name = "Hello World"
            version = "1.2.3"
            description = "demo"
            author = "me"
            min_typora = "0.9.98"

            [install]
            source = "core"
            files = ["helloWorld.js", "assets/"]
            overwrite = false
            settings = false
            settings_overwrite = true

            [menu]
            mode = "none"

            [settings]
            GREETING = "hi"
            LEVEL = 3
            """);

        var manifest = ManifestLoader.Load(path);

        Assert.Equal("helloWorld", manifest.Id);
        Assert.Equal("Hello World", manifest.Name);
        Assert.Equal("1.2.3", manifest.Version);
        Assert.Equal("core", manifest.SourceDirectory);
        Assert.Equal(new[] { "helloWorld.js", "assets/" }, manifest.Files);
        Assert.False(manifest.Overwrite);
        Assert.False(manifest.WriteSettings);
        Assert.True(manifest.SettingsOverwrite);
        Assert.Equal(MenuMode.None, manifest.Menu);
        Assert.Equal("hi", manifest.Settings["GREETING"]);
        Assert.Equal(3L, manifest.Settings["LEVEL"]);
    }

    [Fact]
    public void Defaults_are_applied_when_optional_sections_are_absent()
    {
        using var temp = new TempDir();
        var path = WriteManifest(temp, "[plugin]\nid = \"p\"\nname = \"P\"\n");
        var manifest = ManifestLoader.Load(path);

        Assert.Equal(".", manifest.SourceDirectory);
        Assert.Empty(manifest.Files);
        Assert.True(manifest.Overwrite);
        Assert.True(manifest.WriteSettings);
        Assert.False(manifest.SettingsOverwrite);
        Assert.Equal(MenuMode.Group, manifest.Menu);
    }

    [Theory]
    [InlineData("[plugin]\nname = \"P\"\n", "缺少必填项 id")]
    [InlineData("[plugin]\nid = \"1bad\"\nname = \"P\"\n", "id 非法")]
    [InlineData("[plugin]\nid = \"has-dash\"\nname = \"P\"\n", "id 非法")]
    [InlineData("[plugin]\nid = \"p\"\n", "缺少必填项 name")]
    public void Rejects_invalid_required_fields(string content, string expectedFragment)
    {
        using var temp = new TempDir();
        var path = WriteManifest(temp, content);
        var error = Assert.Throws<ManifestException>(() => ManifestLoader.Load(path));
        Assert.Contains(expectedFragment, error.Message);
    }

    [Fact]
    public void Rejects_unknown_menu_mode()
    {
        using var temp = new TempDir();
        var path = WriteManifest(temp, "[plugin]\nid=\"p\"\nname=\"P\"\n[menu]\nmode = \"whatever\"\n");
        var error = Assert.Throws<ManifestException>(() => ManifestLoader.Load(path));
        Assert.Contains("[menu] mode", error.Message);
    }

    [Theory]
    [InlineData("[plugin]\nid=\"p\"\nname=\"P\"\n[menu]\ngroup = \"我的插件\"\n", "不允许指定 group")]
    [InlineData("[plugin]\nid=\"p\"\nname=\"P\"\n[menu]\nposition = \"last\"\n", "不允许指定 position")]
    public void Rejects_installer_owned_menu_fields(string content, string expectedFragment)
    {
        using var temp = new TempDir();
        var path = WriteManifest(temp, content);
        var error = Assert.Throws<ManifestException>(() => ManifestLoader.Load(path));
        Assert.Contains(expectedFragment, error.Message);
    }

    [Fact]
    public void Rejects_reserved_settings_keys()
    {
        using var temp = new TempDir();
        var path = WriteManifest(temp, "[plugin]\nid=\"p\"\nname=\"P\"\n[settings]\nENABLE = false\n");
        var error = Assert.Throws<ManifestException>(() => ManifestLoader.Load(path));
        Assert.Contains("保留键", error.Message);
    }

    [Fact]
    public void Missing_file_reports_clear_error()
    {
        using var temp = new TempDir();
        var error = Assert.Throws<ManifestException>(() => ManifestLoader.Load(Path.Combine(temp.Path, "nope.toml")));
        Assert.Contains("找不到安装清单", error.Message);
    }
}
