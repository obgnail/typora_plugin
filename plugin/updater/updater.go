package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Inserter struct {
	root          string
	match         string
	insertFile    string
	insertContent string
}

func NewInserter() (*Inserter, error) {
	curDir, err := os.Getwd()
	if err != nil {
		return nil, err
	}
	return &Inserter{
		root:          filepath.Dir(filepath.Dir(curDir)),
		insertFile:    "window.html",
		insertContent: `<script src="./plugin/index.js" defer="defer"></script>`,
	}, nil
}

func (i *Inserter) prepare() (err error) {
	betaDir := "app"
	normalDir := "appsrc"
	betaMatch := `<script src="./app/window/frame.js" defer="defer"></script>`
	normalMatch := `<script src="./appsrc/window/frame.js" defer="defer"></script>`

	if err = checkExist(i.root, i.insertFile); err != nil {
		return err
	}

	err = checkExist(i.root, betaDir)
	if err == nil {
		i.match = betaMatch
		return nil
	}
	err = checkExist(i.root, normalDir)
	if err == nil {
		i.match = normalMatch
		return nil
	}
	return err
}

func (i *Inserter) run() (err error) {
	filePath := filepath.Join(i.root, i.insertFile)
	file, err := ioutil.ReadFile(filePath)
	if err != nil {
		return err
	}
	if bytes.Contains(file, []byte(i.insertContent)) {
		fmt.Println("had in inserted")
		return
	}

	result := bytes.Replace(file, []byte(i.match), []byte(i.match+i.insertContent), 1)
	err = ioutil.WriteFile(filePath, result, 0644)
	if err != nil {
		return err
	}
	fmt.Println("Done")
	return nil
}

type Updater struct {
	curDir       string
	root         string
	versionFile  string
	downloadFile string
	url          string
	timeout      int
}

func NewUpdater() (*Updater, error) {
	curDir, err := os.Getwd()
	if err != nil {
		return nil, err
	}
	return &Updater{
		curDir:      curDir,
		root:        filepath.Dir(filepath.Dir(curDir)),
		versionFile: "version",
		url:         "https://api.github.com/repos/obgnail/typora_plugin/releases/latest",
		timeout:     30,
	}, nil
}

type Body struct {
	TagName    string `json:"tag_name"`
	Name       string `json:"name"`
	Body       string `json:"body"`
	ZipBallUrl string `json:"zipball_url"`
}

func (u *Updater) downloadLatestVersion(body *Body) (err error) {
	client := &http.Client{Timeout: time.Duration(u.timeout) * time.Second}
	resp, err := client.Get(body.ZipBallUrl)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		err = fmt.Errorf("error status code: %d", resp.StatusCode)
		return
	}

	filePath := fmt.Sprintf("%s.zip", body.TagName)
	out, err := os.Create(filePath)
	if err != nil {
		panic(err)
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	u.downloadFile = filePath
	return
}

func (u *Updater) unzip() (err error) {
	extract := func(file *zip.File) error {
		zippedFile, err := file.Open()
		if err != nil {
			return err
		}
		defer zippedFile.Close()

		targetDir := "./"
		extractedFilePath := filepath.Join(
			targetDir,
			file.Name,
		)

		if file.FileInfo().IsDir() {
			fmt.Println("Creating directory:", extractedFilePath)
			os.MkdirAll(extractedFilePath, file.Mode())
		} else {
			fmt.Println("Extracting file:", file.Name)

			outputFile, err := os.OpenFile(
				extractedFilePath,
				os.O_WRONLY|os.O_CREATE|os.O_TRUNC,
				file.Mode(),
			)
			if err != nil {
				return err
			}
			defer outputFile.Close()

			_, err = io.Copy(outputFile, zippedFile)
			if err != nil {
				return err
			}
		}
		return nil
	}

	zipReader, err := zip.OpenReader(u.downloadFile)
	if err != nil {
		return err
	}
	defer zipReader.Close()

	for _, file := range zipReader.Reader.File {
		if err = extract(file); err != nil {
			return
		}
	}
	return
}

func (u *Updater) getLatestVersion() (body *Body, err error) {
	client := &http.Client{Timeout: time.Duration(u.timeout) * time.Second}
	resp, err := client.Get(u.url)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		err = fmt.Errorf("error status code: %d", resp.StatusCode)
		return
	}

	bodyContent, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return
	}

	body = &Body{}
	if err = json.Unmarshal(bodyContent, body); err != nil {
		return
	}
	return
}

func (u *Updater) getCurrentVersion() (version string, err error) {
	if err = checkExist(u.curDir, u.versionFile); err != nil {
		return
	}
	filePath := filepath.Join(u.curDir, u.versionFile)
	file, err := ioutil.ReadFile(filePath)
	if err != nil {
		return
	}
	return string(file), nil
}

// 1.2.13
func (u *Updater) compareVersion(v1, v2 string) (result int) {
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

func checkExist(root, sub string) error {
	path := filepath.Join(root, sub)
	exist, err := pathExists(path)
	if !exist {
		err = fmt.Errorf("%s is not exist", path)
	}
	return err
}

func pathExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func insert() (err error) {
	inserter, err := NewInserter()
	if err != nil {
		return err
	}
	if err = inserter.prepare(); err != nil {
		return err
	}
	if err = inserter.run(); err != nil {
		return err
	}
	return nil
}

func update() (err error) {
	updater, err := NewUpdater()
	if err != nil {
		return err
	}
	currentVersion, err := updater.getCurrentVersion()
	if err != nil {
		return err
	}
	body, err := updater.getLatestVersion()
	if err != nil {
		return err
	}
	result := updater.compareVersion(body.TagName, currentVersion)
	switch result {
	case 0:
		fmt.Println("latest version")
		return
	case -1:
		return fmt.Errorf("error. please download latest file from github")
	case 1:
		if err = updater.downloadLatestVersion(body); err != nil {
			return
		}
	}
	if err = updater.unzip(); err != nil {
		return
	}
	// todo
	return
}

func main() {
	if err := insert(); err != nil {
		panic(err)
	}

	//if err := update(); err != nil {
	//	panic(err)
	//}
}
