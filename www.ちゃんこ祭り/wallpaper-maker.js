const canvas = document.querySelector("#editor-canvas");
const canvasStage = document.querySelector("#canvas-stage");
const context = canvas.getContext("2d", { alpha: false });
const imageInput = document.querySelector("#image-input");
const dropZone = document.querySelector("#drop-zone");
const emptyState = document.querySelector("#empty-state");
const sourceInfo = document.querySelector("#source-info");
const widthInput = document.querySelector("#output-width");
const heightInput = document.querySelector("#output-height");
const zoomInput = document.querySelector("#zoom");
const brightnessInput = document.querySelector("#brightness");
const contrastInput = document.querySelector("#contrast");
const saturationInput = document.querySelector("#saturation");
const qualityInput = document.querySelector("#quality");
const formatInput = document.querySelector("#file-format");
const designInput = document.querySelector("#design-name");
const deviceInput = document.querySelector("#device-name");
const downloadButton = document.querySelector("#download-button");
const toolMessage = document.querySelector("#tool-message");

const DESIGN_FILEBASES = {
  akane: "akane-sendagi",
  soryu: "soryu-garden",
  shuei: "shuei-grove"
};

const state = {
  image: null,
  filename: "",
  rotation: 0,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  dragging: false,
  pointerX: 0,
  pointerY: 0,
  renderQueued: false
};

paintEmptyCanvas();
updateFilename();
window.requestAnimationFrame(updateCanvasPreviewSize);
window.addEventListener("resize", updateCanvasPreviewSize);

imageInput.addEventListener("change", () => loadFile(imageInput.files[0]));

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
});

dropZone.addEventListener("drop", (event) => loadFile(event.dataTransfer.files[0]));

window.addEventListener("paste", (event) => {
  const item = [...event.clipboardData.items].find((entry) => entry.type.startsWith("image/"));
  if (item) loadFile(item.getAsFile());
});

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    setActivePreset(button.dataset.preset);
    setCanvasSize(Number(button.dataset.width), Number(button.dataset.height));
    deviceInput.value = button.dataset.preset;
    updateFilename();
  });
});

[widthInput, heightInput].forEach((input) => {
  input.addEventListener("change", () => {
    const width = clamp(Number(widthInput.value), 320, 7680);
    const height = clamp(Number(heightInput.value), 320, 7680);
    setActivePreset("");
    setCanvasSize(width, height);
    updateOrientationButtons();
  });
});

document.querySelector("#swap-size").addEventListener("click", () => {
  setActivePreset("");
  setCanvasSize(canvas.height, canvas.width);
  updateOrientationButtons();
});

document.querySelector("#portrait-button").addEventListener("click", () => setOrientation("portrait"));
document.querySelector("#landscape-button").addEventListener("click", () => setOrientation("landscape"));

bindRange(zoomInput, "zoom", (value) => `${value}%`, (value) => value / 100);
bindRange(brightnessInput, "brightness", (value) => `${value}%`);
bindRange(contrastInput, "contrast", (value) => `${value}%`);
bindRange(saturationInput, "saturation", (value) => `${value}%`);

qualityInput.addEventListener("input", () => {
  document.querySelector("#quality-value").textContent = `${qualityInput.value}%`;
});

formatInput.addEventListener("change", () => {
  document.querySelector("#quality-control").hidden = formatInput.value === "image/png";
  updateFilename();
});

designInput.addEventListener("change", updateFilename);
deviceInput.addEventListener("change", () => {
  applyDevicePreset(deviceInput.value);
  updateFilename();
});

document.querySelector("#rotate-left").addEventListener("click", () => rotate(-90));
document.querySelector("#rotate-right").addEventListener("click", () => rotate(90));
document.querySelector("#reset-edit").addEventListener("click", resetEdits);
document.querySelector("#center-image").addEventListener("click", () => {
  state.offsetX = 0;
  state.offsetY = 0;
  queueRender();
});

canvas.addEventListener("pointerdown", (event) => {
  if (!state.image) return;
  state.dragging = true;
  state.pointerX = event.clientX;
  state.pointerY = event.clientY;
  canvas.classList.add("is-dragging");
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.dragging) return;
  const rect = canvas.getBoundingClientRect();
  state.offsetX += (event.clientX - state.pointerX) * (canvas.width / rect.width);
  state.offsetY += (event.clientY - state.pointerY) * (canvas.height / rect.height);
  state.pointerX = event.clientX;
  state.pointerY = event.clientY;
  queueRender();
});

["pointerup", "pointercancel"].forEach((eventName) => {
  canvas.addEventListener(eventName, () => {
    state.dragging = false;
    canvas.classList.remove("is-dragging");
  });
});

canvas.addEventListener("wheel", (event) => {
  if (!state.image) return;
  event.preventDefault();
  const next = clamp(Number(zoomInput.value) + (event.deltaY < 0 ? 5 : -5), 10, 400);
  zoomInput.value = next;
  state.zoom = next / 100;
  document.querySelector("#zoom-value").textContent = `${next}%`;
  queueRender();
}, { passive: false });

downloadButton.addEventListener("click", exportImage);

async function loadFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showMessage("画像ファイルを選択してください。");
    return;
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    if (state.image?.objectUrl) URL.revokeObjectURL(state.image.objectUrl);
    image.objectUrl = url;
    state.image = image;
    state.filename = file.name;
    emptyState.hidden = true;
    downloadButton.disabled = false;
    sourceInfo.textContent = `${file.name}｜${image.naturalWidth} × ${image.naturalHeight} px｜${formatBytes(file.size)}`;
    resetEdits();
    showMessage("画像を読み込みました。プレビューをドラッグして位置を調整できます。");
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    showMessage("画像を読み込めませんでした。別のファイルをお試しください。");
  };
  image.src = url;
}

function setCanvasSize(width, height) {
  canvas.width = width;
  canvas.height = height;
  widthInput.value = width;
  heightInput.value = height;
  document.querySelector("#output-info").textContent = `${width} × ${height} px`;
  state.offsetX = 0;
  state.offsetY = 0;
  updateOrientationButtons();
  updateCanvasPreviewSize();
  queueRender();
}

function updateCanvasPreviewSize() {
  const availableWidth = Math.max(120, canvasStage.clientWidth - 32);
  const availableHeight = Math.max(180, canvasStage.clientHeight - 32);
  const aspectRatio = canvas.width / canvas.height;

  let previewWidth = availableWidth;
  let previewHeight = previewWidth / aspectRatio;

  if (previewHeight > availableHeight) {
    previewHeight = availableHeight;
    previewWidth = previewHeight * aspectRatio;
  }

  canvas.style.width = `${Math.round(previewWidth)}px`;
  canvas.style.height = `${Math.round(previewHeight)}px`;
}

function render() {
  state.renderQueued = false;
  context.save();
  context.fillStyle = "#111111";
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (!state.image) {
    context.restore();
    return;
  }

  const quarterTurn = Math.abs(state.rotation / 90) % 2 === 1;
  const orientedWidth = quarterTurn ? state.image.naturalHeight : state.image.naturalWidth;
  const orientedHeight = quarterTurn ? state.image.naturalWidth : state.image.naturalHeight;
  const baseScale = Math.max(canvas.width / orientedWidth, canvas.height / orientedHeight);
  const scale = baseScale * state.zoom;

  context.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;
  context.translate(canvas.width / 2 + state.offsetX, canvas.height / 2 + state.offsetY);
  context.rotate(state.rotation * Math.PI / 180);
  context.scale(scale, scale);
  context.drawImage(state.image, -state.image.naturalWidth / 2, -state.image.naturalHeight / 2);
  context.restore();
}

function queueRender() {
  if (state.renderQueued) return;
  state.renderQueued = true;
  window.requestAnimationFrame(render);
}

function paintEmptyCanvas() {
  context.fillStyle = "#18151c";
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function rotate(amount) {
  state.rotation = (state.rotation + amount + 360) % 360;
  state.offsetX = 0;
  state.offsetY = 0;
  queueRender();
}

function resetEdits() {
  state.rotation = 0;
  state.zoom = 1;
  state.offsetX = 0;
  state.offsetY = 0;
  state.brightness = 100;
  state.contrast = 100;
  state.saturation = 100;
  zoomInput.value = 100;
  brightnessInput.value = 100;
  contrastInput.value = 100;
  saturationInput.value = 100;
  ["zoom", "brightness", "contrast", "saturation"].forEach((name) => {
    document.querySelector(`#${name}-value`).textContent = "100%";
  });
  queueRender();
}

function bindRange(input, property, formatter, transform = (value) => value) {
  input.addEventListener("input", () => {
    const value = Number(input.value);
    state[property] = transform(value);
    document.querySelector(`#${input.id}-value`).textContent = formatter(value);
    queueRender();
  });
}

function setActivePreset(name) {
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.preset === name);
  });
}

function applyDevicePreset(device) {
  const button = document.querySelector(`[data-preset="${device}"]`);
  if (!button) return;
  setActivePreset(device);
  setCanvasSize(Number(button.dataset.width), Number(button.dataset.height));
}

function setOrientation(orientation) {
  const isPortrait = canvas.height >= canvas.width;
  const shouldSwap = (orientation === "portrait" && !isPortrait) || (orientation === "landscape" && isPortrait);
  setActivePreset("");
  if (shouldSwap) {
    setCanvasSize(canvas.height, canvas.width);
  } else {
    updateOrientationButtons();
    queueRender();
  }
}

function updateOrientationButtons() {
  const portrait = canvas.height >= canvas.width;
  document.querySelector("#portrait-button").classList.toggle("is-active", portrait);
  document.querySelector("#landscape-button").classList.toggle("is-active", !portrait);
}

function updateFilename() {
  const extension = formatInput.value === "image/png" ? "png" : formatInput.value === "image/webp" ? "webp" : "jpg";
  document.querySelector("#filename-preview").textContent = `${DESIGN_FILEBASES[designInput.value]}-${deviceInput.value}.${extension}`;
}

function exportImage() {
  if (!state.image) return;
  render();
  const quality = Number(qualityInput.value) / 100;
  const extension = formatInput.value === "image/png" ? "png" : formatInput.value === "image/webp" ? "webp" : "jpg";
  const filename = `${DESIGN_FILEBASES[designInput.value]}-${deviceInput.value}.${extension}`;

  canvas.toBlob((blob) => {
    if (!blob) {
      showMessage("書き出しに失敗しました。画像サイズを小さくして再度お試しください。");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showMessage(`${filename} を書き出しました（${formatBytes(blob.size)}）。`);
  }, formatInput.value, quality);
}

function showMessage(text) {
  toolMessage.textContent = text;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
