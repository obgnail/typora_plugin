using TyporaPluginInstaller.Core.Install;
using TyporaPluginInstaller.Core.Manifest;
using Xunit;

namespace TyporaPluginInstaller.Tests;

public class InstallEngineTests
{
    private const string PluginJs = """
        class helloWorld extends BasePlugin {
          call = () => this.utils.notification.show("hi")
        }
        module.exports = { plugin: helloWorld }
        """;

    private static string CreateFakePluginDir(TempDir temp, string name = "target", string? userToml = null)
    {
        var dir = Path.Combine(temp.Path, name);
        Directory.CreateDirectory(Path.Combine(dir, "global", "settings"));
        File.WriteAllText(Path.Combine(dir, "global", "settings", "settings.default.toml"), "[global]\nENABLE = true\n");
        File.WriteAllText(Path.Combine(dir, "index.js"), "// plugin system entry\n");
        if (userToml != null)
        {
            File.WriteAllText(Path.Combine(dir, "global", "settings", "settings.user.toml"), userToml);
        }
        return dir;
    }

    private static string CreatePackage(
        TempDir temp,
        string id = "helloWorld",
        string fileName = "helloWorld.js",
        string? js = null,
        string installSection = "source = \"core\"",
        string menuSection = "mode = \"auto\"",
        string settingsSection = "")
    {
        var root = Path.Combine(temp.Path, "package");
        Directory.CreateDirectory(Path.Combine(root, "core"));
        File.WriteAllText(Path.Combine(root, "installer.toml"), $"""
            [plugin]
            id = "{id}"
            name = "我的插件"

            [install]
            {installSection}

            [menu]
            {menuSection}

            {settingsSection}
            """);
        File.WriteAllText(Path.Combine(root, "core", fileName), js ?? PluginJs);
        return root;
    }

    [Fact]
    public void Installs_files_and_merges_settings()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp, settingsSection: "[settings]\nGREETING = \"你好\"\n");
        var target = CreateFakePluginDir(temp, userToml: "[otherPlugin]\nENABLE = true\n# 用户自己的注释\n");

        var result = InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = package,
            TargetPluginDirectory = target,
        });

        Assert.False(result.DryRun);
        Assert.True(File.Exists(Path.Combine(target, "helloWorld.js")));

        var settings = File.ReadAllText(Path.Combine(target, "global", "settings", "settings.user.toml"));
        Assert.Contains("[helloWorld]", settings);
        Assert.Contains("ENABLE = true", settings);
        Assert.Contains("NAME = \"我的插件\"", settings);
        Assert.Contains("GREETING = \"你好\"", settings);
        Assert.Contains("[right_click_menu]", settings);
        Assert.Contains("FIND_LOST_PLUGINS = true", settings);
        // 用户已有内容与注释必须保留
        Assert.Contains("[otherPlugin]", settings);
        Assert.Contains("# 用户自己的注释", settings);
        Assert.True(File.Exists(Path.Combine(target, "global", "settings", "settings.user.toml.bak")));
    }

    [Fact]
    public void DryRun_touches_nothing_but_reports_changes()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp);
        var target = CreateFakePluginDir(temp, userToml: "[otherPlugin]\nENABLE = true\n");
        var settingsPath = Path.Combine(target, "global", "settings", "settings.user.toml");
        var before = File.ReadAllText(settingsPath);

        var result = InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = package,
            TargetPluginDirectory = target,
            DryRun = true,
        });

        Assert.True(result.DryRun);
        Assert.False(File.Exists(Path.Combine(target, "helloWorld.js")));
        Assert.Equal(before, File.ReadAllText(settingsPath));
        Assert.False(File.Exists(settingsPath + ".bak"));
        Assert.NotEmpty(result.SettingsChanges);
        Assert.Contains(result.Log, line => line.Contains("试运行"));
    }

    [Fact]
    public void Missing_plugin_entry_is_rejected_before_writing()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp, fileName: "notTheEntry.js");
        var target = CreateFakePluginDir(temp);

        var error = Assert.Throws<InstallException>(() => InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = package,
            TargetPluginDirectory = target,
        }));

        Assert.Contains("找不到插件入口", error.Message);
        Assert.False(File.Exists(Path.Combine(target, "notTheEntry.js")));
    }

    [Fact]
    public void Target_directory_is_validated()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp);
        var bogus = Path.Combine(temp.Path, "not-a-plugin-dir");
        Directory.CreateDirectory(bogus);

        Assert.Throws<InstallException>(() => InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = package,
            TargetPluginDirectory = bogus,
        }));

        // 显式放行后应当成功
        var result = InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = package,
            TargetPluginDirectory = bogus,
            AllowNonPluginTarget = true,
        });
        Assert.True(File.Exists(Path.Combine(bogus, "helloWorld.js")));
        Assert.NotNull(result);
    }

    [Fact]
    public void Path_traversal_in_files_is_rejected()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp, installSection: "source = \"core\"\nfiles = [\"../evil.js\"]");
        File.WriteAllText(Path.Combine(package, "evil.js"), "boom");
        var target = CreateFakePluginDir(temp);

        var error = Assert.Throws<InstallException>(() => InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = package,
            TargetPluginDirectory = target,
        }));

        Assert.Contains("逃逸", error.Message);
    }

    [Fact]
    public void Existing_user_values_are_kept_but_enable_is_forced_on()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp, settingsSection: "[settings]\nGREETING = \"default\"\n");
        var target = CreateFakePluginDir(temp, userToml: "[helloWorld]\nENABLE = false\nGREETING = \"我自己设的\"\nNAME = \"我改过的名字\"\n");

        InstallEngine.Install(new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target });

        var settings = File.ReadAllText(Path.Combine(target, "global", "settings", "settings.user.toml"));
        Assert.Contains("ENABLE = true", settings);
        Assert.Contains("GREETING = \"我自己设的\"", settings);
        Assert.Contains("NAME = \"我改过的名字\"", settings);
        Assert.DoesNotContain("false", settings);
    }

    [Fact]
    public void Settings_overwrite_true_replaces_existing_values()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp, settingsSection: "[settings]\nGREETING = \"default\"\n");
        var target = CreateFakePluginDir(temp, userToml: "[helloWorld]\nGREETING = \"old\"\n");
        // 打开覆盖开关
        var manifestPath = Path.Combine(package, "installer.toml");
        File.WriteAllText(manifestPath, File.ReadAllText(manifestPath).Replace("source = \"core\"", "source = \"core\"\nsettings_overwrite = true"));

        InstallEngine.Install(new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target });

        Assert.Contains("GREETING = \"default\"", File.ReadAllText(Path.Combine(target, "global", "settings", "settings.user.toml")));
    }

    [Fact]
    public void User_profile_settings_win_over_plugin_directory_settings()
    {
        using var temp = new TempDir();
        var homeRoot = Path.Combine(temp.Path, "home");
        Directory.CreateDirectory(Path.Combine(homeRoot, ".config", "typora_plugin"));
        var profileSettings = Path.Combine(homeRoot, ".config", "typora_plugin", "settings.user.toml");
        File.WriteAllText(profileSettings, "[otherPlugin]\nENABLE = true\n");
        using var home = new HomeScope(homeRoot);

        var package = CreatePackage(temp);
        var target = CreateFakePluginDir(temp, userToml: "[helloWorld]\nENABLE = false\n");
        var pluginSettingsPath = Path.Combine(target, "global", "settings", "settings.user.toml");
        var pluginSettingsBefore = File.ReadAllText(pluginSettingsPath);

        var plan = InstallEngine.CreatePlan(new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target });
        Assert.True(plan.SettingsFromUserProfile);
        Assert.Equal(profileSettings, plan.SettingsPath);

        InstallEngine.Execute(new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target }, plan);

        Assert.Contains("[helloWorld]", File.ReadAllText(profileSettings));
        // 插件目录里那份不应被改动
        Assert.Equal(pluginSettingsBefore, File.ReadAllText(pluginSettingsPath));
    }

    [Fact]
    public void Missing_call_definition_produces_a_warning()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp, js: "class helloWorld extends BasePlugin {}\nmodule.exports = { plugin: helloWorld }\n");
        var target = CreateFakePluginDir(temp);

        var plan = InstallEngine.CreatePlan(new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target });
        Assert.Contains(plan.Warnings, w => w.Contains("call"));
    }

    [Fact]
    public void Overwrite_false_skips_existing_files()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp, installSection: "source = \"core\"\noverwrite = false");
        var target = CreateFakePluginDir(temp);
        File.WriteAllText(Path.Combine(target, "helloWorld.js"), "// OLD");

        InstallEngine.Install(new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target });

        Assert.Equal("// OLD", File.ReadAllText(Path.Combine(target, "helloWorld.js")));
    }

    [Fact]
    public void Menu_mode_none_does_not_touch_right_click_menu()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp, menuSection: "mode = \"none\"");
        var target = CreateFakePluginDir(temp, userToml: "[otherPlugin]\nENABLE = true\n");

        InstallEngine.Install(new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target });

        var settings = File.ReadAllText(Path.Combine(target, "global", "settings", "settings.user.toml"));
        Assert.Contains("[helloWorld]", settings);
        Assert.DoesNotContain("right_click_menu", settings);
    }

    [Fact]
    public void Settings_can_be_skipped_entirely()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp, installSection: "source = \"core\"\nsettings = false");
        var target = CreateFakePluginDir(temp, userToml: "[otherPlugin]\nENABLE = true\n");
        var settingsPath = Path.Combine(target, "global", "settings", "settings.user.toml");
        var before = File.ReadAllText(settingsPath);

        var result = InstallEngine.Install(new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target });

        Assert.True(File.Exists(Path.Combine(target, "helloWorld.js")));
        Assert.Equal(before, File.ReadAllText(settingsPath));
        Assert.Empty(result.SettingsChanges);
    }

    [Fact]
    public void Directory_form_plugin_is_supported()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = Path.Combine(temp.Path, "package");
        Directory.CreateDirectory(Path.Combine(package, "core", "helloWorld"));
        File.WriteAllText(Path.Combine(package, "installer.toml"), """
            [plugin]
            id = "helloWorld"
            name = "P"

            [install]
            source = "core"
            """);
        File.WriteAllText(Path.Combine(package, "core", "helloWorld", "index.js"), "class helloWorld extends BasePlugin { call = () => {} }\nmodule.exports = { plugin: helloWorld }\n");
        var target = CreateFakePluginDir(temp);

        InstallEngine.Install(new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target });

        Assert.True(File.Exists(Path.Combine(target, "helloWorld", "index.js")));
    }

    [Fact]
    public void Package_root_can_be_the_content_directory_and_docs_are_skipped()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = Path.Combine(temp.Path, "package");
        Directory.CreateDirectory(package);
        File.WriteAllText(Path.Combine(package, "installer.toml"), """
            [plugin]
            id = "helloWorld"
            name = "P"

            [install]
            source = "."
            """);
        File.WriteAllText(Path.Combine(package, "helloWorld.js"), PluginJs);
        File.WriteAllText(Path.Combine(package, "README.md"), "docs");
        Directory.CreateDirectory(Path.Combine(package, ".git"));
        File.WriteAllText(Path.Combine(package, ".git", "config"), "x");
        var target = CreateFakePluginDir(temp);

        InstallEngine.Install(new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target });

        Assert.True(File.Exists(Path.Combine(target, "helloWorld.js")));
        Assert.False(File.Exists(Path.Combine(target, "README.md")));
        Assert.False(File.Exists(Path.Combine(target, "installer.toml")));
        Assert.False(Directory.Exists(Path.Combine(target, ".git")));
    }
}
