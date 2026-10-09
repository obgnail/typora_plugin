using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using TyporaPluginInstaller.Gui;
using TyporaPluginInstaller.Gui.Views;
using Xunit;

namespace TyporaPluginInstaller.Tests;

/// <summary>
/// GUI 冒烟测试：在无显示环境下真正构造窗口，用来验证 XAML 能加载、
/// 所有 x:Name 控件都能被解析（编译期查不出这类问题）。
/// Windows exe 无法在本机运行，所以这是 GUI 侧唯一可自动化的验证手段。
/// </summary>
public class GuiSmokeTests
{
    private static readonly object Gate = new();
    private static bool _initialized;

    private static void EnsureAvalonia()
    {
        lock (Gate)
        {
            if (_initialized)
            {
                return;
            }

            AppBuilder.Configure<App>()
                .UseHeadless(new AvaloniaHeadlessPlatformOptions { UseHeadlessDrawing = true })
                .SetupWithoutStarting();

            _initialized = true;
        }
    }

    [Fact]
    public void MainWindow_loads_xaml_and_resolves_every_named_control()
    {
        EnsureAvalonia();

        var window = new MainWindow();

        Assert.Equal("Typora 插件安装器", window.Title);
        foreach (var name in new[]
                 {
                     "SourceBox", "TargetBox", "LogBox", "StatusText", "SummaryText",
                     "DryRunCheck", "AllowNonPluginTargetCheck",
                     "PreviewButton", "InstallButton", "OpenSettingsFolderButton",
                     "BrowseSourceButton", "BrowseTargetButton",
                     "MenuGroupBox", "NewGroupNameBox", "MenuPositionBox",
                 })
        {
            Assert.NotNull(window.FindControl<Control>(name));
        }

        // 输入框的提示文案（Watermark）与只读设置也顺带确认一下
        Assert.False(string.IsNullOrEmpty(window.FindControl<TextBox>("SourceBox")!.Watermark));
        Assert.True(window.FindControl<TextBox>("LogBox")!.IsReadOnly);
    }

    [Fact]
    public void ConfirmDialog_loads_xaml()
    {
        EnsureAvalonia();

        var dialog = new ConfirmDialog();
        dialog.FindControl<TextBlock>("MessageText")!.Text = "预览内容";

        Assert.Equal("确认安装", dialog.Title);
        Assert.Equal("预览内容", dialog.FindControl<TextBlock>("MessageText")!.Text);
        Assert.NotNull(dialog.FindControl<Button>("OkButton"));
        Assert.NotNull(dialog.FindControl<Button>("CancelButton"));
    }
}
