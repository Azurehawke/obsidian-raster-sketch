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
      const resizeCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = initialHeight * dpr;
        ctx2d.scale(dpr, dpr);
        ctx2d.lineCap = "round";
        ctx2d.lineJoin = "round";
      };
      setTimeout(resizeCanvas, 50);
      let drawing = false;
      const getPos = (e) => {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      canvas.addEventListener("pointerdown", (e) => {
        drawing = true;
        ctx2d.beginPath();
        ctx2d.strokeStyle = colorInput.value;
        ctx2d.lineWidth = parseInt(widthInput.value);
        const pos = getPos(e);
        ctx2d.moveTo(pos.x, pos.y);
      });
      canvas.addEventListener("pointermove", (e) => {
        var _a;
        if (!drawing) return;
        const pos = getPos(e);
        ctx2d.lineTo(pos.x, pos.y);
        ctx2d.stroke();
        if (pos.y > canvas.height / dpr - 20) {
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
      canvas.addEventListener("pointerup", () => drawing = false);
      canvas.addEventListener("pointerleave", () => drawing = false);
      clearBtn.onclick = () => ctx2d.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      saveBtn.onclick = async () => {
        var _a, _b;
        const data = canvas.toDataURL("image/png").split(",")[1];
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;
        const folderPath = ((_a = activeFile.parent) == null ? void 0 : _a.path) || "";
        const sketchFolder = folderPath ? `${folderPath}/sketches` : "sketches";
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
      };
    });
  }
};
