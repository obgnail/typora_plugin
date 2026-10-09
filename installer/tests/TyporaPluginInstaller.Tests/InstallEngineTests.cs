using TyporaPluginInstaller.Core.Install;
using TyporaPluginInstaller.Core.Manifest;
using TyporaPluginInstaller.Core.Menu;
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

    /// <summary>一个"像插件系统"的默认配置：含 [global] 与两组内置右键菜单。</summary>
    private const string DefaultToml = """
        [global]
        ENABLE = true
        LOCALE = "zh-CN"

        [right_click_menu]
        ENABLE = true
        FIND_LOST_PLUGINS = false

        [[right_click_menu.MENUS]]
        NAME = "__VISUAL_PLUGINS__"
        LIST = ["static_markers", "auto_number"]

        [[right_click_menu.MENUS]]
        NAME = "__INTERACTIVE_PLUGINS__"
        LIST = ["window_tab", "commander"]
        """;

    /// <summary>目标自带的语言文件：分组显示名要能从中读出来。</summary>
    private const string LocaleJson = """
        {
          "settings": {
            "__VISUAL_PLUGINS__": "视觉插件",
            "__INTERACTIVE_PLUGINS__": "交互插件"
          }
        }
        """;

    private static string CreateFakePluginDir(
        TempDir temp,
        string name = "target",
        string? userToml = null,
        string defaultToml = DefaultToml)
    {
        var dir = Path.Combine(temp.Path, name);
        Directory.CreateDirectory(Path.Combine(dir, "global", "settings"));
        Directory.CreateDirectory(Path.Combine(dir, "global", "locales"));
        File.WriteAllText(Path.Combine(dir, "global", "locales", "zh-CN.json"), LocaleJson);
        File.WriteAllText(Path.Combine(dir, "global", "settings", "settings.default.toml"), defaultToml);
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
        string menuSection = "mode = \"none\"",
        string settingsSection = "",
        string rootName = "package")
    {
        var root = Path.Combine(temp.Path, rootName);
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

    private static string SettingsPathOf(string target) =>
        Path.Combine(target, "global", "settings", "settings.user.toml");

    [Fact]
    public void Installs_files_and_merges_settings()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp, menuSection: "mode = \"group\"", settingsSection: "[settings]\nGREETING = \"你好\"\n");
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
        var package = CreatePackage(temp, js: "class helloWorld extends BasePlugin {}\nmodule.exports = { plugin: helloWorld }\n", menuSection: "mode = \"group\"");
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

    // ---- 自定义右键菜单分组 -----------------------------------------------------

    [Fact]
    public void Group_mode_creates_a_top_level_group_and_keeps_built_in_groups()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp, menuSection: "mode = \"group\"");
        var target = CreateFakePluginDir(temp);

        InstallEngine.Install(new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target });

        var groups = MenuArrayCodec.Extract(File.ReadAllText(SettingsPathOf(target)));
        Assert.Equal(3, groups.Count);
        // 默认放在最前，标题按目标 LOCALE（zh-CN）选择
        Assert.Equal("自定义插件", groups[0].Name);
        // 分组里只有这一个插件时，条目必须写成 plugin.action，否则框架的一级菜单点了没反应
        Assert.Equal(new[] { "helloWorld", "---" }, groups[0].List);   // 单条目分组补分隔线，绕开框架的单条目简写
        // 内置分组原样保留
        Assert.Equal("__VISUAL_PLUGINS__", groups[1].Name);
        Assert.Equal(new[] { "static_markers", "auto_number" }, groups[1].List);
        Assert.Equal("__INTERACTIVE_PLUGINS__", groups[2].Name);
    }

    [Fact]
    public void Second_install_joins_the_same_group_and_drops_the_single_entry_padding()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var target = CreateFakePluginDir(temp);

        InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = CreatePackage(temp, menuSection: "mode = \"group\""),
            TargetPluginDirectory = target,
        });
        InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = CreatePackage(temp, id: "otherPlugin", fileName: "otherPlugin.js",
                menuSection: "mode = \"group\"", rootName: "package2"),
            TargetPluginDirectory = target,
        });

        var groups = MenuArrayCodec.Extract(File.ReadAllText(SettingsPathOf(target)));
        Assert.Equal(3, groups.Count);
        Assert.Equal("自定义插件", groups[0].Name);
        // 组里有两个条目后，临时补的分隔线要消失
        Assert.Equal(new[] { "helloWorld", "otherPlugin" }, groups[0].List);
    }

    [Fact]
    public void Reinstalling_the_same_plugin_does_not_duplicate_the_entry()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp, menuSection: "mode = \"group\"");
        var target = CreateFakePluginDir(temp);

        InstallEngine.Install(new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target });
        InstallEngine.Install(new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target });

        var groups = MenuArrayCodec.Extract(File.ReadAllText(SettingsPathOf(target)));
        Assert.Equal(3, groups.Count);
        Assert.Equal(new[] { "helloWorld", "---" }, groups[0].List);   // 单条目分组补分隔线，绕开框架的单条目简写
    }

    [Fact]
    public void Plugin_already_listed_in_another_group_is_moved_not_duplicated()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var userToml = """
            [right_click_menu]
            FIND_LOST_PLUGINS = false

            [[right_click_menu.MENUS]]
            NAME = "自定义插件"
            LIST = ["helloWorld"]

            [[right_click_menu.MENUS]]
            NAME = "__INTERACTIVE_PLUGINS__"
            LIST = ["helloWorld", "window_tab"]
            """;
        var target = CreateFakePluginDir(temp, userToml: userToml);
        var package = CreatePackage(temp, menuSection: "mode = \"group\"");

        InstallEngine.Install(new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target });

        var groups = MenuArrayCodec.Extract(File.ReadAllText(SettingsPathOf(target)));
        Assert.Equal(2, groups.Count);
        Assert.Equal(new[] { "helloWorld", "---" }, groups[0].List);   // 单条目分组补分隔线，绕开框架的单条目简写
        Assert.Equal(new[] { "window_tab" }, groups[1].List);
    }

    [Fact]
    public void Installer_choice_can_put_the_plugin_into_an_existing_builtin_group()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var target = CreateFakePluginDir(temp);
        var package = CreatePackage(temp, menuSection: "mode = \"group\"");

        InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = package,
            TargetPluginDirectory = target,
            MenuChoice = MenuChoice.Existing("__INTERACTIVE_PLUGINS__"),
        });

        var groups = MenuArrayCodec.Extract(File.ReadAllText(SettingsPathOf(target)));
        Assert.Equal(2, groups.Count);                                   // 没有新建分组
        Assert.Equal("__VISUAL_PLUGINS__", groups[0].Name);
        Assert.Equal(new[] { "window_tab", "commander", "helloWorld" }, groups[1].List);
    }

    [Fact]
    public void Installer_choice_can_create_a_group_with_a_chosen_name_and_position()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var target = CreateFakePluginDir(temp);
        var package = CreatePackage(temp, menuSection: "mode = \"group\"");

        InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = package,
            TargetPluginDirectory = target,
            MenuChoice = MenuChoice.New("我的插件", MenuGroupPosition.Last),
        });

        var groups = MenuArrayCodec.Extract(File.ReadAllText(SettingsPathOf(target)));
        Assert.Equal("我的插件", groups[^1].Name);
        Assert.Equal(new[] { "helloWorld", "---" }, groups[^1].List);
        Assert.Equal("__VISUAL_PLUGINS__", groups[0].Name);
    }

    [Fact]
    public void Choosing_an_unknown_existing_group_is_rejected()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var target = CreateFakePluginDir(temp);
        var package = CreatePackage(temp, menuSection: "mode = \"group\"");

        var error = Assert.Throws<InstallException>(() => InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = package,
            TargetPluginDirectory = target,
            MenuChoice = MenuChoice.Existing("__NOPE__"),
        }));

        Assert.Contains("没有名为", error.Message);
        Assert.Contains("__VISUAL_PLUGINS__", error.Message);            // 错误里列出可用分组
    }

    [Fact]
    public void Different_chosen_group_names_create_separate_groups()
    {
        // 刻意保留的灵活性：装的人想让两个插件分开就分开。
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var target = CreateFakePluginDir(temp);

        InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = CreatePackage(temp, menuSection: "mode = \"group\""),
            TargetPluginDirectory = target,
            MenuChoice = MenuChoice.New("组A"),
        });
        InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = CreatePackage(temp, id: "otherPlugin", fileName: "otherPlugin.js",
                menuSection: "mode = \"group\"", rootName: "package2"),
            TargetPluginDirectory = target,
            MenuChoice = MenuChoice.New("组B"),
        });

        var groups = MenuArrayCodec.Extract(File.ReadAllText(SettingsPathOf(target)));
        Assert.Equal(4, groups.Count);
        // 按名字查，不依赖插到最前还是最后
        Assert.Equal(new[] { "helloWorld", "---" }, groups.Single(g => g.Name == "组A").List);
        Assert.Equal(new[] { "otherPlugin", "---" }, groups.Single(g => g.Name == "组B").List);
    }

    [Fact]
    public void Menu_none_choice_overrides_the_plugin_manifest()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var target = CreateFakePluginDir(temp);
        var package = CreatePackage(temp, menuSection: "mode = \"group\"");

        InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = package,
            TargetPluginDirectory = target,
            MenuChoice = MenuChoice.Skip,
        });

        var settings = File.ReadAllText(SettingsPathOf(target));
        Assert.Contains("[helloWorld]", settings);
        Assert.DoesNotContain("right_click_menu", settings);
    }

    [Fact]
    public void Moving_a_plugin_leaves_no_empty_group_behind()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var target = CreateFakePluginDir(temp);
        var package = CreatePackage(temp, menuSection: "mode = \"group\"");

        // 第一次：新建「组A」
        InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = package,
            TargetPluginDirectory = target,
            MenuChoice = MenuChoice.New("组A"),
        });
        // 第二次：改放进内置分组 —— 「组A」空了，应该被清掉
        InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = package,
            TargetPluginDirectory = target,
            MenuChoice = MenuChoice.Existing("__INTERACTIVE_PLUGINS__"),
        });

        var groups = MenuArrayCodec.Extract(File.ReadAllText(SettingsPathOf(target)));
        Assert.Equal(2, groups.Count);
        Assert.DoesNotContain("组A", groups.Select(g => g.Name));
        Assert.Contains("helloWorld", groups.Single(g => g.Name == "__INTERACTIVE_PLUGINS__").List);
    }

    [Fact]
    public void Inspect_menus_reads_group_titles_from_the_target_locale_file()
    {
        using var temp = new TempDir();
        var target = CreateFakePluginDir(temp);

        var catalog = InstallEngine.InspectMenus(target);

        Assert.Equal("zh-CN", catalog.Locale);
        Assert.Equal("自定义插件", catalog.SuggestedGroupName);
        Assert.Equal(2, catalog.Groups.Count);
        Assert.Equal("__VISUAL_PLUGINS__", catalog.Groups[0].Key);
        Assert.Equal("视觉插件", catalog.Groups[0].DisplayTitle);        // 来自目标的 locales/zh-CN.json
        Assert.Equal("__INTERACTIVE_PLUGINS__", catalog.Groups[1].Key);
        Assert.Equal("交互插件", catalog.Groups[1].DisplayTitle);
    }

    [Fact]
    public void Manifest_group_or_position_is_rejected()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var target = CreateFakePluginDir(temp);
        var package = CreatePackage(temp, menuSection: "mode = \"group\"\ngroup = \"我的插件\"");

        var error = Assert.Throws<InstallException>(() => InstallEngine.Install(
            new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target }));

        Assert.Contains("不允许指定 group", error.Message);
    }

    [Fact]
    public void Inline_MENUS_assignment_in_user_settings_is_rejected()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var target = CreateFakePluginDir(temp, userToml: "[right_click_menu]\nMENUS = [{ NAME = \"x\", LIST = [] }]\n");
        var package = CreatePackage(temp, menuSection: "mode = \"group\"");

        var error = Assert.Throws<InstallException>(() => InstallEngine.Install(
            new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target }));

        Assert.Contains("内联写法", error.Message);
        // 被拒绝时不应写入任何配置
        Assert.DoesNotContain("[[right_click_menu.MENUS]]", File.ReadAllText(SettingsPathOf(target)));
    }

    [Fact]
    public void Group_mode_requires_the_default_menu_table()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var target = CreateFakePluginDir(temp, defaultToml: "[global]\nENABLE = true\n");
        var package = CreatePackage(temp, menuSection: "mode = \"group\"");

        var error = Assert.Throws<InstallException>(() => InstallEngine.Install(
            new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target }));

        Assert.Contains("[[right_click_menu.MENUS]]", error.Message);
    }

    [Fact]
    public void Auto_mode_is_no_longer_accepted()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var target = CreateFakePluginDir(temp);
        var package = CreatePackage(temp, menuSection: "mode = \"auto\"");

        var error = Assert.Throws<InstallException>(() => InstallEngine.Install(
            new InstallOptions { SourceDirectory = package, TargetPluginDirectory = target }));

        Assert.Contains("[menu] mode", error.Message);
    }

    [Fact]
    public void Group_mode_dry_run_writes_nothing()
    {
        using var temp = new TempDir();
        using var home = new HomeScope(Path.Combine(temp.Path, "home"));
        var package = CreatePackage(temp, menuSection: "mode = \"group\"");
        var target = CreateFakePluginDir(temp, userToml: "[otherPlugin]\nENABLE = true\n");
        var before = File.ReadAllText(SettingsPathOf(target));

        var result = InstallEngine.Install(new InstallOptions
        {
            SourceDirectory = package,
            TargetPluginDirectory = target,
            DryRun = true,
        });

        Assert.True(result.DryRun);
        Assert.Equal(before, File.ReadAllText(SettingsPathOf(target)));
        Assert.NotNull(result.Plan.Menu);
        Assert.Contains(result.Plan.Menu!.FinalMenus, g => g.Name == "自定义插件");
    }
}
