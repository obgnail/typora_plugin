using System.Diagnostics;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;
using Avalonia.Platform.Storage;
using TyporaPluginInstaller.Core.Install;
using TyporaPluginInstaller.Core.Manifest;
using TyporaPluginInstaller.Core.Menu;

namespace TyporaPluginInstaller.Gui.Views;

public partial class MainWindow : Window
{
    /// <summary>菜单分组下拉框的一项。<c>Choice == null</c> 表示"新建分组"（名字取输入框）。</summary>
    private sealed record GroupOption(string Label, MenuChoice? Choice)
    {
        public override string ToString() => Label;
    }

    private sealed record PositionOption(string Label, MenuGroupPosition Position)
    {
        public override string ToString() => Label;
    }

    private static readonly GroupOption NewGroupOption = new("新建分组…", null);
    private static readonly GroupOption NoMenuOption = new("不注册右键菜单", MenuChoice.Skip);

    private readonly TextBox _sourceBox;
    private readonly TextBox _targetBox;
    private readonly TextBox _logBox;
    private readonly TextBox _newGroupNameBox;
    private readonly TextBlock _statusText;
    private readonly TextBlock _summaryText;
    private readonly CheckBox _dryRunCheck;
    private readonly CheckBox _allowNonPluginTargetCheck;
    private readonly Button _previewButton;
    private readonly Button _installButton;
    private readonly Button _openSettingsFolderButton;
    private readonly ComboBox _menuGroupBox;
    private readonly ComboBox _menuPositionBox;

    private string? _lastSettingsPath;
    private bool _updatingMenuGroups;

    public MainWindow()
    {
        AvaloniaXamlLoader.Load(this);

        _sourceBox = Find<TextBox>("SourceBox");
        _targetBox = Find<TextBox>("TargetBox");
        _logBox = Find<TextBox>("LogBox");
        _newGroupNameBox = Find<TextBox>("NewGroupNameBox");
        _statusText = Find<TextBlock>("StatusText");
        _summaryText = Find<TextBlock>("SummaryText");
        _dryRunCheck = Find<CheckBox>("DryRunCheck");
        _allowNonPluginTargetCheck = Find<CheckBox>("AllowNonPluginTargetCheck");
        _previewButton = Find<Button>("PreviewButton");
        _installButton = Find<Button>("InstallButton");
        _openSettingsFolderButton = Find<Button>("OpenSettingsFolderButton");
        _menuGroupBox = Find<ComboBox>("MenuGroupBox");
        _menuPositionBox = Find<ComboBox>("MenuPositionBox");

        _menuPositionBox.ItemsSource = new[]
        {
            new PositionOption("最前（推荐）", MenuGroupPosition.First),
            new PositionOption("最后", MenuGroupPosition.Last),
        };
        _menuPositionBox.SelectedIndex = 0;

        Find<Button>("BrowseSourceButton").Click += async (_, _) => await PickFolderAsync(_sourceBox, "选择插件包目录");
        Find<Button>("BrowseTargetButton").Click += async (_, _) => await PickFolderAsync(_targetBox, "选择 Typora 的 plugin 目录");
        _previewButton.Click += async (_, _) => await RunAsync(dryRun: true);
        _installButton.Click += async (_, _) => await RunAsync(dryRun: false);
        _openSettingsFolderButton.Click += (_, _) => OpenContainingFolder(_lastSettingsPath);

        // 注意：Avalonia 的 TextBox.TextChanged 只在用户输入路径上触发，代码里给 .Text 赋值
        // （比如"浏览…"选完目录）不会触发它。这里监听属性变化，两条路径都能覆盖。
        _sourceBox.PropertyChanged += (_, e) =>
        {
            if (e.Property == TextBox.TextProperty) UpdateManifestSummary();
        };
        _targetBox.PropertyChanged += (_, e) =>
        {
            if (e.Property == TextBox.TextProperty) ReloadMenuGroups();
        };
        _menuGroupBox.SelectionChanged += (_, _) => SyncMenuControls();

        ReloadMenuGroups();
    }

    private T Find<T>(string name) where T : Control =>
        this.FindControl<T>(name) ?? throw new InvalidOperationException($"界面元素缺失：{name}");

    private async Task PickFolderAsync(TextBox box, string title)
    {
        var folders = await StorageProvider.OpenFolderPickerAsync(new FolderPickerOpenOptions
        {
            Title = title,
            AllowMultiple = false,
        });

        if (folders.Count == 0)
        {
            return;
        }

        var path = folders[0].TryGetLocalPath();
        if (!string.IsNullOrWhiteSpace(path))
        {
            box.Text = path;
        }
    }

    /// <summary>
    /// 分组列表来自目标目录本身（当前生效的 MENUS + 它自己的语言文件），
    /// 所以显示名和 Typora 里看到的一致，不受任何内置硬编码影响。
    /// </summary>
    private void ReloadMenuGroups()
    {
        if (_updatingMenuGroups)
        {
            return;
        }
        _updatingMenuGroups = true;
        try
        {
            var target = _targetBox.Text?.Trim();
            var previous = (_menuGroupBox.SelectedItem as GroupOption)?.Choice;

            var options = new List<GroupOption> { NewGroupOption, NoMenuOption };
            string? suggested = null;

            if (!string.IsNullOrWhiteSpace(target) && Directory.Exists(target))
            {
                try
                {
                    var catalog = InstallEngine.InspectMenus(target);
                    suggested = catalog.SuggestedGroupName;
                    options.AddRange(catalog.Groups.Select(g => new GroupOption(g.ToString(), MenuChoice.Existing(g.Key))));
                }
                catch (InstallException e)
                {
                    _statusText.Text = "读不到目标的菜单分组：" + FirstLine(e.Message);
                }
            }

            _menuGroupBox.ItemsSource = options;
            _menuGroupBox.SelectedItem = options.FirstOrDefault(o => Equals(o.Choice, previous)) ?? NewGroupOption;

            if (!string.IsNullOrWhiteSpace(suggested) && string.IsNullOrWhiteSpace(_newGroupNameBox.Text))
            {
                _newGroupNameBox.Text = suggested;
            }
        }
        finally
        {
            _updatingMenuGroups = false;
        }
        SyncMenuControls();
    }

    private void SyncMenuControls()
    {
        var isNewGroup = ReferenceEquals(_menuGroupBox.SelectedItem, NewGroupOption);
        _newGroupNameBox.IsEnabled = isNewGroup;
        _menuPositionBox.IsEnabled = isNewGroup;
    }

    private MenuChoice? SelectedMenuChoice()
    {
        var option = _menuGroupBox.SelectedItem as GroupOption;
        if (option == null)
        {
            return null;
        }
        if (option.Choice != null)
        {
            return option.Choice;
        }

        var name = _newGroupNameBox.Text?.Trim();
        if (string.IsNullOrEmpty(name))
        {
            throw new InstallException("选择\"新建分组\"时，请在右侧填写分组名称。");
        }
        var position = (_menuPositionBox.SelectedItem as PositionOption)?.Position ?? MenuGroupPosition.First;
        return MenuChoice.New(name, position);
    }

    private void UpdateManifestSummary()
    {
        var source = _sourceBox.Text?.Trim();
        if (string.IsNullOrWhiteSpace(source))
        {
            _summaryText.Text = string.Empty;
            return;
        }

        var manifestPath = Path.Combine(source, InstallManifest.FileName);
        if (!File.Exists(manifestPath))
        {
            _summaryText.Text = $"在插件包目录里找不到 {InstallManifest.FileName}。";
            return;
        }

        try
        {
            var manifest = ManifestLoader.Load(manifestPath);
            var version = string.IsNullOrWhiteSpace(manifest.Version) ? string.Empty : $" v{manifest.Version}";
            _summaryText.Text = $"清单：{manifest.Name} ({manifest.Id}){version}　·　核心目录 install.source = \"{manifest.SourceDirectory}\"　·　菜单：{manifest.Menu.ToString().ToLowerInvariant()}";
        }
        catch (ManifestException e)
        {
            _summaryText.Text = "清单有问题：" + e.Message;
        }
    }

    private async Task RunAsync(bool dryRun)
    {
        var source = _sourceBox.Text?.Trim() ?? string.Empty;
        var target = _targetBox.Text?.Trim() ?? string.Empty;

        if (source.Length == 0 || target.Length == 0)
        {
            SetStatus("请先选择插件包目录和 plugin 目录", isError: true);
            return;
        }

        SetBusy(true);
        try
        {
            var options = new InstallOptions
            {
                SourceDirectory = source,
                TargetPluginDirectory = target,
                DryRun = dryRun || _dryRunCheck.IsChecked == true,
                AllowNonPluginTarget = _allowNonPluginTargetCheck.IsChecked == true,
                MenuChoice = SelectedMenuChoice(),
            };

            var plan = InstallEngine.CreatePlan(options);

            if (!options.DryRun)
            {
                var confirmed = await ConfirmDialog.ShowAsync(this, BuildConfirmation(plan));
                if (!confirmed)
                {
                    SetStatus("已取消");
                    return;
                }
            }

            var result = InstallEngine.Execute(options, plan);
            AppendLog(InstallEngine.Render(result));

            _lastSettingsPath = Path.GetDirectoryName(plan.SettingsPath);
            _openSettingsFolderButton.IsEnabled = !string.IsNullOrEmpty(_lastSettingsPath);

            SetStatus(result.DryRun ? "试运行完成：以上是将会发生的改动" : "安装完成，请重启 Typora 让插件生效");
        }
        catch (InstallException e)
        {
            SetStatus("安装失败", isError: true);
            AppendLog("✗ " + e.Message);
        }
        catch (Exception e)
        {
            SetStatus("意外错误", isError: true);
            AppendLog("✗ " + e);
        }
        finally
        {
            SetBusy(false);
        }
    }

    private static string BuildConfirmation(InstallPlan plan)
    {
        var lines = new List<string>
        {
            $"插件：{plan.Manifest.Name} ({plan.Manifest.Id})",
            $"目标目录：{plan.TargetPluginDirectory}",
            $"将写入 {plan.Files.Count} 个文件：",
        };

        lines.AddRange(plan.Files.Take(20).Select(f => "  " + (f.Overwrites ? "覆盖 " : "新增 ") + f.RelativePath));
        if (plan.Files.Count > 20)
        {
            lines.Add($"  … 其余 {plan.Files.Count - 20} 个");
        }

        lines.Add(string.Empty);
        if (plan.Menu != null)
        {
            lines.Add($"右键菜单：{(plan.Menu.GroupCreated ? "新建" : "放进已有")}分组「{plan.Menu.Title}」" +
                      $"（第 {plan.Menu.GroupIndex + 1} 组，共 {plan.Menu.FinalMenus.Count} 组）");
        }
        else
        {
            lines.Add("右键菜单：不注册");
        }
        lines.Add("将修改配置：" + plan.SettingsPath + (plan.SettingsFromUserProfile ? "（用户目录）" : "（插件目录）"));
        lines.Add("（原文件会先备份为 settings.user.toml.bak）");

        if (plan.Warnings.Count > 0)
        {
            lines.Add(string.Empty);
            lines.Add("提示：");
            lines.AddRange(plan.Warnings.Select(w => "  - " + w));
        }

        return string.Join(Environment.NewLine, lines);
    }

    private void SetBusy(bool busy)
    {
        _previewButton.IsEnabled = !busy;
        _installButton.IsEnabled = !busy;
        _statusText.Text = busy ? "处理中…" : _statusText.Text;
        _statusText.Foreground = Avalonia.Media.Brushes.Gray;
    }

    private void SetStatus(string message, bool isError = false)
    {
        _statusText.Text = message;
        _statusText.Foreground = isError
            ? Avalonia.Media.Brushes.IndianRed
            : Avalonia.Media.Brushes.SeaGreen;
    }

    private void AppendLog(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return;
        }

        if (!string.IsNullOrEmpty(_logBox.Text))
        {
            _logBox.Text += Environment.NewLine + Environment.NewLine;
        }
        _logBox.Text += text;
        _logBox.CaretIndex = _logBox.Text?.Length ?? 0;
    }

    private static string FirstLine(string text) =>
        text.Split('\n')[0].Trim();

    private static void OpenContainingFolder(string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
        {
            return;
        }

        try
        {
            if (OperatingSystem.IsWindows())
            {
                Process.Start(new ProcessStartInfo("explorer.exe", $"\"{path}\"") { UseShellExecute = true });
            }
            else if (OperatingSystem.IsMacOS())
            {
                Process.Start("open", path);
            }
            else
            {
                Process.Start("xdg-open", path);
            }
        }
        catch
        {
            // 打不开资源管理器不算安装失败
        }
    }
}
