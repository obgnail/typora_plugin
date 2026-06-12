#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
    #include <direct.h>
    #include <io.h>
    #define getcwd _getcwd
    #define PATH_SEPARATOR '\\'
    #define FILE_EXISTS(path) (_access((path), 0) == 0)
#else
    #include <unistd.h>
    #include <libgen.h>
    #include <linux/limits.h>
    #define PATH_SEPARATOR '/'
    #define FILE_EXISTS(path) (access((path), F_OK) == 0)
#endif

#ifndef PATH_MAX
    #define PATH_MAX 4096
#endif

#define APP "app"
#define APP_SRC "appsrc"
#define WINDOW_HTML "window.html"
#define WINDOW_HTML_BAK "window.html.bak"
#define PLUGIN_SCRIPT "<script src=\"./plugin/index.js\" defer=\"defer\"></script>"
#define OLD_FRAME_SCRIPT "<script src=\"./app/window/frame.js\" defer=\"defer\"></script>"
#define NEW_FRAME_SCRIPT "<script src=\"./appsrc/window/frame.js\" defer=\"defer\"></script>"

typedef struct {
    FILE *fp;
    char *buffer;
} Resource;

void cleanup(Resource *res) {
    if (res->fp) {
        fclose(res->fp);
        res->fp = NULL;
    }
    if (res->buffer) {
        free(res->buffer);
        res->buffer = NULL;
    }
}

void finish(const char *message, Resource *res) {
    if (res) cleanup(res);
    if (message) fprintf(stderr, "\nError: %s\n", message);
    printf("\nPress Enter to exit...");
    getchar();
    exit(message ? 1 : 0);
}

void get_root_dir(char *path) {
    for (int i = 0; i < 2; ++i) {
        char *last_sep = strrchr(path, PATH_SEPARATOR);
        if (last_sep != NULL) {
            *last_sep = '\0';
        } else {
            break;
        }
    }
    if (strlen(path) == 0) strcpy(path, ".");
}

int main() {
    char cwd[PATH_MAX];
    char root_path[PATH_MAX];
    char temp_path[PATH_MAX];
    Resource res = {NULL, NULL};

    if (!getcwd(cwd, PATH_MAX)) finish("Failed to get current directory", NULL);

    strncpy(root_path, cwd, PATH_MAX);
    get_root_dir(root_path);

    printf("[1/5] Checking if window.html exists in %s\n", root_path);
    snprintf(temp_path, PATH_MAX, "%s%c%s", root_path, PATH_SEPARATOR, WINDOW_HTML);
    if (!FILE_EXISTS(temp_path)) finish("window.html not found", NULL);

    printf("[2/5] Checking target application directory\n");
    const char *frame_script = NULL;
    char check_path[PATH_MAX];

    snprintf(check_path, PATH_MAX, "%s%c%s", root_path, PATH_SEPARATOR, APP_SRC);
    if (FILE_EXISTS(check_path)) {
        frame_script = NEW_FRAME_SCRIPT;
        printf("      -> Detected 'appsrc' environment\n");
    } else {
        snprintf(check_path, PATH_MAX, "%s%c%s", root_path, PATH_SEPARATOR, APP);
        if (FILE_EXISTS(check_path)) {
            frame_script = OLD_FRAME_SCRIPT;
            printf("      -> Detected 'app' environment\n");
        } else {
            finish("Neither 'app' nor 'appsrc' directory found", NULL);
        }
    }

    printf("[3/5] Analyzing window.html content\n");
    res.fp = fopen(temp_path, "rb");
    if (!res.fp) finish("Failed to open window.html for reading", NULL);

    fseek(res.fp, 0, SEEK_END);
    long size = ftell(res.fp);
    rewind(res.fp);

    res.buffer = malloc(size + 1);
    if (!res.buffer) finish("Memory allocation failed", &res);

    if (fread(res.buffer, 1, size, res.fp) != (size_t)size) finish("Failed to read file completely", &res);
    res.buffer[size] = '\0';
    fclose(res.fp);
    res.fp = NULL;

    char *pos = strstr(res.buffer, frame_script);
    if (!pos) finish("Could not find required frame script tag in window.html", &res);

    if (strstr(res.buffer, PLUGIN_SCRIPT)) {
        printf("      -> Plugin is already installed. No changes needed.\n");
        finish(NULL, &res);
    }

    printf("[4/5] Creating backup of window.html\n");
    char bak_path[PATH_MAX];
    snprintf(bak_path, PATH_MAX, "%s%c%s", root_path, PATH_SEPARATOR, WINDOW_HTML_BAK);
    FILE *bak_fp = fopen(bak_path, "wb");
    if (!bak_fp) finish("Failed to create backup file", &res);
    if (fwrite(res.buffer, 1, size, bak_fp) != (size_t)size) {
        fclose(bak_fp);
        finish("Failed to write backup file completely", &res);
    }
    fclose(bak_fp);

    printf("[5/5] Updating window.html with plugin script\n");
    res.fp = fopen(temp_path, "wb");
    if (!res.fp) finish("Failed to open window.html for writing", &res);

    size_t head_len = pos - res.buffer;
    size_t script_len = strlen(frame_script);
    size_t plugin_len = strlen(PLUGIN_SCRIPT);
    size_t tail_len = strlen(pos + script_len);

    if (fwrite(res.buffer, 1, head_len, res.fp) != head_len ||
        fwrite(frame_script, 1, script_len, res.fp) != script_len ||
        fwrite(PLUGIN_SCRIPT, 1, plugin_len, res.fp) != plugin_len ||
        fwrite(pos + script_len, 1, tail_len, res.fp) != tail_len) {
        finish("Failed to write updated content to window.html completely", &res);
    }

    printf("\n[Success] Plugin installed successfully!\n");
    finish(NULL, &res);

    return 0;
}
