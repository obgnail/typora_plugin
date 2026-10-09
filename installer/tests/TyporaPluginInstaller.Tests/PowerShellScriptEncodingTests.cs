using Xunit;

namespace TyporaPluginInstaller.Tests;

/// <summary>
/// 守住 PowerShell 脚本的编码：必须是纯 ASCII。
///
/// Windows PowerShell 5.1 读取**无 BOM** 的 .ps1 时用的是系统 ANSI 代码页，而不是 UTF-8。
/// 非 ASCII 字节会变成乱码；更糟的是在双字节代码页（简中 GBK / 繁中 Big5 / 日文 Shift-JIS /
/// 韩文）下，一个前导字节遇到非法尾字节时会把**后一个字节一起吃掉**——那常常正好是字符串的
/// 结束引号——于是解析器报出一串和实际内容毫无关系的语法错误（"意外的标记 }"、
/// "字符串缺少终止符"、"赋值表达式无效"），而且换台机器、换个语言就复现不了。
///
/// 纯 ASCII 在任何代码页下解码结果都一样，也从不需要 BOM，所以这条规矩能把整整一类问题挡在门外。
/// 同理，别在 .ps1 里写中文注释——注释一样会被解码，一样会吃掉后面的字节。
/// </summary>
public class PowerShellScriptEncodingTests
{
    [Fact]
    public void Every_powershell_script_is_pure_ascii()
    {
        var root = FindInstallerRoot();
        var scripts = Directory
            .EnumerateFiles(root, "*.ps1", SearchOption.AllDirectories)
            .Where(path => !IsBuildOutput(path))
            .OrderBy(path => path, StringComparer.Ordinal)
            .ToList();

        Assert.NotEmpty(scripts);

        var offenders = new List<string>();
        foreach (var script in scripts)
        {
            var bytes = File.ReadAllBytes(script);
            var offset = Array.FindIndex(bytes, b => b > 0x7F);
            if (offset >= 0)
            {
                offenders.Add(
                    $"{Path.GetRelativePath(root, script)}: byte {offset} is 0x{bytes[offset]:X2}");
            }
        }

        Assert.True(offenders.Count == 0,
            "PowerShell 脚本必须保持纯 ASCII（见 PowerShellScriptEncodingTests 的说明）：" +
            Environment.NewLine + string.Join(Environment.NewLine, offenders));
    }

    /// <summary>从测试程序集所在目录往上找到 installer 根目录（以 build/build.ps1 为标志）。</summary>
    private static string FindInstallerRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir != null; dir = dir.Parent)
        {
            if (File.Exists(Path.Combine(dir.FullName, "build", "build.ps1")))
            {
                return dir.FullName;
            }
        }

        throw new InvalidOperationException("找不到 installer 根目录（build/build.ps1）。");
    }

    private static bool IsBuildOutput(string path)
    {
        var sep = Path.DirectorySeparatorChar;
        return path.Contains($"{sep}bin{sep}")
            || path.Contains($"{sep}obj{sep}")
            || path.Contains($"{sep}node_modules{sep}")
            || path.Contains($"{sep}.cache{sep}");
    }
}
