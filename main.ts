import { Plugin, TFolder, Editor, MarkdownView, setIcon } from 'obsidian';

export default class RasterSketchPlugin extends Plugin {
    async onload() {
        this.addCommand({
            id: 'insert-raster-sketch-block',
            name: 'Insert Raster Sketch Block',
            editorCallback: (editor: Editor) => {
                editor.replaceSelection("\n```raster-sketch\n\n```\n");
            }
        });

        this.registerMarkdownCodeBlockProcessor("raster-sketch", (source, el, ctx) => {
            const container = el.createDiv({ cls: "raster-container" });

            const toolbar = container.createDiv({ cls: "raster-toolbar" });

            // Color picker
            const colorInput = toolbar.createEl("input", { type: "color", attr: { title: "Brush color" } });
            colorInput.value = "#000000";

            toolbar.createDiv({ cls: "raster-toolbar-sep" });

            // Width slider + live numeric readout
            const widthInput = toolbar.createEl("input", {
                type: "range",
                attr: { min: "1", max: "20", value: "3", title: "Brush size" }
            });
            const widthLabel = toolbar.createEl("span", { cls: "raster-width-label", text: "3" });
            widthInput.addEventListener("input", () => { widthLabel.textContent = widthInput.value; });

            toolbar.createDiv({ cls: "raster-toolbar-sep" });

            // Paper style select
            const patternSelect = toolbar.createEl("select", { attr: { title: "Paper style" } });
            patternSelect.createEl("option", { text: "Lines", value: "lines" });
            patternSelect.createEl("option", { text: "Dots", value: "dots" });
            patternSelect.createEl("option", { text: "Graph", value: "graph" });

            toolbar.createDiv({ cls: "raster-toolbar-sep" });

            // Clear button
            const clearBtn = toolbar.createEl("button", { cls: "raster-toolbar-btn", attr: { title: "Clear canvas" } });
            setIcon(clearBtn, "eraser");

            // Save button
            const saveBtn = toolbar.createEl("button", { cls: "raster-toolbar-btn", attr: { title: "Save as image" } });
            setIcon(saveBtn, "image-down");

            // Delete block button — pushed right via spacer
            toolbar.createDiv({ cls: "raster-toolbar-spacer" });
            const deleteBlockBtn = toolbar.createEl("button", {
                cls: "raster-toolbar-btn raster-toolbar-btn--danger",
                attr: { title: "Remove sketch block" }
            });
            setIcon(deleteBlockBtn, "trash-2");

            const canvas = container.createEl("canvas", { cls: "raster-canvas" });
            const ctx2d = canvas.getContext("2d")!;

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
            const getPos = (e: PointerEvent) => {
                const r = canvas.getBoundingClientRect();
                return { x: (e.clientX - r.left), y: (e.clientY - r.top) };
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

                if (pos.y > (canvas.height / dpr) - 20 && ctx2d.globalCompositeOperation === "source-over") {
                    const oldWidth = canvas.width;
                    const oldHeight = canvas.height;
                    const tempCanvas = document.createElement("canvas");
                    tempCanvas.width = oldWidth;
                    tempCanvas.height = oldHeight;
                    tempCanvas.getContext("2d")?.drawImage(canvas, 0, 0);
                    canvas.height = oldHeight + (100 * dpr);
                    ctx2d.scale(dpr, dpr);
                    ctx2d.lineCap = "round";
                    ctx2d.lineJoin = "round";
                    ctx2d.drawImage(tempCanvas, 0, 0, oldWidth / dpr, oldHeight / dpr);
                }
            });

            const stopDrawing = () => { drawing = false; };
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
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view) {
                    view.editor.replaceRange("",
                        { line: sectionInfo.lineStart, ch: 0 },
                        { line: sectionInfo.lineEnd + 1, ch: 0 }
                    );
                }
            };

            saveBtn.onclick = async (e) => {
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
                const exportCtx = exportCanvas.getContext("2d")!;
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

                const data = exportCanvas.toDataURL("image/png").split(',')[1];
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) { isSaving = false; return; }

                let parentPath = activeFile.parent?.path || "";
                if (parentPath === "/" || parentPath.trim() === "") parentPath = "";

                const sketchFolder = parentPath ? `${parentPath}/sketches` : "sketches";
                if (!(this.app.vault.getAbstractFileByPath(sketchFolder) instanceof TFolder)) {
                    await this.app.vault.createFolder(sketchFolder);
                }

                const fileName = `${sketchFolder}/sketch-${Date.now()}.png`;
                await this.app.vault.createBinary(fileName, Uint8Array.from(atob(data), c => c.charCodeAt(0)).buffer);

                const editor = this.app.workspace.activeEditor?.editor;
                if (editor) {
                    editor.replaceRange(`\n![[${fileName}]]\n`, editor.getCursor());
                }

                setTimeout(() => { container.remove(); }, 50);
            };
        });
    }
}
