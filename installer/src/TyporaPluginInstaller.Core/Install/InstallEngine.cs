using System.Text;
using System.Text.RegularExpressions;
using TyporaPluginInstaller.Core.Manifest;
using TyporaPluginInstaller.Core.Toml;

namespace TyporaPluginInstaller.Core.Install;

/// <summary>
/// 安装引擎：插件包 + installer.toml → 目标 plugin 目录 + settings.user.toml。
/// <para>分两步：<see cref="CreatePlan"/> 做全部校验并产出可展示的计划，
/// <see cref="Execute"/> 才真正写盘。两步都纯本地、无网络。</para>
/// </summary>
public static class InstallEngine
{
    /// <summary>粗略探测插件是否覆盖了 <c>call</c> / 提供了动作列表（用于菜单可点击性提示）。</summary>
    private static readonly Regex ActionDefinitionPattern = new(
        @"(?m)^\s*(call|staticActions|getDynamicActions)\s*[=:(]",
        RegexOptions.Compiled);

    private static StringComparison PathComparison =>
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    /// <summary>用户主目录来源；测试可替换。</summary>
    internal static Func<string?> HomeDirectoryProvider { get; set; } =
        () => Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

    // ---------------------------------------------------------------- planning

    public static InstallPlan CreatePlan(InstallOptions options)
    {
        var warnings = new List<string>();

        var sourceDir = Path.GetFullPath(options.SourceDirectory);
        if (!Directory.Exists(sourceDir))
        {
            throw new InstallException($"插件包目录不存在：{sourceDir}");
        }

        var manifestPath = string.IsNullOrWhiteSpace(options.ManifestPath)
            ? Path.Combine(sourceDir, InstallManifest.FileName)
            : Path.GetFullPath(options.ManifestPath!);

        InstallManifest manifest;
        try
        {
            manifest = ManifestLoader.Load(manifestPath);
        }
        catch (ManifestException e)
        {
            throw new InstallException(e.Message);
        }

        var targetDir = Path.GetFullPath(options.TargetPluginDirectory);
        if (!Directory.Exists(targetDir))
        {
            throw new InstallException($"目标 plugin 目录不存在：{targetDir}");
        }

        if (!options.AllowNonPluginTarget && !LooksLikePluginDirectory(targetDir))
        {
            throw new InstallException(
                $"这个目录看起来不是 Typora 的 plugin 目录：{targetDir}\n" +
                "它应当包含 global/settings/settings.default.toml 或 global/core/（通常位于 <Typora>/resources/plugin）。");
        }

        var manifestDir = Path.GetDirectoryName(manifestPath)!;
        var contentDir = Path.GetFullPath(Path.Combine(manifestDir, manifest.SourceDirectory));
        if (!Directory.Exists(contentDir))
        {
            throw new InstallException($"install.source 指向的目录不存在：{contentDir}");
        }

        if (!FileSystemHelper.IsWithin(contentDir, manifestDir))
        {
            throw new InstallException($"install.source 必须位于插件包目录内，不允许用 .. 逃逸：{manifest.SourceDirectory}");
        }

        var files = CollectFiles(manifest, manifestPath, manifestDir, contentDir, targetDir, warnings);

        // 入口自检：插件系统的加载器只认 plugin/<id>.js 与 plugin/<id>/index.js。
        var entryJs = Path.Combine(targetDir, manifest.Id + ".js");
        var entryIndex = Path.Combine(targetDir, manifest.Id, "index.js");
        var entryAlreadyPresent = File.Exists(entryJs) || File.Exists(entryIndex);
        var entryPlanned = files.Any(f =>
            string.Equals(f.TargetPath, entryJs, PathComparison) ||
            string.Equals(f.TargetPath, entryIndex, PathComparison));

        if (!entryAlreadyPresent && !entryPlanned)
        {
            throw new InstallException(
                $"安装后仍找不到插件入口。\n" +
                $"插件包需要提供 {manifest.Id}.js 或 {manifest.Id}/index.js（当前 install.source = \"{manifest.SourceDirectory}\"）。");
        }

        var (settingsPath, fromProfile) = ResolveSettingsPath(targetDir);
        var settingsExists = File.Exists(settingsPath);
        if (!settingsExists)
        {
            warnings.Add($"settings.user.toml 不存在，将在该位置新建：{settingsPath}");
        }

        if (manifest.Menu != MenuMode.None)
        {
            CheckMenuClickability(manifest, entryJs, entryIndex, files, warnings);
        }

        var overwrites = files.Count(f => f.Overwrites);
        if (overwrites > 0)
        {
            warnings.Add($"有 {overwrites} 个目标文件已存在，将按 install.overwrite = {manifest.Overwrite.ToString().ToLowerInvariant()} 处理。");
        }

        if (!string.IsNullOrWhiteSpace(manifest.MinTypora))
        {
            warnings.Add($"此插件要求 Typora >= {manifest.MinTypora}（安装器不做版本校验）。");
        }

        return new InstallPlan
        {
            Manifest = manifest,
            SourceDirectory = sourceDir,
            ContentDirectory = contentDir,
            TargetPluginDirectory = targetDir,
            SettingsPath = settingsPath,
            SettingsFileExists = settingsExists,
            SettingsFromUserProfile = fromProfile,
            Files = files,
            Warnings = warnings,
            EntryAlreadyPresent = entryAlreadyPresent,
        };
    }

    // --------------------------------------------------------------- executing

    public static InstallResult Execute(InstallOptions options, InstallPlan plan)
    {
        var log = new List<string>();
        var copied = new List<string>();

        log.Add($"插件：{plan.Manifest.Name} ({plan.Manifest.Id})" +
                (string.IsNullOrWhiteSpace(plan.Manifest.Version) ? string.Empty : $" v{plan.Manifest.Version}"));
        log.Add($"插件包：{plan.Manifest.ManifestPath}");
        log.Add($"核心文件目录：{plan.ContentDirectory}");
        log.Add($"目标 plugin 目录：{plan.TargetPluginDirectory}");
        log.Add(options.DryRun ? "模式：试运行（不写入任何文件）" : "模式：实际安装");
        log.Add(string.Empty);

        log.Add($"[1/3] 复制核心文件（{plan.Files.Count} 个）");
        foreach (var file in plan.Files)
        {
            if (options.DryRun)
            {
                log.Add($"  {(file.Overwrites ? "覆盖" : "新增")}  {file.RelativePath}");
                copied.Add(file.TargetPath);
                continue;
            }

            if (file.Overwrites && !plan.Manifest.Overwrite)
            {
                log.Add($"  跳过  {file.RelativePath}（已存在，且 install.overwrite = false）");
                continue;
            }

            try
            {
                FileSystemHelper.CopyFile(file.SourcePath, file.TargetPath, overwrite: true);
                log.Add($"  {(file.Overwrites ? "覆盖" : "新增")}  {file.RelativePath}");
                copied.Add(file.TargetPath);
            }
            catch (Exception e)
            {
                throw new InstallException($"复制失败：{file.SourcePath} → {file.TargetPath}\n{e.Message}");
            }
        }

        log.Add(string.Empty);
        log.Add("[2/3] 写入配置");

        if (!plan.Manifest.WriteSettings)
        {
            log.Add("  已按 installer.toml 的 install.settings = false 跳过配置写入。");
            return new InstallResult
            {
                Plan = plan,
                Log = log,
                CopiedFiles = copied,
                SettingsChanges = Array.Empty<KeyChange>(),
                DryRun = options.DryRun,
            };
        }

        var editor = BuildSettingsEditor(plan);
        log.Add($"  配置文件：{plan.SettingsPath}" +
                (plan.SettingsFromUserProfile ? "（用户目录优先，与运行时行为一致）" : "（插件目录）"));

        if (editor.Changes.Count == 0)
        {
            log.Add("  无需改动（配置已就绪）。");
        }
        else
        {
            foreach (var change in editor.Changes)
            {
                log.Add($"  {change}");
            }
        }

        string? backupPath = null;
        if (!options.DryRun && editor.IsDirty)
        {
            try
            {
                editor.Save(plan.SettingsPath, createBackup: true);
                backupPath = File.Exists(plan.SettingsPath + ".bak") ? plan.SettingsPath + ".bak" : null;
                if (backupPath != null)
                {
                    log.Add($"  原配置已备份到：{backupPath}");
                }
            }
            catch (Exception e)
            {
                throw new InstallException($"写入配置文件失败：{plan.SettingsPath}\n{e.Message}");
            }
        }

        log.Add(string.Empty);
        log.Add("[3/3] 完成");
        log.Add(options.DryRun
            ? "试运行结束：以上是将会发生的改动。"
            : "安装完成，请重启 Typora 让插件生效。");

        return new InstallResult
        {
            Plan = plan,
            Log = log,
            CopiedFiles = copied,
            SettingsChanges = editor.Changes,
            DryRun = options.DryRun,
            SettingsBackupPath = backupPath,
        };
    }

    /// <summary>一步到位：规划 + 执行。</summary>
    public static InstallResult Install(InstallOptions options)
    {
        var plan = CreatePlan(options);
        return Execute(options, plan);
    }

    // ----------------------------------------------------------------- helpers

    /// <summary>构造已应用改动的 settings 编辑器（dry-run 也用它来展示会改什么）。</summary>
    internal static TomlSettingsEditor BuildSettingsEditor(InstallPlan plan)
    {
        var text = File.Exists(plan.SettingsPath) ? File.ReadAllText(plan.SettingsPath) : string.Empty;
        var editor = new TomlSettingsEditor(text);
        var manifest = plan.Manifest;

        var writable = manifest.SettingsOverwrite ? KeyWritePolicy.SetAlways : KeyWritePolicy.SetIfMissing;
        var pluginWrites = new List<KeyWrite>
        {
            new("ENABLE", true, KeyWritePolicy.SetIfDifferent),
            new("NAME", manifest.Name, KeyWritePolicy.SetIfMissingOrEmpty),
        };
        pluginWrites.AddRange(manifest.Settings.Select(kv => new KeyWrite(kv.Key, kv.Value, writable)));
        editor.Apply(manifest.Id, pluginWrites);

        if (manifest.Menu == MenuMode.Auto)
        {
            // 自动追加：由插件系统把"已加载但未被 MENUS 列出"的插件挂到最后一个菜单组末尾。
            editor.Apply("right_click_menu", new[]
            {
                new KeyWrite("FIND_LOST_PLUGINS", true, KeyWritePolicy.SetIfDifferent),
            });
        }

        return editor;
    }

    private static List<PlannedFile> CollectFiles(
        InstallManifest manifest,
        string manifestPath,
        string manifestDir,
        string contentDir,
        string targetDir,
        List<string> warnings)
    {
        var result = new List<PlannedFile>();
        var seenTargets = new HashSet<string>(PathComparison == StringComparison.OrdinalIgnoreCase
            ? StringComparer.OrdinalIgnoreCase
            : StringComparer.Ordinal);

        void Add(string sourceFile, string relative)
        {
            var target = Path.GetFullPath(Path.Combine(targetDir, relative));
            if (!FileSystemHelper.IsWithin(target, targetDir))
            {
                throw new InstallException($"映射到目标目录之外，已拒绝：{relative}");
            }

            if (!seenTargets.Add(target))
            {
                warnings.Add($"重复的安装条目被忽略：{relative}");
                return;
            }

            result.Add(new PlannedFile(sourceFile, target, relative.Replace('\\', '/'), File.Exists(target)));
        }

        if (manifest.Files.Count > 0)
        {
            foreach (var entry in manifest.Files)
            {
                if (entry.Length == 0)
                {
                    continue;
                }
                if (Path.IsPathRooted(entry))
                {
                    throw new InstallException($"install.files 不允许绝对路径：{entry}");
                }

                var full = Path.GetFullPath(Path.Combine(contentDir, entry));
                if (!FileSystemHelper.IsWithin(full, contentDir))
                {
                    throw new InstallException($"install.files 条目逃逸出核心目录：{entry}");
                }

                if (File.Exists(full))
                {
                    Add(full, Path.GetRelativePath(contentDir, full));
                }
                else if (Directory.Exists(full))
                {
                    foreach (var file in FileSystemHelper.EnumerateFiles(full))
                    {
                        Add(file, Path.GetRelativePath(contentDir, file));
                    }
                }
                else
                {
                    throw new InstallException($"install.files 条目不存在：{entry}（相对 {contentDir}）");
                }
            }
            return result;
        }

        var isPackageRoot = string.Equals(
            contentDir.TrimEnd(Path.DirectorySeparatorChar),
            manifestDir.TrimEnd(Path.DirectorySeparatorChar),
            PathComparison);

        foreach (var file in FileSystemHelper.EnumerateFiles(contentDir))
        {
            var relative = Path.GetRelativePath(contentDir, file);
            if (ShouldSkip(relative, file, manifestPath, isPackageRoot))
            {
                continue;
            }
            Add(file, relative);
        }

        if (result.Count == 0)
        {
            throw new InstallException($"插件包里没有可安装的文件：{contentDir}\n" +
                                       "请检查 install.source / install.files。");
        }

        return result;
    }

    /// <summary>整目录复制时的默认排除项（显式 install.files 不受影响）。</summary>
    private static bool ShouldSkip(string relative, string fullPath, string manifestPath, bool isPackageRoot)
    {
        if (string.Equals(Path.GetFullPath(fullPath), Path.GetFullPath(manifestPath), PathComparison))
        {
            return true;
        }

        var segments = relative.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        foreach (var segment in segments)
        {
            if (segment.StartsWith('.'))
            {
                return true;
            }
            if (string.Equals(segment, "node_modules", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        // 只有"直接把包根当核心目录"时才顺带排除文档，避免把 README 装进 plugin/。
        if (isPackageRoot && segments.Length == 1)
        {
            var name = segments[0];
            if (name.EndsWith(".md", StringComparison.OrdinalIgnoreCase) ||
                name.StartsWith("README", StringComparison.OrdinalIgnoreCase) ||
                name.StartsWith("LICENSE", StringComparison.OrdinalIgnoreCase) ||
                name.StartsWith("CHANGELOG", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static bool LooksLikePluginDirectory(string targetDir) =>
        File.Exists(Path.Combine(targetDir, "global", "settings", "settings.default.toml")) ||
        Directory.Exists(Path.Combine(targetDir, "global", "core")) ||
        File.Exists(Path.Combine(targetDir, "index.js"));

    /// <summary>
    /// 复刻运行时的 <c>utils.settings.getUserTomlPath()</c>：
    /// <c>~/.config/typora_plugin/settings.user.toml</c> 存在就用它，否则用插件目录里那份。
    /// </summary>
    private static (string Path, bool FromProfile) ResolveSettingsPath(string targetDir)
    {
        var home = HomeDirectoryProvider();
        if (!string.IsNullOrEmpty(home))
        {
            var userPath = Path.Combine(home, ".config", "typora_plugin", "settings.user.toml");
            if (File.Exists(userPath))
            {
                return (userPath, true);
            }
        }

        return (Path.Combine(targetDir, "global", "settings", "settings.user.toml"), false);
    }

    private static void CheckMenuClickability(
        InstallManifest manifest,
        string entryJs,
        string entryIndex,
        IReadOnlyList<PlannedFile> files,
        List<string> warnings)
    {
        var candidate = File.Exists(entryJs)
            ? entryJs
            : File.Exists(entryIndex)
                ? entryIndex
                : files.FirstOrDefault(f =>
                    string.Equals(f.TargetPath, entryJs, PathComparison) ||
                    string.Equals(f.TargetPath, entryIndex, PathComparison))?.SourcePath;

        if (candidate == null || !File.Exists(candidate))
        {
            return;
        }

        string content;
        try
        {
            content = File.ReadAllText(candidate);
        }
        catch
        {
            return;
        }

        if (!ActionDefinitionPattern.IsMatch(content))
        {
            warnings.Add(
                $"在 {Path.GetFileName(candidate)} 里没有检测到 call / staticActions / getDynamicActions 定义。" +
                "按 right_click_menu 的实现，菜单项会被置灰且无法点击（pointer-events: none）。");
        }
    }

    /// <summary>把结果渲染成纯文本（CLI 与 GUI 共用）。</summary>
    public static string Render(InstallResult result)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(Environment.NewLine, result.Log));
        if (result.Plan.Warnings.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("提示 / 警告：");
            foreach (var warning in result.Plan.Warnings)
            {
                sb.AppendLine($"  - {warning}");
            }
        }
        return sb.ToString().TrimEnd();
    }
}
