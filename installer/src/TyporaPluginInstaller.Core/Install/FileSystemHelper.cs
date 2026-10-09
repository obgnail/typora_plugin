namespace TyporaPluginInstaller.Core.Install;

/// <summary>与平台无关的路径/文件小工具。</summary>
internal static class FileSystemHelper
{
    private static readonly StringComparison PathComparison =
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    /// <summary>判断 <paramref name="candidate"/> 是否等于 <paramref name="root"/> 或位于其下。</summary>
    public static bool IsWithin(string candidate, string root)
    {
        var fullCandidate = Path.GetFullPath(candidate).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var fullRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

        if (string.Equals(fullCandidate, fullRoot, PathComparison))
        {
            return true;
        }

        return fullCandidate.StartsWith(fullRoot + Path.DirectorySeparatorChar, PathComparison);
    }

    /// <summary>递归枚举文件；跳过符号链接目录，避免无限递归。</summary>
    public static IEnumerable<string> EnumerateFiles(string directory)
    {
        var stack = new Stack<string>();
        stack.Push(directory);
        while (stack.Count > 0)
        {
            var current = stack.Pop();
            foreach (var file in Directory.EnumerateFiles(current))
            {
                yield return file;
            }

            foreach (var sub in Directory.EnumerateDirectories(current))
            {
                var info = new DirectoryInfo(sub);
                if (info.LinkTarget != null)
                {
                    continue;
                }
                stack.Push(sub);
            }
        }
    }

    public static void CopyFile(string source, string target, bool overwrite)
    {
        var directory = Path.GetDirectoryName(target);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }
        File.Copy(source, target, overwrite);
    }
}
