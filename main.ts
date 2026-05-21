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
            
            // Fixed initial sizing mapped to Device Pixel Ratio (DPI Awareness)
            const dpr = window.devicePixelRatio || 1;
            const initialHeight = 300;
            
            // Dynamic window scaling function
            const resizeCanvas = () => {
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width * dpr;
                canvas.height = initialHeight * dpr;
                ctx2d.scale(dpr, dpr);
                
                // Reinitialize drawing state context properties
                ctx2d.lineCap = "round";
                ctx2d.lineJoin = "round";
            };

            // Run sizing adjustments
            setTimeout(resizeCanvas, 50);

            let drawing = false;
            const getPos = (e: PointerEvent) => {
                const r = canvas.getBoundingClientRect();
                return { x: (e.clientX - r.left), y: (e.clientY - r.top) };
            };

            // Drawing Event Handlers
            canvas.addEventListener("pointerdown", (e) => {
                drawing = true;
                ctx2d.beginPath();
                ctx2d.strokeStyle = colorInput.value;
                ctx2d.lineWidth = parseInt(widthInput.value);
                const pos = getPos(e);
                ctx2d.moveTo(pos.x, pos.y);
            });

            canvas.addEventListener("pointermove", (e) => {
                if (!drawing) return;
                const pos = getPos(e);
                ctx2d.lineTo(pos.x, pos.y);
                ctx2d.stroke();
                
                // Dynamic expansion loop if user sketches close to the canvas bottom boundary
                if (pos.y > (canvas.height / dpr) - 20) {
                    const oldWidth = canvas.width;
                    const oldHeight = canvas.height;
                    
                    // Create a temporary backup image layer of current drawing state
                    const tempCanvas = document.createElement("canvas");
                    tempCanvas.width = oldWidth;
                    tempCanvas.height = oldHeight;
                    tempCanvas.getContext("2d")?.drawImage(canvas, 0, 0);

                    // Resize main canvas taller
                    canvas.height = oldHeight + (100 * dpr);
                    ctx2d.scale(dpr, dpr);
                    ctx2d.lineCap = "round";
                    ctx2d.lineJoin = "round";
                    
                    // Restore original sketch content coordinates
                    ctx2d.drawImage(tempCanvas, 0, 0, oldWidth / dpr, oldHeight / dpr);
                }
            });

            canvas.addEventListener("pointerup", () => drawing = false);
            canvas.addEventListener("pointerleave", () => drawing = false);
            
            clearBtn.onclick = () => ctx2d.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

            // Binary storage file compilation
            saveBtn.onclick = async () => {
                const data = canvas.toDataURL("image/png").split(',')[1];
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
            };
        });
    }
}