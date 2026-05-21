import { Plugin, TFolder, Editor, MarkdownView } from 'obsidian';

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
            container.style.position = "relative"; // Anchor for absolute delete button mapping

            const toolbar = container.createDiv({ cls: "raster-toolbar" });
            
            // Toolbar UI Controls
            const colorInput = toolbar.createEl("input", { type: "color" });
            colorInput.value = "var(--text-normal)";
            
            const widthInput = toolbar.createEl("input", { type: "range", attr: { min: "1", max: "20", value: "3" } });
            
            // Paper Background Selection Node
            const patternSelect = toolbar.createEl("select");
            const optLines = patternSelect.createEl("option", { text: "Lines", value: "lines" });
            const optDots = patternSelect.createEl("option", { text: "Dot Grid", value: "dots" });
            const optGraph = patternSelect.createEl("option", { text: "Graph Paper", value: "graph" });

            const clearBtn = toolbar.createEl("button", { text: "Clear" });
            const saveBtn = toolbar.createEl("button", { text: "Save Sketch" });

            // Self-Destruct / Delete Block Button UI Layer
            const deleteBlockBtn = container.createEl("button", { text: "✕", cls: "raster-delete-block-btn" });
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
            const ctx2d = canvas.getContext("2d")!;
            
            const dpr = window.devicePixelRatio || 1;
            const initialHeight = 300;
            
            let maxDrawnY = 0;
            let isSaving = false;

            // Pattern Sizing Metrics (5 squares/inch assumptions map to roughly 15px boxes at standard dpi)
            const lineSpacing = 28;
            const graphSpacing = 16; 

            // Adaptive Visual Grid Renderer Loop
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

            // High-Fidelity Pointer Tracker Engine
            canvas.addEventListener("pointerdown", (e) => {
                if (isSaving) return;
                drawing = true;
                ctx2d.beginPath();
                
                const pos = getPos(e);
                ctx2d.moveTo(pos.x, pos.y);

                // Hardware S-Pen Button Match (32) or Mouse Right Click (2) Action Routing
                if (e.buttons === 32 || e.buttons === 2) {
                    ctx2d.globalCompositeOperation = "destination-out"; // Pixel Mask Eraser Mode
                    ctx2d.lineWidth = 20; // Fixed high footprint eraser swath
                } else {
                    ctx2d.globalCompositeOperation = "source-over"; // Paint Mode
                    ctx2d.strokeStyle = colorInput.value;
                    ctx2d.lineWidth = parseInt(widthInput.value);
                    if (pos.y > maxDrawnY) maxDrawnY = pos.y;
                }
            });

            canvas.addEventListener("pointermove", (e) => {
                if (!drawing || isSaving) return;
                const pos = getPos(e);

                // Live Tracking modifiers for active swipes
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
                
                // Active Bottom Expansion Bounds Checking
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

// Markdown Code Block Eradication Parser
            deleteBlockBtn.onclick = async (e) => {
                e.preventDefault();
                const sectionInfo = ctx.getSectionInfo(el);
                if (!sectionInfo) return;

                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view) {
                    const editor = view.editor;
                    // Safely slice out the line range housing the code block sequence
                    editor.replaceRange("", 
                        { line: sectionInfo.lineStart, ch: 0 }, 
                        { line: sectionInfo.lineEnd + 1, ch: 0 }
                    );
                }
            };         

            // Matrix Compilation Engine (Bakes chosen pattern backgrounds into final PNG)
            saveBtn.onclick = async (e) => {
                e.preventDefault();
                if (isSaving) return;
                isSaving = true;
                drawing = false;

                const currentWidth = canvas.width / dpr;
                const pattern = patternSelect.value;
                
                // Clean calculation thresholds mapping crop boundaries per setting
                const trackingSpacing = pattern === "graph" ? graphSpacing : lineSpacing;
                const boundingGridLines = Math.max(1, Math.ceil(maxDrawnY / trackingSpacing));
                const croppedHeight = boundingGridLines * trackingSpacing;

                const exportCanvas = document.createElement("canvas");
                exportCanvas.width = currentWidth * dpr;
                exportCanvas.height = croppedHeight * dpr;
                const exportCtx = exportCanvas.getContext("2d")!;
                exportCtx.scale(dpr, dpr);

                // 1. Compile selected background pattern grid directly onto output layer
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

                // 2. Composite paint stroke modifications onto the grid layer
                exportCtx.drawImage(canvas, 0, 0, currentWidth, canvas.height / dpr);

                const data = exportCanvas.toDataURL("image/png").split(',')[1];
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) {
                    isSaving = false;
                    return;
                }

                let parentPath = activeFile.parent?.path || "";
                if (parentPath === "/" || parentPath.trim() === "") {
                    parentPath = "";
                }
                
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

                setTimeout(() => {
                    container.remove();
                }, 50);
            };
        });
    }
}