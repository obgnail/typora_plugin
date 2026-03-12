class ImageSeePlugin extends BasePlugin {
    // 注册 CSS 样式
    style = () => `
        .image_see_overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(0, 0, 0, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            cursor: default;
        }
        
        .image_see_close {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 24px;
            height: 24px;
            background-color: rgba(255, 255, 255, 0.8);
            border-radius: 50%;
            border: 1px solid #050404ff;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            font-size: 24px;
            font-weight: bold;
            color: #000;
            z-index: 10000;
        }
        
        .image_see_close:hover {
            background-color: rgba(255, 255, 255, 1);
        }
        
        .image_see_content {
            position: relative;
            overflow: visible;
            transform-origin: center center;
        }
        
        .image_see_img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            cursor: grab;
        }
        
        .image_see_img:active {
            cursor: grabbing;
        }
    `

    // 初始化方法
    init = () => {
        // 初始化时可以做一些准备工作
    }

    // 处理插件逻辑，为所有图片注册双击事件
    process = () => {
        // 为所有已存在的 img 标签注册双击事件
        this.registerDoubleClickEvents();
        
        // 监听 DOM 变化，为新添加的图片也注册事件
        this.observeDOMChanges();
    }

    // 为所有图片注册双击事件
    registerDoubleClickEvents = () => {
        // 获取所有非插件新增的 img 标签
        const images = document.querySelectorAll('img:not(.image_see_img)');
        images.forEach(img => {
            // 移除可能存在的旧事件监听器
            img.removeEventListener('dblclick', this.handleImageDoubleClick);
            // 添加新的双击事件监听器
            img.addEventListener('dblclick', this.handleImageDoubleClick);
        });
    }

    // 监听 DOM 变化，为新添加的图片注册事件
    observeDOMChanges = () => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // 元素节点
                        // 检查是否是 img 标签
                        if (node.tagName === 'IMG' && !node.classList.contains('image_see_img')) {
                            node.addEventListener('dblclick', this.handleImageDoubleClick);
                        }
                        // 检查是否包含 img 标签
                        const images = node.querySelectorAll('img:not(.image_see_img)');
                        images.forEach(img => {
                            img.addEventListener('dblclick', this.handleImageDoubleClick);
                        });
                    }
                });
            });
        });
        
        // 观察整个文档的变化
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 处理图片双击事件
    handleImageDoubleClick = (e) => {
        // 确保点击的是图片元素
        if (e.target && e.target.tagName === 'IMG' && !e.target.classList.contains('image_see_img')) {
            this.showEnlargedImage(e.target);
        }
    }

    // 显示放大图片
    showEnlargedImage = (imgElement) => {
        // 创建覆盖层
        const overlay = document.createElement('div');
        overlay.className = 'image_see_overlay';
        
        // 创建关闭按钮
        const closeButton = document.createElement('div');
        closeButton.className = 'image_see_close';
        closeButton.textContent = '×';
        
        // 创建内容容器
        const contentContainer = document.createElement('div');
        contentContainer.className = 'image_see_content';
        
        // 创建图片
        const enlargedImg = document.createElement('img');
        enlargedImg.className = 'image_see_img';
        enlargedImg.src = imgElement.src;
        enlargedImg.alt = imgElement.alt;
        
        // 组装结构
        contentContainer.appendChild(enlargedImg);
        overlay.appendChild(closeButton);
        overlay.appendChild(contentContainer);
        
        // 初始化变量
        let scale = 1;
        let translateX = 0;
        let translateY = 0;
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startTranslateX = 0;
        let startTranslateY = 0;
        
        // 更新图片变换
        const updateTransform = () => {
            contentContainer.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
        };
        
        // 计算初始缩放比例，确保图片在可视范围内最大尺寸展示
        const calculateInitialScale = () => {
            const viewportWidth = window.innerWidth; //窗口可视宽度
            const viewportHeight = window.innerHeight; //窗口可视高度
            const imgWidth = enlargedImg.naturalWidth; //图片原始宽度
            const imgHeight = enlargedImg.naturalHeight; //图片原始高度
            
            // 如果图片小于等于视口，按原图大小展示
            if (imgWidth <= viewportWidth && imgHeight <= viewportHeight) {
                scale = 1;
            } else {
                // 如果图片超过视口，计算缩放比例
                const scaleX = viewportWidth / imgWidth;
                const scaleY = viewportHeight / imgHeight;
                scale = Math.min(scaleX, scaleY);
            }
            
            updateTransform();
        };
        
        // 关闭事件
        closeButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', handleEscKey);
        });
        
        // 按 ESC 键关闭
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleEscKey);
            }
        };
        
        document.addEventListener('keydown', handleEscKey);
        
        // 鼠标滚轮缩放
        contentContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            // 计算缩放比例
            const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.max(0.1, Math.min(5, scale * scaleFactor));
            
            // 以图片中心为原点进行缩放，不需要调整位移
            scale = newScale;
            updateTransform();
        });
        
        // 鼠标拖动
        enlargedImg.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startTranslateX = translateX;
            startTranslateY = translateY;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            translateX = startTranslateX + deltaX;
            translateY = startTranslateY + deltaY;
            
            updateTransform();
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
        
        // 添加到文档
        document.body.appendChild(overlay);
        
        // 等待图片加载完成后计算初始缩放比例
        if (enlargedImg.complete) {
            calculateInitialScale();
        } else {
            enlargedImg.addEventListener('load', calculateInitialScale);
        }
    }
}

module.exports = {
    plugin: ImageSeePlugin
}
