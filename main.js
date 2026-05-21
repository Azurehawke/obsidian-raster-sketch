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
      const toolbar = container.createDiv({ cls: "raster-toolbar" });
      const colorInput = toolbar.createEl("input", { type: "color" });
      colorInput.value = "var(--text-normal)";
      const widthInput = toolbar.createEl("input", { type: "range", attr: { min: "1", max: "20", value: "3" } });
      const clearBtn = toolbar.createEl("button", { text: "Clear" });
      const saveBtn = toolbar.createEl("button", { text: "Save Sketch" });
      const canvas = container.createEl("canvas", { cls: "raster-canvas" });
      const ctx2d = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const initialHeight = 300;
      const lineSpacing = 28;
      let strokes = [];
      let currentStroke = null;
      let maxDrawnY = 0;
      let isSaving = false;
      const redrawCanvas = () => {
        ctx2d.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx2d.lineCap = "round";
        ctx2d.lineJoin = "round";
        for (const stroke of strokes) {
          if (stroke.points.length < 1) continue;
          ctx2d.beginPath();
          ctx2d.strokeStyle = stroke.color;
          ctx2d.lineWidth = stroke.width;
          ctx2d.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx2d.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          ctx2d.stroke();
        }
      };
      const resizeCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = initialHeight * dpr;
        ctx2d.scale(dpr, dpr);
        redrawCanvas();
      };
      setTimeout(resizeCanvas, 50);
      let drawing = false;
      let erasing = false;
      const getPos = (e) => {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      const pointToSegDist = (pt, p1, p2) => {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        if (dx === 0 && dy === 0) return Math.hypot(pt.x - p1.x, pt.y - p1.y);
        const t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / (dx * dx + dy * dy);
        const clampedT = Math.max(0, Math.min(1, t));
        return Math.hypot(pt.x - (p1.x + clampedT * dx), pt.y - (p1.y + clampedT * dy));
      };
      const evaluateEraserCollision = (pos) => {
        const eraseRadius = 15;
        let hitDetected = false;
        strokes = strokes.filter((stroke) => {
          for (let i = 0; i < stroke.points.length - 1; i++) {
            if (pointToSegDist(pos, stroke.points[i], stroke.points[i + 1]) < eraseRadius) {
              hitDetected = true;
              return false;
            }
          }
          return true;
        });
        if (hitDetected) {
          maxDrawnY = 0;
          for (const s of strokes) {
            for (const p of s.points) {
              if (p.y > maxDrawnY) maxDrawnY = p.y;
            }
          }
          redrawCanvas();
        }
      };
      canvas.addEventListener("pointerdown", (e) => {
        if (isSaving) return;
        const pos = getPos(e);
        if (e.buttons === 32 || e.button === 5) {
          erasing = true;
          evaluateEraserCollision(pos);
        } else {
          drawing = true;
          currentStroke = {
            id: Date.now(),
            color: colorInput.value,
            width: parseInt(widthInput.value),
            points: [pos]
          };
          strokes.push(currentStroke);
          ctx2d.beginPath();
          ctx2d.strokeStyle = currentStroke.color;
          ctx2d.lineWidth = currentStroke.width;
          ctx2d.moveTo(pos.x, pos.y);
          if (pos.y > maxDrawnY) maxDrawnY = pos.y;
        }
      });
      canvas.addEventListener("pointermove", (e) => {
        if (isSaving) return;
        const pos = getPos(e);
        if (erasing || e.buttons === 32) {
          evaluateEraserCollision(pos);
          return;
        }
        if (!drawing || !currentStroke) return;
        currentStroke.points.push(pos);
        ctx2d.lineTo(pos.x, pos.y);
        ctx2d.stroke();
        if (pos.y > maxDrawnY) maxDrawnY = pos.y;
        if (pos.y > canvas.height / dpr - 20) {
          const oldWidth = canvas.width;
          const oldHeight = canvas.height;
          canvas.height = oldHeight + 100 * dpr;
          ctx2d.scale(dpr, dpr);
          redrawCanvas();
        }
      });
      const terminateInput = () => {
        drawing = false;
        erasing = false;
        currentStroke = null;
      };
      canvas.addEventListener("pointerup", terminateInput);
      canvas.addEventListener("pointerleave", terminateInput);
      clearBtn.onclick = () => {
        strokes = [];
        maxDrawnY = 0;
        redrawCanvas();
      };
      saveBtn.onclick = async (e) => {
        var _a, _b;
        e.preventDefault();
        if (isSaving) return;
        isSaving = true;
        terminateInput();
        const currentWidth = canvas.width / dpr;
        const boundingGridLines = Math.max(1, Math.ceil(maxDrawnY / lineSpacing));
        const croppedHeight = boundingGridLines * lineSpacing;
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = currentWidth * dpr;
        exportCanvas.height = croppedHeight * dpr;
        const exportCtx = exportCanvas.getContext("2d");
        exportCtx.scale(dpr, dpr);
        exportCtx.strokeStyle = "#e0f7fa";
        exportCtx.lineWidth = 1;
        for (let y = lineSpacing; y <= croppedHeight; y += lineSpacing) {
          exportCtx.beginPath();
          exportCtx.moveTo(0, y);
          exportCtx.lineTo(currentWidth, y);
          exportCtx.stroke();
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
