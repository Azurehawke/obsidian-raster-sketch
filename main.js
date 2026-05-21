"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => RasterSketchPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var RasterSketchPlugin = class extends import_obsidian.Plugin {
  async onload() {
    this.addCommand({
      id: "insert-raster-sketch-block",
      name: "Insert Raster Sketch Block",
      editorCallback: (editor) => {
        editor.replaceSelection("\n```raster-sketch\n\n```\n");
      }
    });
    this.registerMarkdownCodeBlockProcessor("raster-sketch", (source, el, ctx) => {
      const container = el.createDiv({ cls: "raster-container" });
      container.style.position = "relative";
      const toolbar = container.createDiv({ cls: "raster-toolbar" });
      const colorInput = toolbar.createEl("input", { type: "color" });
      colorInput.value = "var(--text-normal)";
      const widthInput = toolbar.createEl("input", { type: "range", attr: { min: "1", max: "20", value: "3" } });
      const patternSelect = toolbar.createEl("select");
      const optLines = patternSelect.createEl("option", { text: "Lines", value: "lines" });
      const optDots = patternSelect.createEl("option", { text: "Dot Grid", value: "dots" });
      const optGraph = patternSelect.createEl("option", { text: "Graph Paper", value: "graph" });
      const clearBtn = toolbar.createEl("button", { text: "Clear" });
      const saveBtn = toolbar.createEl("button", { text: "Save Sketch" });
      const deleteBlockBtn = container.createEl("button", { text: "\u2715", cls: "raster-delete-block-btn" });
      Object.assign(deleteBlockBtn.style, {
        position: "absolute",
        top: "5px",
        right: "5px",
        backgroundColor: "var(--text-error)",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        zIndex: "10",
        padding: "2px 8px",
        fontWeight: "bold"
      });
      const canvas = container.createEl("canvas", { cls: "raster-canvas" });
      const ctx2d = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const initialHeight = 300;
      let maxDrawnY = 0;
      let isSaving = false;
      const lineSpacing = 28;
      const graphSpacing = 16;
      const applyCanvasStylePattern = () => {
        canvas.style.background = "none";
        canvas.style.backgroundColor = "transparent";
        const pattern = patternSelect.value;
        if (pattern === "lines") {
          canvas.style.backgroundImage = `linear-gradient(var(--background-modifier-border) 1px, transparent 1px)`;
          canvas.style.backgroundSize = `100% ${lineSpacing}px`;
        } else if (pattern === "dots") {
          canvas.style.backgroundImage = `radial-gradient(var(--background-modifier-border) 1.5px, transparent 1.5px)`;
          canvas.style.backgroundSize = `${lineSpacing}px ${lineSpacing}px`;
        } else if (pattern === "graph") {
          canvas.style.backgroundImage = `linear-gradient(var(--background-modifier-border) 1px, transparent 1px), linear-gradient(90deg, var(--background-modifier-border) 1px, transparent 1px)`;
          canvas.style.backgroundSize = `${graphSpacing}px ${graphSpacing}px`;
        }
      };
      const resizeCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = initialHeight * dpr;
        ctx2d.scale(dpr, dpr);
        ctx2d.lineCap = "round";
        ctx2d.lineJoin = "round";
        applyCanvasStylePattern();
      };
      setTimeout(resizeCanvas, 50);
      patternSelect.addEventListener("change", applyCanvasStylePattern);
      let drawing = false;
      const getPos = (e) => {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      canvas.addEventListener("pointerdown", (e) => {
        if (isSaving) return;
        drawing = true;
        ctx2d.beginPath();
        const pos = getPos(e);
        ctx2d.moveTo(pos.x, pos.y);
        if (e.buttons === 32 || e.buttons === 2) {
          ctx2d.globalCompositeOperation = "destination-out";
          ctx2d.lineWidth = 20;
        } else {
          ctx2d.globalCompositeOperation = "source-over";
          ctx2d.strokeStyle = colorInput.value;
          ctx2d.lineWidth = parseInt(widthInput.value);
          if (pos.y > maxDrawnY) maxDrawnY = pos.y;
        }
      });
      canvas.addEventListener("pointermove", (e) => {
        var _a;
        if (!drawing || isSaving) return;
        const pos = getPos(e);
        if (e.buttons === 32 || e.buttons === 2) {
          ctx2d.globalCompositeOperation = "destination-out";
          ctx2d.lineWidth = 20;
        } else {
          ctx2d.globalCompositeOperation = "source-over";
          ctx2d.strokeStyle = colorInput.value;
          ctx2d.lineWidth = parseInt(widthInput.value);
          if (pos.y > maxDrawnY) maxDrawnY = pos.y;
        }
        ctx2d.lineTo(pos.x, pos.y);
        ctx2d.stroke();
        if (pos.y > canvas.height / dpr - 20 && ctx2d.globalCompositeOperation === "source-over") {
          const oldWidth = canvas.width;
          const oldHeight = canvas.height;
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = oldWidth;
          tempCanvas.height = oldHeight;
          (_a = tempCanvas.getContext("2d")) == null ? void 0 : _a.drawImage(canvas, 0, 0);
          canvas.height = oldHeight + 100 * dpr;
          ctx2d.scale(dpr, dpr);
          ctx2d.lineCap = "round";
          ctx2d.lineJoin = "round";
          ctx2d.drawImage(tempCanvas, 0, 0, oldWidth / dpr, oldHeight / dpr);
        }
      });
      const stopDrawing = () => {
        drawing = false;
      };
      canvas.addEventListener("pointerup", stopDrawing);
      canvas.addEventListener("pointerleave", stopDrawing);
      clearBtn.onclick = () => {
        ctx2d.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        maxDrawnY = 0;
      };
      deleteBlockBtn.onclick = async (e) => {
        e.preventDefault();
        const sectionInfo = ctx.getSectionInfo(el);
        if (!sectionInfo) return;
        const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
        if (view) {
          const editor = view.editor;
          editor.replaceRange(
            "",
            { line: sectionInfo.lineStart, ch: 0 },
            { line: sectionInfo.lineEnd + 1, ch: 0 }
          );
        }
      };
      saveBtn.onclick = async (e) => {
        var _a, _b;
        e.preventDefault();
        if (isSaving) return;
        isSaving = true;
        drawing = false;
        const currentWidth = canvas.width / dpr;
        const pattern = patternSelect.value;
        const trackingSpacing = pattern === "graph" ? graphSpacing : lineSpacing;
        const boundingGridLines = Math.max(1, Math.ceil(maxDrawnY / trackingSpacing));
        const croppedHeight = boundingGridLines * trackingSpacing;
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = currentWidth * dpr;
        exportCanvas.height = croppedHeight * dpr;
        const exportCtx = exportCanvas.getContext("2d");
        exportCtx.scale(dpr, dpr);
        exportCtx.strokeStyle = "#e0f7fa";
        exportCtx.lineWidth = 1;
        if (pattern === "lines") {
          for (let y = lineSpacing; y <= croppedHeight; y += lineSpacing) {
            exportCtx.beginPath();
            exportCtx.moveTo(0, y);
            exportCtx.lineTo(currentWidth, y);
            exportCtx.stroke();
          }
        } else if (pattern === "dots") {
          exportCtx.fillStyle = "#b2ebf2";
          for (let x = lineSpacing; x < currentWidth; x += lineSpacing) {
            for (let y = lineSpacing; y < croppedHeight; y += lineSpacing) {
              exportCtx.beginPath();
              exportCtx.arc(x, y, 1.5, 0, Math.PI * 2);
              exportCtx.fill();
            }
          }
        } else if (pattern === "graph") {
          for (let x = graphSpacing; x < currentWidth; x += graphSpacing) {
            exportCtx.beginPath();
            exportCtx.moveTo(x, 0);
            exportCtx.lineTo(x, croppedHeight);
            exportCtx.stroke();
          }
          for (let y = graphSpacing; y <= croppedHeight; y += graphSpacing) {
            exportCtx.beginPath();
            exportCtx.moveTo(0, y);
            exportCtx.lineTo(currentWidth, y);
            exportCtx.stroke();
          }
        }
        exportCtx.drawImage(canvas, 0, 0, currentWidth, canvas.height / dpr);
        const data = exportCanvas.toDataURL("image/png").split(",")[1];
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
          isSaving = false;
          return;
        }
        let parentPath = ((_a = activeFile.parent) == null ? void 0 : _a.path) || "";
        if (parentPath === "/" || parentPath.trim() === "") {
          parentPath = "";
        }
        const sketchFolder = parentPath ? `${parentPath}/sketches` : "sketches";
        if (!(this.app.vault.getAbstractFileByPath(sketchFolder) instanceof import_obsidian.TFolder)) {
          await this.app.vault.createFolder(sketchFolder);
        }
        const fileName = `${sketchFolder}/sketch-${Date.now()}.png`;
        await this.app.vault.createBinary(fileName, Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer);
        const editor = (_b = this.app.workspace.activeEditor) == null ? void 0 : _b.editor;
        if (editor) {
          editor.replaceRange(`
![[${fileName}]]
`, editor.getCursor());
        }
        setTimeout(() => {
          container.remove();
        }, 50);
      };
    });
  }
};
