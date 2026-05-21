import { Plugin, TFolder, Editor } from 'obsidian';

export default class RasterSketchPlugin extends Plugin {
    async onload() {
        // Register the Ctrl+P Command Palette Action
        this.addCommand({
            id: 'insert-raster-sketch-block',
            name: 'Insert Raster Sketch Block',
            editorCallback: (editor: Editor) => {
                editor.replaceSelection("\n```raster-sketch\n\n```\n");
            }
        });

        // Register the rendering engine for the code block
        this.registerMarkdownCodeBlockProcessor("raster-sketch", (source, el, ctx) => {
            const container = el.createDiv({ cls: "raster-container" });
            const toolbar = container.createDiv({ cls: "raster-toolbar" });
            
            // Toolbar UI Controls
            const colorInput = toolbar.createEl("input", { type: "color" });
            colorInput.value = "var(--text-normal)";
            
            const widthInput = toolbar.createEl("input", { type: "range", attr: { min: "1", max: "20", value: "3" } });
            
            const clearBtn = toolbar.createEl("button", { text: "Clear" });
            const saveBtn = toolbar.createEl("button", { text: "Save Sketch" });

            const canvas = container.createEl("canvas", { cls: "raster-canvas" });
            const ctx2d = canvas.getContext("2d")!;
            
            const dpr = window.devicePixelRatio || 1;
            const initialHeight = 300;
            const lineSpacing = 28; // Matches the CSS background size
            
            // Track the maximum vertical point where the user has actually drawn
            let maxDrawnY = 0;

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
            const getPos = (e: PointerEvent) => {
                const r = canvas.getBoundingClientRect();
                return { x: (e.clientX - r.left), y: (e.clientY - r.top) };
            };

            canvas.addEventListener("pointerdown", (e) => {
                drawing = true;
                ctx2d.beginPath();
                ctx2d.strokeStyle = colorInput.value;
                ctx2d.lineWidth = parseInt(widthInput.value);
                const pos = getPos(e);
                ctx2d.moveTo(pos.x, pos.y);
                
                if (pos.y > maxDrawnY) maxDrawnY = pos.y;
            });

            canvas.addEventListener("pointermove", (e) => {
                if (!drawing) return;
                const pos = getPos(e);
                ctx2d.lineTo(pos.x, pos.y);
                ctx2d.stroke();
                
                // Track bounds for cropping later
                if (pos.y > maxDrawnY) maxDrawnY = pos.y;
                
                // Dynamic expansion loop
                if (pos.y > (canvas.height / dpr) - 20) {
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

            canvas.addEventListener("pointerup", () => drawing = false);
            canvas.addEventListener("pointerleave", () => drawing = false);
            
            clearBtn.onclick = () => {
                ctx2d.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
                maxDrawnY = 0;
            };

            // Save and clean up pipeline
            saveBtn.onclick = async () => {
                const currentWidth = canvas.width / dpr;
                const currentHeight = canvas.height / dpr;

                // Determine content height based on your brush strokes, rounded up to the nearest grid line
                // If you didn't draw anything, default to one grid line high
                const boundingGridLines = Math.max(1, Math.ceil(maxDrawnY / lineSpacing));
                const croppedHeight = boundingGridLines * lineSpacing;

                // Create an invisible scratchpad canvas to compile the baked export image
                const exportCanvas = document.createElement("canvas");
                exportCanvas.width = currentWidth * dpr;
                exportCanvas.height = croppedHeight * dpr;
                const exportCtx = exportCanvas.getContext("2d")!;
                exportCtx.scale(dpr, dpr);

                // 1. Bake the college-ruled lines into the background matrix
                exportCtx.strokeStyle = "#e0f7fa";
                exportCtx.lineWidth = 1;
                for (let y = lineSpacing; y <= croppedHeight; y += lineSpacing) {
                    exportCtx.beginPath();
                    exportCtx.moveTo(0, y);
                    exportCtx.lineTo(currentWidth, y);
                    exportCtx.stroke();
                }

                // 2. Overlay your drawing onto the background
                exportCtx.drawImage(canvas, 0, 0, currentWidth, currentHeight);

                // Convert compile map to clean binary
                const data = exportCanvas.toDataURL("image/png").split(',')[1];
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) return;

                const folderPath = activeFile.parent?.path || "";
                const sketchFolder = folderPath ? `${folderPath}/sketches` : "sketches";
                
                if (!(this.app.vault.getAbstractFileByPath(sketchFolder) instanceof TFolder)) {
                    await this.app.vault.createFolder(sketchFolder);
                }

                const fileName = `${sketchFolder}/sketch-${Date.now()}.png`;
                await this.app.vault.createBinary(fileName, Uint8Array.from(atob(data), c => c.charCodeAt(0)).buffer);
                
                const editor = this.app.workspace.activeEditor?.editor;
                if (editor) {
                    editor.replaceRange(`\n![[${fileName}]]\n`, editor.getCursor());
                }

                // 3. Remove the sketch UI block window from the active view
                container.remove();
            };
        });
    }
}