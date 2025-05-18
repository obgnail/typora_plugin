This document explains how to customize plugin styles through the `user_styles` directory.



## How It Works

When the plugin system loads styles, files located in the `./plugin/global/user_styles` directory have higher priority than files with the same name in the `./plugin/global/styles` directory. Therefore, you can customize styles by creating CSS files in the `user_styles` directory with the same names as those in the `styles` directory to override the default styles.



## How to Use

1. **Copy Files**: **Copy** the CSS files from the `styles` directory that you wish to modify into the `user_styles` directory.
2. **Modify Files**: Directly modify the copied CSS files within the `user_styles` directory.
3. **Add Custom Styles**: If you only need to add a small amount of custom CSS, you can create a file named `customize.css` in the `user_styles` directory and add your CSS code there.



## Render Variables

In the CSS files within the `styles` and `user_styles` directories, the syntax `${variable}` is supported for render variables, similar to `@` variables in Less. These variables will be replaced with specific values during the style loading process. For example:

```css
/* styles/toolbar.css */
#plugin-toolbar {
    /* ${topPercent} will be replaced with a specific value when loaded */
    top: ${topPercent};
}
```



## Important Note: Developer Recommendation

**Developers generally do not recommend users manually modify styles** for the following reasons:

- Many style adjustments can be achieved by modifying configuration, without needing to directly modify CSS files.
- During plugin iteration, styles and JavaScript code may be deeply intertwined, and manual modifications could lead to style disruption or bugs.

If you have better style or interaction suggestions, you are welcome to submit a Pull Request. If you encounter issues after manually modifying styles, try deleting or moving all files in the `user_styles` directory.
