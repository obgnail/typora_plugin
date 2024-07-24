package main

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
)

type Installer struct {
	root          string
	insertFile    string
	insertContent string
	oldMatch      string
	newMatch      string
}

func newInstaller() (*Installer, error) {
	fmt.Println("[1/4] new installer")
	curDir, err := os.Getwd()
	if err != nil {
		return nil, err
	}
	return &Installer{
		root:          filepath.Dir(filepath.Dir(curDir)),
		insertFile:    "window.html",
		insertContent: `<script src="./plugin/index.js" defer="defer"></script>`,
		oldMatch:      `<script src="./app/window/frame.js" defer="defer"></script>`,
		newMatch:      `<script src="./appsrc/window/frame.js" defer="defer"></script>`,
	}, nil
}

func (i *Installer) prepare() (err error) {
	fmt.Println("[2/4] prepare")
	if err = checkExist(i.root, i.insertFile); err != nil {
		return err
	}
	return nil
}

func (i *Installer) backupFile() (err error) {
	fmt.Println("[3/4] backup window.html")
	filePath := filepath.Join(i.root, i.insertFile)
	backupFilePath := filePath + ".bak"
	if err = copyFile(filePath, backupFilePath); err != nil {
		return err
	}
	return nil
}

func (i *Installer) run() (err error) {
	fmt.Println("[4/4] update window.html")
	filePath := filepath.Join(i.root, i.insertFile)
	file, err := ioutil.ReadFile(filePath)
	if err != nil {
		return err
	}
	if bytes.Contains(file, []byte(i.insertContent)) {
		return
	}

	match := ""
	if bytes.Contains(file, []byte(i.oldMatch)) {
		match = i.oldMatch
	} else if bytes.Contains(file, []byte(i.newMatch)) {
		match = i.newMatch
	}
	if match == "" {
		return fmt.Errorf("has not match")
	}

	result := bytes.Replace(file, []byte(match), []byte(match+i.insertContent), 1)
	err = ioutil.WriteFile(filePath, result, 0644)
	if err != nil {
		return err
	}
	return nil
}

func copyFile(src, dst string) (err error) {
	var srcFd *os.File
	var dstFd *os.File
	var srcInfo os.FileInfo

	if srcFd, err = os.Open(src); err != nil {
		return err
	}
	defer srcFd.Close()

	if dstFd, err = os.Create(dst); err != nil {
		return err
	}
	defer dstFd.Close()

	if _, err = io.Copy(dstFd, srcFd); err != nil {
		return err
	}
	if srcInfo, err = os.Stat(src); err != nil {
		return err
	}
	if err = os.Chmod(dst, srcInfo.Mode()); err != nil {
		return err
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
	return err
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
		return err
	}
	if err = installer.prepare(); err != nil {
		return err
	}
	if err = installer.backupFile(); err != nil {
		return err
	}
	if err = installer.run(); err != nil {
		return err
	}
	fmt.Println("plugin install successfully")
	wait()
	return nil
}

func main() {
	if err := install(); err != nil {
		fmt.Println()
		panic(err)
	}
}
