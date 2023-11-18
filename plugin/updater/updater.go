package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/juju/errors"
	"io"
	"io/fs"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Installer struct {
	root          string
	insertFile    string
	insertContent string
}

func newInstaller() (*Installer, error) {
	fmt.Println("[step 1] new installer")
	curDir, err := os.Getwd()
	if err != nil {
		return nil, errors.Trace(err)
	}
	return &Installer{
		root:          filepath.Dir(filepath.Dir(curDir)),
		insertFile:    "window.html",
		insertContent: `<script src="./plugin/index.js" defer="defer"></script>`,
	}, nil
}

func (i *Installer) prepare() (err error) {
	fmt.Println("[step 2] prepare")
	if err = checkExist(i.root, i.insertFile); err != nil {
		return errors.Trace(err)
	}
	return nil
}

func (i *Installer) backupFile() (err error) {
	fmt.Println("[step 3] backup file")
	filePath := filepath.Join(i.root, i.insertFile)
	backupFilePath := filePath + ".bak"
	if err = copyFile(filePath, backupFilePath); err != nil {
		return errors.Trace(err)
	}
	return nil
}

func (i *Installer) run() (err error) {
	fmt.Println("[step 4] update window.html")
	filePath := filepath.Join(i.root, i.insertFile)
	file, err := ioutil.ReadFile(filePath)
	if err != nil {
		return errors.Trace(err)
	}
	if bytes.Contains(file, []byte(i.insertContent)) {
		fmt.Println("had installed")
		return
	}

	match := ""
	betaMatch := `<script src="./app/window/frame.js" defer="defer"></script>`
	normalMatch := `<script src="./appsrc/window/frame.js" defer="defer"></script>`
	if bytes.Contains(file, []byte(betaMatch)) {
		match = betaMatch
	} else if bytes.Contains(file, []byte(normalMatch)) {
		match = normalMatch
	}
	if match == "" {
		return fmt.Errorf("has not match")
	}

	result := bytes.Replace(file, []byte(match), []byte(match+i.insertContent), 1)
	err = ioutil.WriteFile(filePath, result, 0644)
	if err != nil {
		return errors.Trace(err)
	}
	return nil
}

type Updater struct {
	url     string
	timeout int
	proxy   *url.URL

	root         string
	versionFile  string
	downloadFile string
	workDir      string
	unzipDir     string

	pluginDir       string
	customPluginDir string
	dontNeedUpdate  []string

	oldVersionInfo *VersionInfo
	newVersionInfo *VersionInfo
}

func NewUpdater(proxy string, timeout int) (*Updater, error) {
	fmt.Println("[1/9] new updater")
	curDir, err := os.Getwd()
	if err != nil {
		return nil, errors.Trace(err)
	}

	tempDir, err := ioutil.TempDir("", "unzip-")
	if err != nil {
		return nil, errors.Trace(err)
	}

	var uri *url.URL
	if proxy != "" {
		if uri, err = url.Parse(proxy); err != nil {
			return nil, errors.Trace(err)
		}
	}

	if timeout < 30 {
		timeout = 600
	}

	updater := &Updater{
		url:             "https://api.github.com/repos/obgnail/typora_plugin/releases/latest",
		timeout:         timeout,
		proxy:           uri,
		root:            filepath.Dir(filepath.Dir(curDir)),
		versionFile:     filepath.Join(curDir, "version.json"),
		downloadFile:    filepath.Join(tempDir, "download.zip"),
		workDir:         tempDir, // 使用临时目录，避免爆炸
		pluginDir:       "./plugin",
		customPluginDir: "./plugin/custom/plugins",
		dontNeedUpdate: []string{
			"./plugin/global/settings/custom_plugin.user.toml",
			"./plugin/global/settings/settings.user.toml",
			"./plugin/global/settings/hotkey.user.toml",
			"./plugin/global/user_styles",
			"./plugin/window_tab/save_tabs.json",
			"./plugin/custom/plugins/reopenClosedFiles/remain.json",
			"./plugin/custom/plugins/scrollBookmarker/bookmark.json",
		},
		unzipDir:       "",
		oldVersionInfo: nil,
		newVersionInfo: nil,
	}
	return updater, nil
}

func (u *Updater) newHTTPClient() *http.Client {
	client := &http.Client{Timeout: time.Duration(u.timeout) * time.Second}
	if u.proxy != nil {
		client.Transport = &http.Transport{Proxy: http.ProxyURL(u.proxy)}
	}
	return client
}

type VersionInfo struct {
	TagName    string `json:"tag_name"`
	Name       string `json:"name"`
	Body       string `json:"body"`
	ZipBallUrl string `json:"zipball_url"`
}

func (u *Updater) needUpdate() (bool, error) {
	fmt.Println("[2/9] check whether need update")
	var err error
	if u.newVersionInfo, err = u.getLatestVersion(); err != nil {
		return false, errors.Trace(err)
	}
	if u.oldVersionInfo, err = u.getCurrentVersion(); err != nil {
		return true, nil
	}
	need := u.compareVersion(u.newVersionInfo.TagName, u.oldVersionInfo.TagName) != 0
	return need, nil
}

func (u *Updater) getCurrentVersion() (versionInfo *VersionInfo, err error) {
	if err = checkExist(u.versionFile, ""); err != nil {
		err = errors.Trace(err)
		return
	}
	fileContent, err := ioutil.ReadFile(u.versionFile)
	if err != nil {
		err = errors.Trace(err)
		return
	}
	body := &VersionInfo{}
	if err = json.Unmarshal(fileContent, body); err != nil {
		err = errors.Trace(err)
		return
	}
	return body, nil
}

func (u *Updater) getLatestVersion() (versionInfo *VersionInfo, err error) {
	client := u.newHTTPClient()
	resp, err := client.Get(u.url)
	if err != nil {
		err = errors.Trace(err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		err = fmt.Errorf("error status code: %d", resp.StatusCode)
		return
	}

	bodyContent, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		err = errors.Trace(err)
		return
	}

	versionInfo = &VersionInfo{}
	if err = json.Unmarshal(bodyContent, versionInfo); err != nil {
		err = errors.Trace(err)
		return
	}
	return
}

// 1.2.16
func (u *Updater) compareVersion(v1, v2 string) (result int) {
	if v1 == "" && v2 != "" {
		return -1
	} else if v2 == "" && v1 != "" {
		return 1
	}

	v1Arr := strings.Split(v1, ".")
	v2Arr := strings.Split(v2, ".")
	len1 := len(v1Arr)
	len2 := len(v2Arr)

	for i := 0; i < len1 || i < len2; i++ {
		var n1, n2 int
		if i < len1 {
			n1, _ = strconv.Atoi(v1Arr[i])
		}
		if i < len2 {
			n2, _ = strconv.Atoi(v2Arr[i])
		}

		if n1 > n2 {
			return 1
		} else if n1 < n2 {
			return -1
		}
	}

	return 0
}

func (u *Updater) downloadLatestVersion() (err error) {
	fmt.Println("[3/9] download latest version")
	client := u.newHTTPClient()
	resp, err := client.Get(u.newVersionInfo.ZipBallUrl)
	if err != nil {
		err = errors.Trace(err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		err = fmt.Errorf("error status code: %d", resp.StatusCode)
		return
	}

	out, err := os.Create(u.downloadFile)
	if err != nil {
		return errors.Trace(err)
	}
	defer out.Close()

	if _, err = io.Copy(out, resp.Body); err != nil {
		return errors.Trace(err)
	}
	return
}

func (u *Updater) unzip() (err error) {
	fmt.Println("[4/9] unzip file")
	extract := func(file *zip.File) error {
		zippedFile, err := file.Open()
		if err != nil {
			return errors.Trace(err)
		}
		defer zippedFile.Close()

		extractedFilePath := filepath.Join(u.workDir, file.Name)
		if file.FileInfo().IsDir() {
			//fmt.Println("Creating directory:", extractedFilePath)
			if err = os.MkdirAll(extractedFilePath, file.Mode()); err != nil {
				return errors.Trace(err)
			}
			return nil
		}
		//fmt.Println("Extracting file:", file.Name)
		outputFile, err := os.OpenFile(extractedFilePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
		if err != nil {
			return errors.Trace(err)
		}
		defer outputFile.Close()

		if _, err = io.Copy(outputFile, zippedFile); err != nil {
			return errors.Trace(err)
		}
		return nil
	}

	zipReader, err := zip.OpenReader(u.downloadFile)
	if err != nil {
		return errors.Trace(err)
	}
	defer zipReader.Close()

	for _, file := range zipReader.Reader.File {
		if err = extract(file); err != nil {
			return errors.Trace(err)
		}
	}
	u.unzipDir = filepath.Join(u.workDir, zipReader.Reader.File[0].Name)
	return
}

func (u *Updater) adjustFiles() (err error) {
	fmt.Println("[5/9] adjust files")

	var oldFds []fs.FileInfo
	var newFds []fs.FileInfo
	oldDir := filepath.Join(u.root, u.customPluginDir)
	newDir := filepath.Join(u.unzipDir, u.customPluginDir)
	if oldFds, err = ioutil.ReadDir(oldDir); err != nil {
		return errors.Trace(err)
	}
	if newFds, err = ioutil.ReadDir(newDir); err != nil {
		return errors.Trace(err)
	}

	excludeFds := make(map[string]struct{})
	for _, ele := range newFds {
		excludeFds[ele.Name()] = struct{}{}
	}
	for _, fd := range oldFds {
		name := fd.Name()
		if _, ok := excludeFds[name]; ok {
			continue
		}
		if strings.HasSuffix(name, ".js") {
			if _, ok := excludeFds[name[:len(name)-3]]; ok {
				continue
			}
		}
		path := filepath.Join(u.customPluginDir, name)
		u.dontNeedUpdate = append(u.dontNeedUpdate, path)
	}

	var info os.FileInfo
	for _, file := range u.dontNeedUpdate {
		oldPath := filepath.Join(u.root, file)
		newPath := filepath.Join(u.unzipDir, file)
		if info, err = os.Stat(oldPath); info == nil || err != nil && os.IsNotExist(err) {
			err = nil
			continue
		}
		if info.IsDir() {
			err = copyDir(oldPath, newPath)
		} else {
			err = copyFile(oldPath, newPath)
		}
		if err != nil {
			return errors.Trace(err)
		}
	}
	return
}

func (u *Updater) adjustUpdaterExe() (err error) {
	fmt.Println("[6/9] adjust updater.exe")
	// ./plugin/updater/updater.exe -> ./plugin/updater/updater1.2.13.exe
	// 为什么要遍历而不是直接修改：我怕以后可能会修改位置
	pluginDir := filepath.Join(u.unzipDir, u.pluginDir)
	err = filepath.Walk(pluginDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return errors.Trace(err)
		}
		if !info.IsDir() && info.Name() == "updater.exe" {
			newFilePath := filepath.Join(filepath.Dir(path), fmt.Sprintf("updater%s.exe", u.newVersionInfo.TagName))
			return os.Rename(path, newFilePath)
		}
		return nil
	})
	if err != nil {
		return errors.Trace(err)
	}
	return nil
}

func (u *Updater) removeOldDir() error {
	fmt.Println("[7/9] remove old dir")
	src := filepath.Join(u.root, u.pluginDir)
	fds, err := ioutil.ReadDir(src)
	if err != nil {
		return errors.Trace(err)
	}
	for _, fd := range fds {
		name := fd.Name()
		if name != "updater" {
			path := filepath.Join(src, name)
			if err = os.RemoveAll(path); err != nil {
				return errors.Trace(err)
			}
		}
	}
	return nil
}

func (u *Updater) syncDir() (err error) {
	fmt.Println("[8/9] sync dir")
	src := filepath.Join(u.unzipDir, u.pluginDir)
	dst := filepath.Join(u.root, u.pluginDir)
	if err = copyDir(src, dst); err != nil {
		return errors.Trace(err)
	}
	return nil
}

func (u *Updater) deleteUselessAndSave() (err error) {
	fmt.Println("[9/9] delete useless file")
	if err = os.Remove(u.downloadFile); err != nil {
		return errors.Trace(err)
	}
	if err = os.RemoveAll(u.workDir); err != nil {
		return errors.Trace(err)
	}
	content, err := json.Marshal(u.newVersionInfo)
	if err != nil {
		return errors.Trace(err)
	}
	if err = ioutil.WriteFile(u.versionFile, content, 0777); err != nil {
		return errors.Trace(err)
	}
	return
}

func copyFile(src, dst string) (err error) {
	var srcFd *os.File
	var dstFd *os.File
	var srcInfo os.FileInfo

	if srcFd, err = os.Open(src); err != nil {
		return errors.Trace(err)
	}
	defer srcFd.Close()

	if dstFd, err = os.Create(dst); err != nil {
		return errors.Trace(err)
	}
	defer dstFd.Close()

	if _, err = io.Copy(dstFd, srcFd); err != nil {
		return errors.Trace(err)
	}
	if srcInfo, err = os.Stat(src); err != nil {
		return errors.Trace(err)
	}
	if err = os.Chmod(dst, srcInfo.Mode()); err != nil {
		return errors.Trace(err)
	}
	return nil
}

func copyDir(src string, dst string) (err error) {
	var fds []os.FileInfo
	var srcInfo os.FileInfo

	if srcInfo, err = os.Stat(src); err != nil {
		return errors.Trace(err)
	}
	if err = os.MkdirAll(dst, srcInfo.Mode()); err != nil {
		return errors.Trace(err)
	}
	if fds, err = ioutil.ReadDir(src); err != nil {
		return errors.Trace(err)
	}
	for _, fd := range fds {
		srcFilePath := filepath.Join(src, fd.Name())
		dstFilePath := filepath.Join(dst, fd.Name())
		if fd.IsDir() {
			err = copyDir(srcFilePath, dstFilePath)
		} else {
			err = copyFile(srcFilePath, dstFilePath)
		}
		if err != nil {
			return errors.Trace(err)
		}
	}
	return nil
}

func checkExist(root, sub string) error {
	if sub != "" {
		root = filepath.Join(root, sub)
	}
	exist, err := pathExists(root)
	if !exist {
		err = fmt.Errorf("%s is not exist", root)
	}
	return errors.Trace(err)
}

func pathExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, err
	}
	return false, err
}

func wait() {
	fmt.Printf("Press Enter to exit ...")
	endKey := make([]byte, 1)
	os.Stdin.Read(endKey)
}

func install() (err error) {
	installer, err := newInstaller()
	if err != nil {
		return errors.Trace(err)
	}
	if err = installer.prepare(); err != nil {
		return errors.Trace(err)
	}
	if err = installer.backupFile(); err != nil {
		return errors.Trace(err)
	}
	if err = installer.run(); err != nil {
		return errors.Trace(err)
	}
	fmt.Println("Done")
	wait()
	return nil
}

func update(proxy string, timeout int) (err error) {
	var updater *Updater
	if updater, err = NewUpdater(proxy, timeout); err != nil {
		return errors.Trace(err)
	}
	need, err := updater.needUpdate()
	if err != nil {
		return errors.Trace(err)
	}
	if !need {
		fmt.Println("\nIt is already the latest version. Do not need update.")
		fmt.Println("Current Plugin Version:", updater.newVersionInfo.TagName)
		return
	}
	if err = updater.downloadLatestVersion(); err != nil {
		return errors.Trace(err)
	}
	if err = updater.unzip(); err != nil {
		return errors.Trace(err)
	}
	if err = updater.adjustFiles(); err != nil {
		return errors.Trace(err)
	}
	if err = updater.adjustUpdaterExe(); err != nil {
		return errors.Trace(err)
	}
	if err = updater.removeOldDir(); err != nil {
		return errors.Trace(err)
	}
	if err = updater.syncDir(); err != nil {
		return errors.Trace(err)
	}
	if err = updater.deleteUselessAndSave(); err != nil {
		return errors.Trace(err)
	}
	fmt.Println("\nUpgrade SUCCESS!")
	fmt.Println("Current Plugin Version:", updater.newVersionInfo.TagName)
	fmt.Println("Please restart Typora")
	return nil
}

func main() {
	var action string
	var proxy string
	var timeout int
	var err error
	flag.StringVar(&action, "action", "install", "install or update")
	flag.StringVar(&proxy, "proxy", "", "proxy url. eg: http://127.0.0.1:7890")
	flag.IntVar(&timeout, "timeout", 600, "client timeout")
	flag.Parse()

	if action == "update" {
		err = update(proxy, timeout)
	} else if action == "install" {
		err = install()
	}
	if err != nil {
		fmt.Println()
		panic(errors.ErrorStack(errors.Trace(err)))
	}
}
