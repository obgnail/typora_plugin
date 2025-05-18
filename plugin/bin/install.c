#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
#include <libgen.h>

#ifdef _WIN32
#define PATH_SEPARATOR '\\'
#else
#include <linux/limits.h>
#define PATH_SEPARATOR '/'
#endif

#define APP "app"
#define APP_SRC "appsrc"
#define WINDOW_HTML "window.html"
#define WINDOW_HTML_BAK "window.html.bak"
#define PLUGIN_SCRIPT "<script src=\"./plugin/index.js\" defer=\"defer\"></script>"
#define OLD_FRAME_SCRIPT "<script src=\"./app/window/frame.js\" defer=\"defer\"></script>"
#define NEW_FRAME_SCRIPT "<script src=\"./appsrc/window/frame.js\" defer=\"defer\"></script>"

void finish(const char *message) {
    if (message) {
        fprintf(stderr, "%s\n", message);
    }
    printf("Press Enter to exit...");
    getchar();
    exit(0);
}

int main() {
    char cwd[PATH_MAX];
    char root_path[PATH_MAX];
    char app_path[PATH_MAX];
    char appsrc_path[PATH_MAX];
    char window_html_path[PATH_MAX];
    char window_html_bak_path[PATH_MAX];
    const char *frame_script;

    getcwd(cwd, PATH_MAX);
    strcpy(root_path, dirname(dirname(cwd)));
    sprintf(app_path, "%s%c%s", root_path, PATH_SEPARATOR, APP);
    sprintf(appsrc_path, "%s%c%s", root_path, PATH_SEPARATOR, APP_SRC);
    sprintf(window_html_path, "%s%c%s", root_path, PATH_SEPARATOR, WINDOW_HTML);
    sprintf(window_html_bak_path, "%s%c%s", root_path, PATH_SEPARATOR, WINDOW_HTML_BAK);

    printf("[1/5] Check if window.html exists in %s\n", root_path);
    struct stat st;
    if (stat(window_html_path, &st) == -1) {
        finish("window.html does not exist in the root path");
    }

    printf("[2/5] Check if app/appsrc exists in %s\n", root_path);
    if (stat(appsrc_path, &st) == 0) {
        frame_script = NEW_FRAME_SCRIPT;
    } else if (stat(app_path, &st) == 0) {
        frame_script = OLD_FRAME_SCRIPT;
    } else {
        finish("appsrc/app does not exist in the root path");
    }

    FILE *window_html_fp = fopen(window_html_path, "r+");
    if (window_html_fp == NULL) {
        finish("Failed to open window.html");
    }

    fseek(window_html_fp, 0, SEEK_END);
    long window_html_size = ftell(window_html_fp);
    rewind(window_html_fp);
    char *file_content = malloc(window_html_size + 1);
    if (file_content == NULL) {
        finish("Memory allocation failed");
    }
    fread(file_content, sizeof(char), window_html_size, window_html_fp);
    file_content[window_html_size] = '\0';

    printf("[3/5] Check window.html content\n");
    char *p = strstr(file_content, frame_script);
    if (p == NULL) {
        finish("window.html does not contain the frame script");
    }
    if (strstr(file_content, PLUGIN_SCRIPT) != NULL) {
        printf("Plugin has already been installed\n");
        free(file_content);
        finish(NULL);
    }

    printf("[4/5] Backup window.html\n");
    FILE *window_html_bak_fp = fopen(window_html_bak_path, "w");
    if (window_html_bak_fp == NULL) {
        finish("Failed to open window.html.bak");
    }
    fwrite(file_content, 1, strlen(file_content), window_html_bak_fp);
    fclose(window_html_bak_fp);

    printf("[5/5] Update window.html\n");
    fseek(window_html_fp, 0, SEEK_SET);
    char replacement[strlen(frame_script) + strlen(PLUGIN_SCRIPT) + 1];
    sprintf(replacement, "%s%s", frame_script, PLUGIN_SCRIPT);
    char new_file_content[window_html_size + strlen(PLUGIN_SCRIPT) + 1];
    sprintf(new_file_content, "%.*s%s%s", (int) (p - file_content), file_content, replacement, p + strlen(frame_script));
    fwrite(new_file_content, 1, strlen(new_file_content), window_html_fp);

    fclose(window_html_fp);
    free(file_content);
    printf("Plugin installed successfully\n");
    finish(NULL);

    return 0;
}
