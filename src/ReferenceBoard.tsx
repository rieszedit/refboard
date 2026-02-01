import { useState, useEffect, useRef, useCallback } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { appDataDir, join } from "@tauri-apps/api/path";
import { writeFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./styles/ReferenceBoard.css";
import { loadAppData, saveAppData, ensureImagesDir } from "./utils/storage";
import { t } from "./utils/i18n";
import type { Job, ReferenceItem } from "./types";

interface CanvasState {
    x: number;
    y: number;
    scale: number;
}

type ResizeHandleType = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type InteractionMode = "IDLE" | "PANNING" | "DRAGGING_ITEMS" | "RESIZING";

export default function ReferenceBoard() {
    // Persistent State
    const [jobData, setJobData] = useState<Job>(() => {
        const params = new URLSearchParams(window.location.search);
        const jobId = params.get("id") || params.get("jobId");
        const jobTitle = params.get("title");

        return {
            id: jobId || "standalone",
            title: jobTitle || "Standalone Board",
            references: [],
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            deadline: null,
            completedRules: [],
            filePath: null,
            isCompleted: false
        };
    });

    const [canvas, setCanvas] = useState<CanvasState>({ x: 0, y: 0, scale: 1 });
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [mode, setMode] = useState<InteractionMode>("IDLE");
    const [activeHandle, setActiveHandle] = useState<ResizeHandleType | null>(null);
    const [theme, setTheme] = useState<"dark" | "light">(
        (new URLSearchParams(window.location.search).get("theme") as "dark" | "light") || "dark"
    );
    const [language, setLanguage] = useState<"en" | "ja">(
        (new URLSearchParams(window.location.search).get("lang") as "en" | "ja") || "en"
    );

    // Window Management State
    const [isPinned, setIsPinned] = useState(false);

    // History State
    const [past, setPast] = useState<Job[]>([]);
    const [future, setFuture] = useState<Job[]>([]);

    // Internal Clipboard
    const [clipboard, setClipboard] = useState<ReferenceItem[]>([]);
    const pasteOffsetCount = useRef(0);

    const lastMousePos = useRef<{ x: number, y: number } | null>(null);
    const initialItemStates = useRef<Map<string, ReferenceItem>>(new Map());
    const boardRef = useRef<HTMLDivElement>(null);
    const jobDataRef = useRef(jobData);
    useEffect(() => { jobDataRef.current = jobData; }, [jobData]);

    const appWindow = getCurrentWindow();

    // Apply Theme
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("refboard-theme", theme);
    }, [theme]);

    // --- 1. Data Sync & Dir Prep ---
    useEffect(() => {
        ensureImagesDir().catch(console.error);

        const jobId = jobData.id;
        if (jobId && jobId !== "standalone") {
            loadAppData().then(data => {
                const job = data.jobs.find(j => j.id === jobId);
                if (job) setJobData(job);
            }).catch(console.error);

            const unlistenRequest = listen<Job>(`reference-data-${jobId}`, (event) => {
                setJobData(event.payload);
            });

            emit("request-reference-data", { jobId });

            return () => {
                unlistenRequest.then(f => f());
            };
        }
    }, [jobData.id]);

    // Theme & Context Menu Sync
    useEffect(() => {
        const unlistenTheme = listen<{ theme: "light" | "dark" }>("theme-changed", (event) => {
            setTheme(event.payload.theme);
        });
        const unlistenLanguage = listen<{ language: "en" | "ja" }>("language-changed", (event) => {
            setLanguage(event.payload.language);
        });

        // 無駄なコンテキストメニューを無効化
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
        };
        document.addEventListener("contextmenu", handleContextMenu);

        return () => {
            unlistenTheme.then(f => f());
            unlistenLanguage.then(f => f());
            document.removeEventListener("contextmenu", handleContextMenu);
        };
    }, []);

    const updateJobData = useCallback(async (newJob: Job, saveToHistory: boolean = true) => {
        if (saveToHistory) {
            setPast(p => [...p, jobDataRef.current].slice(-50));
            setFuture([]);
        }

        setJobData(newJob);
        emit("update-reference-data", { job: newJob });

        if (newJob.id !== "standalone") {
            try {
                const data = await loadAppData();
                const idx = data.jobs.findIndex(j => j.id === newJob.id);
                if (idx !== -1) {
                    data.jobs[idx] = newJob;
                    await saveAppData(data);
                }
            } catch (e) { console.error("Save failed", e); }
        }
    }, []);

    // --- 2. History & Clipboard Actions ---
    const undo = useCallback(() => {
        if (past.length === 0) return;
        const previous = past[past.length - 1];
        setPast(p => p.slice(0, -1));
        setFuture(f => [jobDataRef.current, ...f]);
        setJobData(previous);
        emit("update-reference-data", { job: previous });
    }, [past]);

    const redo = useCallback(() => {
        if (future.length === 0) return;
        const next = future[0];
        setFuture(f => f.slice(1));
        setPast(p => [...p, jobDataRef.current]);
        setJobData(next);
        emit("update-reference-data", { job: next });
    }, [future]);

    const copy = useCallback(() => {
        if (selectedIds.size === 0) return;
        const itemsToCopy = jobDataRef.current.references.filter(r => selectedIds.has(r.id));
        setClipboard(itemsToCopy);
        pasteOffsetCount.current = 0;
    }, [selectedIds]);

    const paste = useCallback(() => {
        if (clipboard.length === 0) return;
        pasteOffsetCount.current += 1;
        const offset = 15 * pasteOffsetCount.current;
        const newItems = clipboard.map(item => ({
            ...item,
            id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
            x: item.x + offset,
            y: item.y + offset,
            zIndex: Math.max(...jobDataRef.current.references.map(r => r.zIndex), 0) + 1
        }));
        updateJobData({ ...jobDataRef.current, references: [...jobDataRef.current.references, ...newItems], updatedAt: new Date().toISOString() });
        setSelectedIds(new Set(newItems.map(i => i.id)));
    }, [clipboard, updateJobData]);

    const deleteSelected = useCallback(() => {
        if (selectedIds.size === 0) return;
        updateJobData({ ...jobDataRef.current, references: jobDataRef.current.references.filter(r => !selectedIds.has(r.id)), updatedAt: new Date().toISOString() });
        setSelectedIds(new Set());
    }, [selectedIds, updateJobData]);

    // --- 3. Canvas & Events ---
    const handleWheel = useCallback((e: WheelEvent) => {
        if (e.shiftKey) {
            setCanvas(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
        } else {
            e.preventDefault();
            const delta = -e.deltaY * 0.001;
            setCanvas(prev => {
                const newScale = Math.min(Math.max(0.1, prev.scale + delta), 5);
                const rect = boardRef.current?.getBoundingClientRect();
                if (!rect) return prev;
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const scaleRatio = newScale / prev.scale;
                return {
                    x: mouseX - (mouseX - prev.x) * scaleRatio,
                    y: mouseY - (mouseY - prev.y) * scaleRatio,
                    scale: newScale
                };
            });
        }
    }, []);

    useEffect(() => {
        const ref = boardRef.current;
        if (ref) {
            ref.addEventListener("wheel", handleWheel, { passive: false });
            return () => ref.removeEventListener("wheel", handleWheel);
        }
    }, [handleWheel]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            e.preventDefault();
            setMode("PANNING");
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        } else if (e.button === 0 && e.target === boardRef.current) {
            setSelectedIds(new Set());
        }
    };

    const handleItemMouseDown = (e: React.MouseEvent, item: ReferenceItem) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        let newSelection = new Set(selectedIds);
        if (e.ctrlKey || e.metaKey) {
            if (newSelection.has(item.id)) newSelection.delete(item.id); else newSelection.add(item.id);
        } else if (!newSelection.has(item.id)) {
            newSelection = new Set([item.id]);
        }
        setSelectedIds(newSelection);
        setMode("DRAGGING_ITEMS");
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        const snapshot = new Map();
        jobDataRef.current.references.forEach(ref => { if (newSelection.has(ref.id)) snapshot.set(ref.id, { ...ref }); });
        initialItemStates.current = snapshot;
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (mode === "IDLE") return;
        if (mode === "PANNING" && lastMousePos.current) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            setCanvas(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
        if (mode === "DRAGGING_ITEMS" && lastMousePos.current) {
            const dx = (e.clientX - lastMousePos.current.x) / canvas.scale;
            const dy = (e.clientY - lastMousePos.current.y) / canvas.scale;
            const updatedRefs = jobDataRef.current.references.map(ref => {
                if (selectedIds.has(ref.id)) return { ...ref, x: ref.x + dx, y: ref.y + dy };
                return ref;
            });
            setJobData(prev => ({ ...prev, references: updatedRefs }));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
        if (mode === "RESIZING" && lastMousePos.current && activeHandle) {
            const dx = (e.clientX - lastMousePos.current.x) / canvas.scale;
            const dy = (e.clientY - lastMousePos.current.y) / canvas.scale;

            const updatedRefs = jobDataRef.current.references.map(ref => {
                const initial = initialItemStates.current.get(ref.id);
                if (selectedIds.has(ref.id) && initial) {
                    const aspect = initial.width / initial.height;
                    let newX = ref.x;
                    let newY = ref.y;
                    let newW = ref.width;
                    let newH = ref.height;

                    // Calculate proposed changes based on movement
                    switch (activeHandle) {
                        case "se":
                            newW = Math.max(20, initial.width + dx);
                            newH = newW / aspect;
                            break;
                        case "nw":
                            newW = Math.max(20, initial.width - dx);
                            newH = newW / aspect;
                            newX = initial.x + (initial.width - newW);
                            newY = initial.y + (initial.height - newH);
                            break;
                        case "ne":
                            newW = Math.max(20, initial.width + dx);
                            newH = newW / aspect;
                            newY = initial.y + (initial.height - newH);
                            break;
                        case "sw":
                            newW = Math.max(20, initial.width - dx);
                            newH = newW / aspect;
                            newX = initial.x + (initial.width - newW);
                            break;
                        case "e":
                            newW = Math.max(20, initial.width + dx);
                            newH = newW / aspect;
                            break;
                        case "w":
                            newW = Math.max(20, initial.width - dx);
                            newH = newW / aspect;
                            newX = initial.x + (initial.width - newW);
                            break;
                        case "s":
                            newH = Math.max(20, initial.height + dy);
                            newW = newH * aspect;
                            break;
                        case "n":
                            newH = Math.max(20, initial.height - dy);
                            newW = newH * aspect;
                            newY = initial.y + (initial.height - newH);
                            break;
                    }

                    return { ...ref, x: newX, y: newY, width: newW, height: newH };
                }
                return ref;
            });
            setJobData(prev => ({ ...prev, references: updatedRefs }));
        }
    }, [mode, canvas.scale, selectedIds]);

    const handleMouseUp = useCallback(() => {
        if ((mode === "DRAGGING_ITEMS" || mode === "RESIZING")) updateJobData(jobDataRef.current);
        setMode("IDLE"); lastMousePos.current = null; setActiveHandle(null);
    }, [mode, updateJobData]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isCtrl = e.ctrlKey || e.metaKey;
            if (isCtrl && e.key === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
            if (isCtrl && e.key === "y") { e.preventDefault(); redo(); }
            if (isCtrl && e.key === "c") { e.preventDefault(); copy(); }
            if (isCtrl && e.key === "v") { e.preventDefault(); paste(); }
            if (e.key === "Delete" || e.key === "Backspace") {
                if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") deleteSelected();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp, undo, redo, copy, paste, deleteSelected]);

    // --- 4. Drop Handling ---
    const addRef = useCallback(async (pathOrUrl: string, screenX: number, screenY: number, isLocal: boolean) => {
        const currentJob = jobDataRef.current;
        // Compensate for titlebar height (32px)
        const canvasX = (screenX - canvas.x) / canvas.scale;
        const canvasY = (screenY - 32 - canvas.y) / canvas.scale;

        let finalPath = pathOrUrl;
        if (!isLocal) {
            try {
                let targetUrl = pathOrUrl;
                if (pathOrUrl.includes('pinimg.com')) {
                    for (const res of ['originals', '736x', '474x', '236x']) {
                        const testUrl = pathOrUrl.replace(/\/(originals|736x|474x|236x|75x75_RS)\//, `/${res}/`);
                        try {
                            const check = await tauriFetch(testUrl, { method: 'HEAD' });
                            if (check.ok) { targetUrl = testUrl; break; }
                        } catch (e) { continue; }
                    }
                }
                const response = await tauriFetch(targetUrl);
                if (!response.ok) throw new Error(`Fetch status: ${response.status}`);
                const buffer = await response.arrayBuffer();
                const fileName = `web-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.png`;
                const filePath = `refboard-pro/images/${fileName}`;
                await writeFile(filePath, new Uint8Array(buffer), { baseDir: BaseDirectory.AppData });
                finalPath = await join(await appDataDir(), filePath);
            } catch (e) { console.error("Web fetch failed", e); return; }
        }

        const maxZ = currentJob.references.length > 0 ? Math.max(...currentJob.references.map(r => r.zIndex)) : 0;
        const img = new Image();
        img.src = convertFileSrc(finalPath);
        await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
        const aspect = img.naturalWidth / img.naturalHeight || 1;
        const defaultWidth = 350;
        const defaultHeight = defaultWidth / aspect;

        const newRef: ReferenceItem = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
            path: finalPath, type: "image",
            x: canvasX - (defaultWidth / 2), y: canvasY - (defaultHeight / 2),
            width: defaultWidth, height: defaultHeight,
            rotation: 0, zIndex: maxZ + 1
        };
        updateJobData({ ...currentJob, references: [...currentJob.references, newRef], updatedAt: new Date().toISOString() });
    }, [canvas, updateJobData]);

    useEffect(() => {
        const onDrop = async (e: DragEvent) => {
            e.preventDefault();
            const { clientX, clientY } = e;
            if (e.dataTransfer?.files?.length) {
                const files = Array.from(e.dataTransfer.files);
                for (const file of files) {
                    if (!file.type.startsWith("image") && !file.type.startsWith("video")) continue;
                    try {
                        const buffer = await file.arrayBuffer();
                        const fileName = `local-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                        const filePath = `refboard-pro/images/${fileName}`;
                        await writeFile(filePath, new Uint8Array(buffer), { baseDir: BaseDirectory.AppData });
                        const absPath = await join(await appDataDir(), filePath);
                        addRef(absPath, clientX, clientY, true);
                    } catch (e) { console.error("Local write error", e); }
                }
            } else {
                const html = e.dataTransfer?.getData("text/html");
                const uri = e.dataTransfer?.getData("text/uri-list");
                const plain = e.dataTransfer?.getData("text/plain");
                if (html) {
                    const doc = new DOMParser().parseFromString(html, "text/html");
                    const img = doc.querySelector("img");
                    if (img && img.src) { addRef(img.src, clientX, clientY, false); return; }
                }
                if (uri) {
                    const lines = uri.split('\n').filter(l => l && !l.startsWith('#'));
                    if (lines.length > 0) { addRef(lines[0].trim(), clientX, clientY, false); return; }
                }
                if (plain && plain.startsWith("http")) addRef(plain.split('\n')[0].trim(), clientX, clientY, false);
            }
        };
        const onDragOver = (e: DragEvent) => e.preventDefault();
        window.addEventListener("drop", onDrop);
        window.addEventListener("dragover", onDragOver);
        return () => { window.removeEventListener("drop", onDrop); window.removeEventListener("dragover", onDragOver); };
    }, [addRef]);

    // --- 5. Window Controls ---
    const togglePin = async () => {
        const newState = !isPinned;
        setIsPinned(newState);
        await appWindow.setAlwaysOnTop(newState);
    };

    return (
        <div ref={boardRef} className="reference-board-container" onMouseDown={handleMouseDown} style={{ cursor: mode === "PANNING" ? "grabbing" : "default" }}>
            {/* Custom Title Bar */}
            <div
                className="custom-titlebar"
                data-tauri-drag-region
                onMouseDown={async (e) => {
                    if (e.button === 0 && e.target === e.currentTarget) {
                        try { await appWindow.startDragging(); } catch (e) { }
                    }
                }}
            >
                <div className="titlebar-info" data-tauri-drag-region>
                    <img src="/refboard-logo.png" style={{ width: 14, height: 14, pointerEvents: 'none' }} onError={(e) => (e.currentTarget.style.display = 'none')} alt="" />
                    <span data-tauri-drag-region style={{ pointerEvents: 'none' }}>{jobData.title}</span>
                </div>
                <div className="titlebar-controls">
                    <button className={`titlebar-btn pin ${isPinned ? 'active' : ''}`} onClick={togglePin} title="Always on Top">
                        <svg viewBox="0 0 24 24" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    </button>
                    <button className="titlebar-btn" onClick={() => appWindow.minimize()}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                    <button className="titlebar-btn" onClick={() => appWindow.toggleMaximize()}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                    </button>
                    <button className="titlebar-btn close" onClick={() => appWindow.close()}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>

            <div className="infinite-canvas" style={{ transform: `translate(${canvas.x}px, ${canvas.y}px) scale(${canvas.scale})`, transformOrigin: "0 0", position: "absolute", top: 32 }}>
                {jobData.references.map(ref => (
                    <div key={ref.id} className={`reference-item ${selectedIds.has(ref.id) ? "selected" : ""}`}
                        style={{ position: "absolute", left: ref.x, top: ref.y, width: ref.width, height: ref.height, zIndex: ref.zIndex }}
                        onMouseDown={(e) => handleItemMouseDown(e, ref)}>
                        <img src={convertFileSrc(ref.path)} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} alt="" />
                        {selectedIds.has(ref.id) && (
                            <>
                                {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as ResizeHandleType[]).map(h => (
                                    <div
                                        key={h}
                                        className={`resize-handle ${h}`}
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            setMode("RESIZING");
                                            setActiveHandle(h);
                                            lastMousePos.current = { x: e.clientX, y: e.clientY };
                                            const snapshot = new Map();
                                            jobDataRef.current.references.forEach(r => { if (selectedIds.has(r.id)) snapshot.set(r.id, { ...r }); });
                                            initialItemStates.current = snapshot;
                                        }}
                                    />
                                ))}
                            </>
                        )}
                    </div>
                ))}
            </div>

            <div className="board-info-overlay">
                <div className="board-controls-hint">{t(language, "helpUndoRedo")} | {t(language, "helpCopyPaste")}</div>
                <div className="board-controls-hint">{t(language, "helpPan")} | {t(language, "helpZoom")}</div>
            </div>
        </div>
    );
}
