/**
 * 上传页逻辑 — 选图、预览、确认保存并跳转
 */
(function () {
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  const previewSection = document.getElementById('previewSection');
  const previewGrid = document.getElementById('previewGrid');
  const previewCount = document.getElementById('previewCount');
  const confirmBtn = document.getElementById('confirmBtn');
  const continueLink = document.getElementById('continueLink');

  /** 当前选中的文件列表 */
  let selectedFiles = [];
  /** 预览用 Object URL，页面卸载时释放 */
  const previewUrls = new Map();

  // 若已有历史照片，显示「继续回忆」入口
  hasStoredPhotos().then((has) => {
    if (has) continueLink.hidden = false;
  });

  function revokeUrl(file) {
    const url = previewUrls.get(file);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrls.delete(file);
    }
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!incoming.length) return;

    incoming.forEach((file) => {
      if (!selectedFiles.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) {
        selectedFiles.push(file);
        previewUrls.set(file, URL.createObjectURL(file));
      }
    });
    renderPreview();
  }

  function removeFile(file) {
    revokeUrl(file);
    selectedFiles = selectedFiles.filter((f) => f !== file);
    renderPreview();
  }

  function renderPreview() {
    const count = selectedFiles.length;
    previewSection.hidden = count === 0;
    confirmBtn.disabled = count === 0;
    previewCount.textContent = count > 0 ? `已选 ${count} 张` : '';

    previewGrid.innerHTML = '';
    selectedFiles.forEach((file) => {
      const item = document.createElement('div');
      item.className = 'preview-item';

      const img = document.createElement('img');
      img.src = previewUrls.get(file);
      img.alt = file.name;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'preview-remove';
      removeBtn.setAttribute('aria-label', '移除照片');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        removeFile(file);
      });

      item.appendChild(img);
      item.appendChild(removeBtn);
      previewGrid.appendChild(item);
    });
  }

  // 文件选择
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) addFiles(fileInput.files);
    fileInput.value = '';
  });

  // 拖拽上传
  ['dragenter', 'dragover'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  // 确认保存并跳转
  confirmBtn.addEventListener('click', async () => {
    if (!selectedFiles.length) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = '正在珍藏…';

    try {
      await savePhotos(selectedFiles);
      window.location.href = 'gallery.html';
    } catch (err) {
      console.error(err);
      confirmBtn.disabled = false;
      confirmBtn.textContent = '准备好了';
      alert('保存失败，请重试或换用 Chrome / Edge 浏览器');
    }
  });

  // 页面卸载时释放预览 URL
  window.addEventListener('beforeunload', () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
  });
})();
