namespace TyporaPluginInstaller.Tests;

/// <summary>测试用临时目录。</summary>
internal sealed class TempDir : IDisposable
{
    public TempDir(string prefix = "tpi-test")
    {
        Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"{prefix}-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path);
    }

    public string Path { get; }

    public string Write(string relativePath, string content)
    {
        var full = System.IO.Path.Combine(Path, relativePath);
        var directory = System.IO.Path.GetDirectoryName(full);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }
        File.WriteAllText(full, content);
        return full;
    }

    public string Read(string relativePath) => File.ReadAllText(System.IO.Path.Combine(Path, relativePath));

    public bool Exists(string relativePath) => File.Exists(System.IO.Path.Combine(Path, relativePath));

    public void Dispose()
    {
        try
        {
            Directory.Delete(Path, recursive: true);
        }
        catch
        {
            // 测试清理失败不影响结论
        }
    }
}

/// <summary>临时替换安装引擎读取的"用户主目录"。</summary>
internal sealed class HomeScope : IDisposable
{
    private readonly Func<string?> _original;

    public HomeScope(string? home)
    {
        _original = Core.Install.InstallEngine.HomeDirectoryProvider;
        Core.Install.InstallEngine.HomeDirectoryProvider = () => home;
    }

    public void Dispose() => Core.Install.InstallEngine.HomeDirectoryProvider = _original;
}
