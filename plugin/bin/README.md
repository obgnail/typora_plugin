# Installation Troubleshooting Guide / 安装故障排除指南

Welcome! If you encounter any issues while installing or using the Typora-Plugin, this guide will help you resolve them quickly.
欢迎！如果你在安装或使用 Typora-Plugin 时遇到问题，本指南将帮助你快速排查并解决。



## 🇺🇸 English Version

### Common Problems & Solutions

#### Plugin Not Found or "File Write Failed" Error

If the console says "Installation Successful" but Typora cannot find the plugin, or Typora shows a "File write failed" error after opening, please check the following:

1. Check Typora version: The minimum supported Typora version for this plugin is **0.9.98** (the last free version). Please ensure your Typora is up to date.
2. Fix permissions: This is usually caused by insufficient folder permissions. You have two ways to fix this:
   * Method 1 (Automatic): Right-click the `ensure_permissions.ps1` file in this directory and select "Run with PowerShell". This will automatically grant the necessary read/write permissions to the plugin folders.
   * Method 2 (Manual): If the script fails or you prefer not to use PowerShell, you can configure permissions manually:
     1. Go to your Typora installation directory and locate the `plugin` folder (the parent folder of this `bin` directory).
     2. Right-click the `plugin` folder and select **Properties**.
     3. Switch to the **Security** tab and click the **Edit** button.
     4. In the "Group or user names" list, select your current user account (or the "Users" group).
     5. In the permissions list below, check the **Allow** box next to **Full control** (or at least Modify and Write).
     6. Click **OK** to save. *(For Linux users, you can manually run `sudo chmod -R 777 <path-to-plugin-folder>` in terminal).*
3. Reinstall: If the issue persists, try a clean reinstallation:
   * Windows: Run `uninstall_windows.ps1` first, then run `install_windows.ps1`.
   * Linux: Run `uninstall_linux.sh` first, then run `install_linux.sh`.

#### PowerShell Script Closes Instantly or Displays Errors

Windows restricts the execution of `.ps1` scripts by default for security reasons. Depending on how you run it, the window might flash and close instantly, or you might see a red error message about "Execution Policy" in the terminal.

* Alternative (Recommended for normal users): You can directly double-click `install_windows_amd_x64.exe` to install without using PowerShell.
* Advanced Solution: If you need to modify your execution policy to run scripts, please refer to [Microsoft's official documentation on Execution Policies](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies) for secure guidance.

#### Installing Without Administrator Privileges on Windows

Yes, you can run `install_windows_amd_x64.exe` located in this folder. However, please note that this executable does not automatically configure file permissions. You might need to manually run `ensure_permissions.ps1` afterward or manually modify the folder permissions (refer to section 1.1) to ensure the plugin works properly.

### What do the files in `bin` do?

* `install_windows.ps1` / `install_linux.sh`: The standard automated installers. They safely inject the plugin code into Typora's core files (`window.html`) and configure the correct folder permissions.
* `uninstall_windows.ps1` / `uninstall_linux.sh`: The uninstallation scripts. They cleanly remove the plugin code from Typora and restore it to its original state.
* `ensure_permissions.ps1`: A utility script for Windows to fix read/write permission issues. It forces "Full Control" access for users to the plugin and settings directories.
* `install_windows_amd_x64.exe`: A lightweight Windows installer. Compiled via `x86_64-w64-mingw32-gcc -m64 -Os -s -static-libgcc install.c -o install_windows_amd_x64.exe`, it performs the same code injection as the `.ps1` script but doesn't require Administrator privileges (it skips the permission setup phase).
* `move_settings_files.ps1` / `move_settings_files.sh`: Configuration migration scripts designed for advanced users. It moves your configuration files (`settings.user.toml`, `custom_plugin.user.toml`) between the plugin folder and your system user directory (`~/.config/typora_plugin`). **Note: Configuration files in the system user directory have a higher priority than those in the plugin directory.** *(You don't need this script for normal plugin upgrades, as the upgrade process automatically preserves your personal settings).*
* `typora-plugin.sh`: A quick-run helper script for Linux that executes `move_settings_files.sh` safely without overwriting your existing files.
* `version.json`: Contains the current version information of the plugin.

### Additional Helpful Tips

1. Always close Typora before installing/uninstalling: Modifying files while Typora is running can lead to corrupted files or failed installations.
2. How to check for specific errors: If a plugin feature isn't working, you can open Typora's Developer Tools (usually by pressing `Shift + F12`) and check the "Console" tab for specific red error messages. This is very helpful when submitting an issue to the author.



## 🇨🇳 简体中文版

### 常见问题与解决方案

#### 安装成功但找不到插件，或提示“文件写入失败”

如果显示安装成功但 Typora 找不到插件，或者打开 Typora 后提示 “文件写入失败”，请按以下步骤排查：

1. 检查版本：Typora-Plugin 支持的最低 Typora 版本为 **0.9.98**（最后一个免费版本）。请确保你的版本符合要求。
2. 权限问题：这通常是因为插件目录缺少写入权限导致的。你有两种方式修复：
   * 方法一（自动脚本）：右键本目录下的 `ensure_permissions.ps1` 脚本，选择 “使用 PowerShell 运行” 自动进行赋权。
   * 方法二（手动配置）：如果脚本运行失败或你不想使用 PowerShell，可以手动修改文件夹权限：
     1. 找到 Typora 安装目录下的 `plugin` 文件夹（也就是当前 `bin` 目录的上一级文件夹）。
     2. 右键点击 `plugin` 文件夹，选择 **属性**。
     3. 切换到 **安全** 选项卡，点击下方的 **编辑** 按钮。
     4. 在“组或用户名”列表中，选中你当前的系统登录用户（或直接选择“Users”组）。
     5. 在下方的权限列表中，勾选 **完全控制**（或至少勾选修改和写入）后面的 **允许** 框。
     6. 点击 **确定** 保存并应用。 *(注：如果是 Linux 用户，可以在终端直接执行 `sudo chmod -R 777 <插件目录路径>`)*。
3. 尝试重新安装：如果依旧报错，请尝试重装：
   * Windows 平台：先执行 `uninstall_windows.ps1`，之后再执行 `install_windows.ps1`。
   * Linux 平台：先执行 `uninstall_linux.sh`，之后再执行 `install_linux.sh`。

#### 运行 PowerShell 脚本时闪退或提示红字报错

当前 Windows 系统默认限制了 `.ps1` 脚本的执行权限，这是系统的安全机制。根据你的运行方式，表现可能是右键运行时直接闪退，或者在终端中执行时看到关于 “执行策略” 的红字报错。

* 备选方案（推荐普通用户使用）：直接双击运行本目录下的 `install_windows_amd_x64.exe` 进行安装，完全不需要配置 PowerShell。
* 高级解决方案：如果你清楚其中的风险，并希望通过修改执行策略来运行脚本，请参考 [微软官方文档：关于执行策略](https://learn.microsoft.com/zh-cn/powershell/module/microsoft.powershell.core/about/about_execution_policies) 进行安全配置。

#### Windows 下能否免管理员权限安装？

可以。你可以执行同目录下的 `install_windows_amd_x64.exe`，但请注意，该程序没有做自动赋权操作。如果后续使用遇到问题，可能仍需要手动运行 `ensure_permissions.ps1` 或者手动修改文件夹权限（参考 2.1 章节）以确保插件正常工作。

### `bin` 目录下文件的功能介绍

* `install_windows.ps1` / `install_linux.sh`：标准的自动化安装脚本。负责将插件代码注入到 Typora 的核心文件（`window.html`）中，并自动配置好读写权限。
* `uninstall_windows.ps1` / `uninstall_linux.sh`：卸载脚本。负责将 Typora 核心文件中的插件代码抹除，使其恢复原状。
* `ensure_permissions.ps1`：Windows 权限修复脚本。如果你在保存配置时遇到 “文件写入失败” 的报错，运行它会赋予 plugin 目录和配置文件 “完全控制” 的权限。
* `install_windows_amd_x64.exe`：轻量级 Windows 安装程序。该程序由 `x86_64-w64-mingw32-gcc -m64 -Os -s -static-libgcc install.c -o install_windows_amd_x64.exe` 编译而成。其功能等同于 `.ps1` 安装脚本，但不请求管理员权限（因此跳过了权限分配步骤）。
* `move_settings_files.ps1` / `move_settings_files.sh`：配置迁移脚本。此脚本专为希望将配置文件独立出去的高级用户准备，用于将你的个性化配置文件（`settings.user.toml`, `custom_plugin.user.toml`）迁移到系统用户目录（`~/.config/typora_plugin`）。**请注意：系统用户目录下的配置文件优先级高于插件目录下的配置文件。**（注：日常升级插件时脚本会自动处理个人配置，通常无需手动运行此迁移配置脚本）。
* `typora-plugin.sh`：Linux 环境下的快捷辅助脚本，用于静默调用迁移脚本，且不会覆盖现有配置。
* `version.json`：记录当前插件版本。

### 其他有用的排查技巧

1. 安装前请关闭 Typora：在 Typora 仍在运行或后台常驻时执行安装/卸载脚本，可能导致文件被占用或损坏。
2. 善用开发者工具：如果在运行过程中某个功能失效，你可以按下 `Shift + F12` 唤出 Typora 的开发者工具，切换到 Console（控制台）标签页。如果有红色的报错文本，截图附在 Issue 中可以极大提高作者帮你排查问题的效率。

