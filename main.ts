import { Plugin, TFolder, Editor } from 'obsidian';

interface LineStroke {
    id: number;
    color: string;
    width: number;
    points: { x: number; y: number }[];
}

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
            
            const colorInput = toolbar.createEl("input", { type: "color" });
            colorInput.value = "var(--text-normal)";
            
            const widthInput = toolbar.createEl("input", { type: "range", attr: { min: "1", max: "20", value: "3" } });
            
            const clearBtn = toolbar.createEl("button", { text: "Clear" });
            const saveBtn = toolbar.createEl("button", { text: "Save Sketch" });

            const canvas = container.createEl("canvas", { cls: "raster-canvas" });
            const ctx2d = canvas.getContext("2d")!;
            
            const dpr = window.devicePixelRatio || 1;
            const initialHeight = 300;
            const lineSpacing = 28;
            
            // Central Stroke Vector Storage Core
            let strokes: LineStroke[] = [];
            let currentStroke: LineStroke | null = null;
            let maxDrawnY = 0;
            let isSaving = false;

            const redrawCanvas = () => {
                ctx2d.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
                
                ctx2d.lineCap = "round";
                ctx2d.lineJoin = "round";

                // Draw all healthy persistent strokes
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

            const getPos = (e: PointerEvent) => {
                const r = canvas.getBoundingClientRect();
                return { x: (e.clientX - r.left), y: (e.clientY - r.top) };
            };

            // Helper function to calculate distance from an erase point to a line segment
            const pointToSegDist = (pt: {x:number, y:number}, p1: {x:number, y:number}, p2: {x:number, y:number}) => {
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                if (dx === 0 && dy === 0) return Math.hypot(pt.x - p1.x, pt.y - p1.y);
                const t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / (dx * dx + dy * dy);
                const clampedT = Math.max(0, Math.min(1, t));
                return Math.hypot(pt.x - (p1.x + clampedT * dx), pt.y - (p1.y + clampedT * dy));
            };

            const evaluateEraserCollision = (pos: {x: number, y: number}) => {
                const eraseRadius = 15; // Target footprint context sensitivity bounds
                let hitDetected = false;

                strokes = strokes.filter(stroke => {
                    for (let i = 0; i < stroke.points.length - 1; i++) {
                        if (pointToSegDist(pos, stroke.points[i], stroke.points[i+1]) < eraseRadius) {
                            hitDetected = true;
                            return false; // Erase entire vector stroke on target match
                        }
                    }
                    return true;
                });

                if (hitDetected) {
                    // Recalculate max bounding height from remaining strokes
                    maxDrawnY = 0;
                    for (const s of strokes) {
                        for (const p of s.points) {
                            if (p.y > maxDrawnY) maxDrawnY = p.y;
                        }
                    }
                    redrawCanvas();
                }
            };

            // Hardware-Aware Input Routing Engine
            canvas.addEventListener("pointerdown", (e) => {
                if (isSaving) return;
                const pos = getPos(e);

                // Detect S-Pen button engagement logic (buttons value 32 denotes barrel press)
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
                
                // Infinite bottom expansion frame allocation
                if (pos.y > (canvas.height / dpr) - 20) {
                    const oldWidth = canvas.width;
                    const oldHeight = canvas.height;
                    
                    canvas.height = oldHeight + (100 * dpr);
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
                const exportCtx = exportCanvas.getContext("2d")!;
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