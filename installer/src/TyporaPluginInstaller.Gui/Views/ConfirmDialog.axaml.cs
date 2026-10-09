using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;

namespace TyporaPluginInstaller.Gui.Views;

public partial class ConfirmDialog : Window
{
    public ConfirmDialog()
    {
        AvaloniaXamlLoader.Load(this);
        this.FindControl<Button>("OkButton")!.Click += (_, _) => Close(true);
        this.FindControl<Button>("CancelButton")!.Click += (_, _) => Close(false);
    }

    public static Task<bool> ShowAsync(Window owner, string message)
    {
        var dialog = new ConfirmDialog();
        dialog.FindControl<TextBlock>("MessageText")!.Text = message;
        return dialog.ShowDialog<bool>(owner);
    }
}
