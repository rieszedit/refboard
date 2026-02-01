import { useState, useEffect, useCallback, useRef } from "react";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen, emit } from "@tauri-apps/api/event";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { openPath } from "@tauri-apps/plugin-opener";
import { open as openDialog, ask } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./styles/App.css";
import type { Job, AppSettings, RequestReferenceDataPayload, UpdateReferenceDataPayload } from "./types";
import { loadAppData, saveAppData } from "./utils/storage";
import { useDiscord } from "./hooks/useDiscord";
import { t } from "./utils/i18n";
import { InvoiceGenerationModal } from "./components/InvoiceGenerationModal";
import type { InvoiceSettings } from "./types/invoice";
import { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import { initAnalytics, trackEvent } from "./utils/analytics";

registerLocale('ja', ja);

function App() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [settings, setSettings] = useState<AppSettings>({
        isDark: true,
        webhookUrl: "",
        discordAlertDays: [1, 0],
        inAppAlertDays: [1, 0],
        language: "en",
        notificationHour: 9,
        notificationMinute: 0,
    });
    const [showSettings, setShowSettings] = useState(false);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [selectedJobForInvoice, setSelectedJobForInvoice] = useState<Job | null>(null);
    const [pinned, setPinned] = useState(false);
    const [filter, setFilter] = useState<"active" | "completed">("active");
    const [alertQueue, setAlertQueue] = useState<string[]>([]);

    // 新規案件入力
    const [newJobTitle, setNewJobTitle] = useState("");
    const [appVersion, setAppVersion] = useState("");

    const appWindow = getCurrentWebviewWindow();
    const { sendToDiscord } = useDiscord(settings.webhookUrl);

    // データ読み込み
    const loadData = useCallback(async () => {
        const data = await loadAppData();
        setJobs(data.jobs || []);

        const hasSavedSettings = !!data.settings;
        setSettings(prev => ({
            ...prev,
            ...data.settings,
            discordAlertDays: data.settings?.discordAlertDays || prev.discordAlertDays,
            language: data.settings?.language || prev.language,
            hasCompletedOnboarding: hasSavedSettings ? (data.settings?.hasCompletedOnboarding ?? true) : false
        }));
    }, []);

    // データ保存
    const saveData = useCallback(async () => {
        await saveAppData({ settings, jobs });
    }, [settings, jobs]);

    // 初期化
    useEffect(() => {
        initAnalytics();
        trackEvent('app_launched', { version: '1.1.1' });
        loadData();
        getVersion().then(v => {
            console.log("Current App Version:", v);
            setAppVersion(v);
            trackEvent('app_ready', { version: v });
        });


        const initUpdater = async () => {
            try {
                const update = await check();
                if (update && update.available) {
                    console.log("Update available:", update.version);
                    const yes = await ask(
                        `RefBoard ${update.version} available!\n\n${update.body || 'New features and improvements.'}\n\nUpdate now?`,
                        { title: 'Update Available', kind: 'info', okLabel: 'Update', cancelLabel: 'Later' }
                    );
                    if (yes) {
                        await update.downloadAndInstall();
                        await relaunch();
                    }
                } else {
                    console.log("No update available");
                }
            } catch (error) {
                console.error("Failed to check for updates:", error);
            }
        };
        initUpdater();

        // 無駄なコンテキストメニューを無効化
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
        };
        document.addEventListener("contextmenu", handleContextMenu);
        return () => {
            document.removeEventListener("contextmenu", handleContextMenu);
        };
    }, [loadData]);

    // 自動保存
    useEffect(() => {
        const timer = setTimeout(() => saveData(), 1500);
        return () => clearTimeout(timer);
    }, [saveData]);

    // DOMテーマ反映
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", settings.isDark ? "dark" : "light");
        emit("theme-changed", { theme: settings.isDark ? "dark" : "light" });
    }, [settings.isDark]);

    useEffect(() => {
        emit("language-changed", { language: settings.language });
    }, [settings.language]);

    // Keep settings and jobs in ref for listeners
    const settingsRef = useRef(settings);
    const jobsRef = useRef(jobs);
    useEffect(() => { settingsRef.current = settings; }, [settings]);
    useEffect(() => { jobsRef.current = jobs; }, [jobs]);

    // ウィンドウ間同期
    useEffect(() => {
        let unlistenRequest: (() => void) | undefined;
        let unlistenUpdate: (() => void) | undefined;
        let unlistenInvoiceGenerated: (() => void) | undefined;

        const setupListeners = async () => {
            // リファレンス設定リクエスト
            unlistenRequest = await listen<RequestReferenceDataPayload>("request-reference-data", (event) => {
                const currentJobs = jobsRef.current;
                const job = currentJobs.find((j) => j.id === event.payload.jobId);
                if (job) {
                    emit(`reference-data-${event.payload.jobId}`, job);
                }
            });

            // リファレンスボードからの更新
            unlistenUpdate = await listen<UpdateReferenceDataPayload>("update-reference-data", (event) => {
                const updatedJob = event.payload.job;
                setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)));
            });

            // 請求書ウィンドウからの設定リクエスト
            await listen<{ jobId: string }>("invoice-request-settings", () => {
                const currentSettings = settingsRef.current;
                if (currentSettings.invoice) {
                    emit("invoice-settings-data", { settings: currentSettings.invoice });
                }
            });

            // 請求書生成完了
            unlistenInvoiceGenerated = await listen<{ jobId: string; invoiceNumber: string; invoiceDate: string; nextNumber: number }>("invoice-generated", (event) => {
                const { jobId, invoiceNumber, invoiceDate, nextNumber } = event.payload;
                // Update job with invoice info
                setJobs((prev) => prev.map((j) =>
                    j.id === jobId ? { ...j, invoiceGenerated: true, invoiceNumber, invoiceDate } : j
                ));
                // Update next invoice number
                setSettings((prev) => {
                    if (!prev.invoice) return prev;
                    return {
                        ...prev,
                        invoice: { ...prev.invoice, nextInvoiceNumber: nextNumber }
                    };
                });
            });
        };

        const setupInvoiceSettingsListeners = async () => {
            // 請求書設定リクエスト
            await listen("invoice-settings-request-data", () => {
                const defaultInvoiceSettings: InvoiceSettings = {
                    businessName: '',
                    postalCode: '',
                    phone: '',
                    address: '',
                    bankName: '',
                    branchName: '',
                    accountType: 'savings',
                    accountNumber: '',
                    accountHolder: '',
                    invoicePrefix: 'INV-',
                    nextInvoiceNumber: 1,
                    hasInvoiceRegistration: false
                };
                const currentSettings = settingsRef.current;
                emit("invoice-settings-data", { settings: currentSettings.invoice || defaultInvoiceSettings });
            });

            // 請求書設定保存
            await listen<InvoiceSettings>("invoice-settings-save", (event) => {
                setSettings((prev) => ({ ...prev, invoice: event.payload }));
            });
        };

        setupListeners();
        setupInvoiceSettingsListeners();

        return () => {
            if (unlistenRequest) unlistenRequest();
            if (unlistenUpdate) unlistenUpdate();
            if (unlistenInvoiceGenerated) unlistenInvoiceGenerated();
        };
    }, []);

    // 通知チェック
    useEffect(() => {
        if (jobs.length === 0) return;

        const checkDeadlines = async () => {
            const now = new Date();
            if (import.meta.env.DEV) {
                console.log(`[Notification Check] ${now.toLocaleTimeString()} - Checking ${jobs.length} jobs`);
                console.log(`[Settings] Notification time: ${settings.notificationHour.toString().padStart(2, '0')}:${settings.notificationMinute.toString().padStart(2, '0')}`);
            }

            let hasChanges = false;
            const updatedJobs = JSON.parse(JSON.stringify(jobs)) as Job[];

            for (const job of updatedJobs) {
                if (job.isCompleted || !job.deadline) continue;

                const deadline = new Date(job.deadline);
                const diffMs = deadline.getTime() - now.getTime();
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                if (import.meta.env.DEV) {
                    console.log(`[Job: ${job.title}] Deadline: ${deadline.toLocaleString()}, Days remaining: ${diffDays}`);
                }

                for (const daysBefore of settings.discordAlertDays) {
                    const ruleKey = `day-${daysBefore}`;
                    if (job.completedRules.includes(ruleKey)) {
                        if (import.meta.env.DEV) {
                            console.log(`  [Discord] ${daysBefore}d rule already completed`);
                        }
                        continue;
                    }

                    // 指定日の0時、または当日(0)なら現在との差分で判定
                    // 通知時刻チェック: 設定時刻以降のみ通知
                    const currentHour = now.getHours();
                    const currentMinute = now.getMinutes();
                    const isTimeToNotify =
                        currentHour > settings.notificationHour ||
                        (currentHour === settings.notificationHour && currentMinute >= settings.notificationMinute);

                    if (import.meta.env.DEV) {
                        console.log(`  [Discord] ${daysBefore}d check - diffDays: ${diffDays}, isTimeToNotify: ${isTimeToNotify} (${currentHour}:${currentMinute})`);
                    }

                    const isDue = diffDays <= daysBefore && isTimeToNotify;
                    if (isDue) {
                        if (import.meta.env.DEV) {
                            console.log(`  ✅ [Discord] Sending notification for ${daysBefore}d rule`);
                        }
                        const timeText = daysBefore === 0 ? t(settings.language, "today") : `${daysBefore}${t(settings.language, "daysAgo")}`;
                        const remainingText = diffDays < 0 ? t(settings.language, "expired") : (diffDays === 0 ? t(settings.language, "today") : `${t(settings.language, "remaining")}${diffDays}${t(settings.language, "days")}`);

                        const msg = `🔔 【${job.title}】 ${timeText}。\n(${t(settings.language, "currentRemainingTime")}: ${remainingText})`;

                        await sendToDiscord(msg, job.title, job.deadline, diffDays, settings.language);

                        // ローカル通知
                        let permissionGranted = await isPermissionGranted();
                        if (!permissionGranted) {
                            const permission = await requestPermission();
                            permissionGranted = permission === "granted";
                        }
                        if (permissionGranted) {
                            sendNotification({ title: "RefBoard Reminder", body: msg });
                        }

                        job.completedRules.push(ruleKey);
                        hasChanges = true;
                    }
                }

                // App Alert check
                for (const daysBefore of settings.inAppAlertDays) {
                    const ruleKey = `app-day-${daysBefore}`;
                    if (job.completedRules.includes(ruleKey)) {
                        if (import.meta.env.DEV) {
                            console.log(`  [In-App] ${daysBefore}d rule already completed`);
                        }
                        continue;
                    }

                    // 通知時刻チェック
                    const currentHour = now.getHours();
                    const currentMinute = now.getMinutes();
                    const isTimeToNotify =
                        currentHour > settings.notificationHour ||
                        (currentHour === settings.notificationHour && currentMinute >= settings.notificationMinute);

                    if (import.meta.env.DEV) {
                        console.log(`  [In-App] ${daysBefore}d check - diffDays: ${diffDays}, isTimeToNotify: ${isTimeToNotify}`);
                    }

                    if (diffDays <= daysBefore && isTimeToNotify) {
                        if (import.meta.env.DEV) {
                            console.log(`  ✅ [In-App] Showing alert for ${daysBefore}d rule`);
                        }
                        const timeText = daysBefore === 0 ? t(settings.language, "today") : `${daysBefore}${t(settings.language, "daysAgo")}`;
                        const remainingText = diffDays < 0 ? t(settings.language, "expired") : (diffDays === 0 ? t(settings.language, "today") : `${t(settings.language, "remaining")}${diffDays}${t(settings.language, "days")}`);
                        const msg = `🔔 【${job.title}】 ${timeText}。\n(${t(settings.language, "currentRemainingTime")}: ${remainingText})`;

                        setAlertQueue(prev => [...prev, msg]);
                        setTimeout(() => {
                            setAlertQueue(prev => prev.slice(1));
                        }, 8000);

                        job.completedRules.push(ruleKey);
                        hasChanges = true;
                    }
                }
            }

            if (hasChanges) {
                setJobs(updatedJobs);
            }
        };

        const interval = setInterval(checkDeadlines, 60000); // 1分毎
        return () => clearInterval(interval);
    }, [jobs, settings, sendToDiscord]);

    const addJob = () => {
        if (!newJobTitle.trim()) return;

        const now = new Date().toISOString();
        const newJob: Job = {
            id: Date.now().toString(),
            title: newJobTitle,
            deadline: null,
            completedRules: [],
            filePath: null,
            isCompleted: false,
            references: [],
            createdAt: now,
            updatedAt: now,
        };

        setJobs([newJob, ...jobs]);
        setNewJobTitle("");
    };

    const deleteJob = async (id: string) => {
        const confirmed = await ask(t(settings.language, "deleteConfirm"), {
            title: "RefBoard",
            kind: "warning",
        });
        if (confirmed) {
            setJobs((prev) => prev.filter((j) => j.id !== id));
        }
    };

    const updateJob = (id: string, updates: Partial<Job>) => {
        setJobs(
            jobs.map((j) =>
                j.id === id
                    ? { ...j, ...updates, updatedAt: new Date().toISOString() }
                    : j
            )
        );
    };

    const toggleJobComplete = (id: string, currentStatus: boolean, title: string) => {
        const newStatus = !currentStatus;
        updateJob(id, { isCompleted: newStatus });
        if (newStatus) {
            sendToDiscord(t(settings.language, "jobCompletedMessage", { title }));
        }
    };

    const attachFile = async (id: string) => {
        try {
            const selected = await openDialog({
                multiple: false,
                directory: false,
                // filters削除で全ファイル許可
            });

            if (selected && typeof selected === "string") {
                updateJob(id, { filePath: selected, isFolder: false });
            }
        } catch (e) {
            console.error("File selection failed:", e);
        }
    };

    const attachFolder = async (id: string) => {
        try {
            const selected = await openDialog({
                multiple: false,
                directory: true,
            });

            if (selected && typeof selected === "string") {
                updateJob(id, { filePath: selected, isFolder: true });
            }
        } catch (e) {
            console.error("Folder selection failed:", e);
        }
    };

    const handleOpenFile = async (path: string) => {
        try {
            await openPath(path);
        } catch (e) {
            console.error("Failed to open file:", e);
            alert(t(settings.language, "failedToOpenFile") + e);
        }
    };

    const handleOpenParentFolder = async (path: string) => {
        try {
            // 簡易的な親ディレクトリ取得 (Windows/Mac両対応)
            const parent = path.substring(0, Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')));
            if (parent) {
                await openPath(parent);
            }
        } catch (e) {
            console.error("Failed to open parent folder:", e);
        }
    };

    const openReferenceBoard = async (job: Job) => {
        const label = `ref-board-${job.id}`;
        const existing = await WebviewWindow.getByLabel(label);
        if (existing) {
            await existing.setFocus();
        } else {
            new WebviewWindow(label, {
                url: `/?window=reference&id=${job.id}&title=${encodeURIComponent(job.title)}&theme=${settings.isDark ? 'dark' : 'light'}&lang=${settings.language}`,
                title: `${job.title} - ${t(settings.language, "referenceBoard")}`,
                width: 1200,
                height: 800,
                decorations: false,
                transparent: true,
                dragDropEnabled: false, // Important for HTML5 events
            });
        }
    };

    // Helper: 残り時間表示
    const getDeadlineDisplay = (deadlineStr: string | null) => {
        if (!deadlineStr) return { text: t(settings.language, "notSet"), color: "#666", isUrgent: false };

        const now = new Date();
        const dead = new Date(deadlineStr);
        const diffMs = dead.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffMs < 0) return { text: `⚠️ ${t(settings.language, "expired")}`, color: "#ef4444", isUrgent: true };
        if (diffDays === 0) return { text: `🔥 ${t(settings.language, "todayDelivery")}`, color: "#f59e0b", isUrgent: true };
        if (diffDays === 1) return { text: `${t(settings.language, "remaining")}1${t(settings.language, "day")}`, color: "#f59e0b", isUrgent: true };
        if (diffDays <= 3) return { text: `${t(settings.language, "remaining")}${diffDays}${t(settings.language, "days")}`, color: "#fbbf24", isUrgent: true };
        if (diffDays <= 7) return { text: `${t(settings.language, "remaining")}${diffDays}${t(settings.language, "days")}`, color: "#a5b4fc", isUrgent: false };

        return {
            text: `${dead.getMonth() + 1}/${dead.getDate()}`,
            color: "#888",
            isUrgent: false,
        };
    };

    // Helper: ファイルアイコン
    const getFileIcon = (path: string) => {
        const lower = path.toLowerCase();
        if (lower.endsWith(".aep")) return "🟣";
        if (lower.endsWith(".prproj")) return "🟣";
        if (lower.endsWith(".aup") || lower.endsWith(".aup2")) return "🎞️";
        if (lower.endsWith(".psd")) return "🔵";
        if (lower.endsWith(".ai")) return "🟠";
        if (lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".avi") || lower.endsWith(".mkv")) return "🎬";
        if (lower.endsWith(".mp3") || lower.endsWith(".wav")) return "🎵";
        if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".svg") || lower.endsWith(".gif")) return "🖼️";
        if (lower.endsWith(".pdf")) return "📕";
        if (lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".7z")) return "📦";
        if (lower.endsWith(".exe") || lower.endsWith(".msi") || lower.endsWith(".bat")) return "⚙️";
        if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".json")) return "📝";
        if (lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".csv")) return "📊";
        if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "📄";
        return "📁";
    };

    // ウィンドウ操作
    const togglePin = async () => {
        const newState = !pinned;
        setPinned(newState);
        await appWindow.setAlwaysOnTop(newState);
    };

    const closeWindow = async () => {
        await saveData();
        appWindow.close();
    };

    const minimizeWindow = () => appWindow.minimize();

    const openInvoiceSettingsWindow = async () => {
        const label = 'invoice-settings';
        const existing = await WebviewWindow.getByLabel(label);
        if (existing) {
            await existing.setFocus();
        } else {
            new WebviewWindow(label, {
                url: `/?window=invoice-settings&theme=${settings.isDark ? 'dark' : 'light'}&lang=${settings.language}`,
                title: t(settings.language, "invoiceSettings"),
                width: 500,
                height: 800,
                decorations: false,
                transparent: true,
            });
        }
    };

    return (
        <div className="app-container">
            {/* オンボーディング */}
            {!settings.hasCompletedOnboarding && (
                <div className="onboarding-overlay" style={{ zIndex: 6000 }}>
                    <div className="onboarding-content">
                        <h2>{t(settings.language, "welcome")}</h2>
                        <p>{t(settings.language, "selectAesthetic")}</p>

                        <div className="onboarding-options">
                            <div className="option-group">
                                <button
                                    className={`option-toggle ${settings.isDark ? 'active' : ''}`}
                                    onClick={() => setSettings({ ...settings, isDark: true })}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                                </button>
                                <button
                                    className={`option-toggle ${!settings.isDark ? 'active' : ''}`}
                                    onClick={() => setSettings({ ...settings, isDark: false })}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                                </button>
                            </div>
                            <div className="option-divider" />
                            <div className="option-group">
                                <button
                                    className={`option-toggle text ${settings.language === 'en' ? 'active' : ''}`}
                                    onClick={() => setSettings({ ...settings, language: 'en' })}
                                >
                                    EN
                                </button>
                                <button
                                    className={`option-toggle text ${settings.language === 'ja' ? 'active' : ''}`}
                                    onClick={() => setSettings({ ...settings, language: 'ja' })}
                                >
                                    JP
                                </button>
                            </div>
                        </div>

                        <button className="onboarding-btn" onClick={() => setSettings({ ...settings, hasCompletedOnboarding: true })}>
                            {t(settings.language, "getStarted")}
                        </button>
                    </div>
                </div>
            )}

            {/* 設定オーバーレイ */}
            {showSettings && (
                <div className="settings-overlay">
                    <div className="settings-content">
                        <h3>{t(settings.language, "settings")}</h3>

                        <label className="webpack-label">{t(settings.language, "webhookUrl")}</label>
                        <input
                            type="password"
                            className="webhook-input"
                            placeholder="https://discord.com/api/webhooks/..."
                            value={settings.webhookUrl}
                            onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                        />
                        <label className="webpack-label">{t(settings.language, "alertDays")}</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '4px 0 12px' }}>
                            {[0, 1, 3, 7, 14, 30].map(day => (
                                <button
                                    key={day}
                                    className={`day-chip ${settings.discordAlertDays.includes(day) ? 'active' : ''}`}
                                    onClick={() => {
                                        const newDays = settings.discordAlertDays.includes(day)
                                            ? settings.discordAlertDays.filter(d => d !== day)
                                            : [...settings.discordAlertDays, day].sort((a, b) => b - a);
                                        setSettings({ ...settings, discordAlertDays: newDays });
                                    }}
                                >
                                    {day === 0 ? t(settings.language, "today") : `${day}d`}
                                </button>
                            ))}
                        </div>

                        <label className="webpack-label">{t(settings.language, "inAppAlertDays")}</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '4px 0 12px' }}>
                            {[0, 1, 3, 7, 14, 30].map(day => (
                                <button
                                    key={day}
                                    className={`day-chip ${settings.inAppAlertDays.includes(day) ? 'active' : ''}`}
                                    onClick={() => {
                                        const newDays = settings.inAppAlertDays.includes(day)
                                            ? settings.inAppAlertDays.filter(d => d !== day)
                                            : [...settings.inAppAlertDays, day].sort((a, b) => b - a);
                                        setSettings({ ...settings, inAppAlertDays: newDays });
                                    }}
                                >
                                    {day === 0 ? t(settings.language, "today") : `${day}d`}
                                </button>
                            ))}
                        </div>

                        <div style={{ margin: '20px 0 10px', fontSize: '12px', color: 'var(--text-sub)' }}>{t(settings.language, "theme")}</div>
                        <div className="toggle-switch-container" style={{ marginBottom: '20px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-sub)', marginRight: '10px' }}>LIGHT</span>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={settings.isDark}
                                    onChange={(e) => setSettings({ ...settings, isDark: e.target.checked })}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                            <span style={{ fontSize: '11px', color: 'var(--text-sub)', marginLeft: '10px' }}>DARK</span>
                        </div>

                        <div style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-sub)' }}>{t(settings.language, "language")}</div>
                        <select
                            className="language-dropdown"
                            value={settings.language}
                            onChange={(e) => setSettings({ ...settings, language: e.target.value as 'en' | 'ja' })}
                            style={{ marginBottom: '20px' }}
                        >
                            <option value="en">English</option>
                            <option value="ja">日本語</option>
                        </select>

                        <div style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-primary)' }}>{t(settings.language, "notificationTime")}</div>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                            <select
                                className="language-dropdown"
                                value={settings.notificationHour}
                                onChange={(e) => setSettings({ ...settings, notificationHour: parseInt(e.target.value) })}
                                style={{ flex: 1 }}
                            >
                                {Array.from({ length: 24 }, (_, i) => (
                                    <option key={i} value={i}>
                                        {i.toString().padStart(2, '0')}
                                    </option>
                                ))}
                            </select>
                            <span style={{ alignSelf: 'center', color: 'var(--text-sub)' }}>:</span>
                            <select
                                className="language-dropdown"
                                value={settings.notificationMinute}
                                onChange={(e) => setSettings({ ...settings, notificationMinute: parseInt(e.target.value) })}
                                style={{ flex: 1 }}
                            >
                                {Array.from({ length: 60 }, (_, i) => (
                                    <option key={i} value={i}>
                                        {i.toString().padStart(2, '0')}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ margin: '20px 0 10px', fontSize: '12px', color: 'var(--text-sub)' }}>{t(settings.language, "invoiceSettings")}</div>
                        <button
                            className="btn-secondary"
                            onClick={() => {
                                setShowSettings(false);
                                openInvoiceSettingsWindow();
                            }}
                            style={{ width: '100%', marginBottom: '20px' }}
                        >
                            {t(settings.language, "configureInvoice")}
                        </button>

                        <button className="btn-close-settings" onClick={() => setShowSettings(false)}>
                            {t(settings.language, "done")}
                        </button>

                        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px', textAlign: 'center' }}>
                            <a
                                href="https://ko-fi.com/rieszedit"
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => { e.preventDefault(); openPath("https://ko-fi.com/rieszedit"); }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    color: 'var(--text-primary)',
                                    textDecoration: 'none',
                                    padding: '8px 16px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '20px',
                                    fontSize: '13px'
                                }}
                            >
                                <span>☕</span>
                                {t(settings.language, "donateText")}
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* タイトルバー */}
            <div data-tauri-drag-region className="titlebar">
                <div className="drag-handle" data-tauri-drag-region>
                    <img src="/logo.png" style={{ width: 14, height: 14, marginRight: 8, pointerEvents: 'none' }} alt="" />
                    <span className="app-title" data-tauri-drag-region>REFBOARD</span>
                    <span className="app-subtitle" data-tauri-drag-region>Dashboard</span>
                </div>
                <div className="titlebar-controls">
                    <button className={`control-btn ${pinned ? "active" : ""}`} onClick={togglePin} title="Always on Top">
                        <svg viewBox="0 0 24 24" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    </button>
                    <button className="btn" onClick={() => setShowSettings(true)} title={t(settings.language, "settings")}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </button>
                    <button className="btn" onClick={minimizeWindow}>－</button>
                    <button className="btn" onClick={() => appWindow.toggleMaximize()}>□</button>
                    <button className="btn close-btn" onClick={closeWindow}>✕</button>
                </div>
            </div>

            {/* メインコンテンツ */}
            <div className="dashboard-container">
                {/* 入力エリア */}
                <div className="input-area">
                    <input
                        placeholder={t(settings.language, "placeholder")}
                        value={newJobTitle}
                        onChange={(e) => setNewJobTitle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addJob()}
                        className="job-title-input"
                    />
                </div>

                <div className="dashboard-tabs">
                    <button
                        className={`tab-btn ${filter === "active" ? "active" : ""}`}
                        onClick={() => setFilter("active")}
                    >
                        {t(settings.language, "active")} <span>{jobs.filter(j => !j.isCompleted).length}</span>
                    </button>
                    <button
                        className={`tab-btn ${filter === "completed" ? "active" : ""}`}
                        onClick={() => setFilter("completed")}
                    >
                        {t(settings.language, "finished")} <span>{jobs.filter(j => j.isCompleted).length}</span>
                    </button>
                </div>

                {/* 案件リスト */}
                <div className="job-list">
                    {jobs
                        .filter(j => filter === "active" ? !j.isCompleted : j.isCompleted)
                        .map((job) => {
                            const deadlineInfo = getDeadlineDisplay(job.deadline);
                            return (
                                <div key={job.id} className={`job-card ${job.isCompleted ? "completed" : ""}`}>
                                    {/* チェックボックス */}
                                    <div className="job-checkbox" onClick={() => toggleJobComplete(job.id, job.isCompleted, job.title)}>
                                        {job.isCompleted && (
                                            <>
                                                <div className="checkbox-dot" />
                                                <div className="fixed-stamp">FIXED</div>
                                            </>
                                        )}
                                    </div>

                                    <div className="board-trigger" onClick={() => openReferenceBoard(job)} title="Reference Board">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                                    </div>

                                    {/* Invoice Button */}
                                    <div
                                        className="board-trigger"
                                        onClick={async () => {
                                            if (settings.invoice) {
                                                const label = `invoice-${job.id}`;
                                                const existing = await WebviewWindow.getByLabel(label);
                                                if (existing) {
                                                    await existing.setFocus();
                                                } else {
                                                    new WebviewWindow(label, {
                                                        url: `/?window=invoice&id=${job.id}&title=${encodeURIComponent(job.title)}&theme=${settings.isDark ? 'dark' : 'light'}&lang=${settings.language}`,
                                                        title: `${t(settings.language, "generateInvoice")} - ${job.title}`,
                                                        width: 480,
                                                        height: 850,
                                                        decorations: false,
                                                        transparent: true,
                                                    });
                                                }
                                            } else {
                                                openInvoiceSettingsWindow();
                                            }
                                        }}
                                        title={t(settings.language, "generateInvoice")}
                                        style={{ marginLeft: '4px' }}
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                            <line x1="16" y1="13" x2="8" y2="13"></line>
                                            <line x1="16" y1="17" x2="8" y2="17"></line>
                                            <polyline points="10 9 9 9 8 9"></polyline>
                                        </svg>
                                    </div>


                                    {/* メイン情報 */}
                                    <div className="job-main">
                                        <div className="job-title">
                                            {job.title}
                                        </div>
                                        <div className="job-meta">
                                            {job.filePath ? (
                                                <div className="file-badge" onClick={() => job.isFolder ? attachFolder(job.id) : attachFile(job.id)} title="Click to change">
                                                    <span>{job.isFolder ? "📂" : getFileIcon(job.filePath)}</span>
                                                    {job.filePath.split(/[\\/]/).pop()}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <div className="file-placeholder" onClick={() => attachFile(job.id)} title="Attach File">
                                                        📎 {t(settings.language, "noFile")}
                                                    </div>
                                                    <div className="file-placeholder" onClick={() => attachFolder(job.id)} title="Attach Folder" style={{ padding: '0 8px' }}>
                                                        📂
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 締切とアクション */}
                                    <div className="job-actions">
                                        <div className="deadline-info">
                                            <DatePicker
                                                selected={job.deadline ? new Date(job.deadline) : null}
                                                onChange={(date: Date | null) => updateJob(job.id, { deadline: date ? date.toISOString() : null })}
                                                showTimeSelect
                                                locale={settings.language === 'ja' ? 'ja' : undefined}
                                                timeFormat="HH:mm"
                                                dateFormat="MMM d, h:mm aa"
                                                portalId="root"
                                                popperPlacement="bottom-end"
                                                customInput={
                                                    <span className="deadline-badge" style={{ color: deadlineInfo.color }}>
                                                        {deadlineInfo.text}
                                                    </span>
                                                }
                                            />
                                            {job.deadline && <div className="deadline-time">{new Date(job.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>}
                                        </div>

                                        <div className="action-buttons">
                                            {job.filePath && (
                                                <>
                                                    <button className="icon-btn" onClick={() => handleOpenFile(job.filePath!)} title={job.isFolder ? "Open Folder" : t(settings.language, "openProject")}>
                                                        {job.isFolder ? "📂" : "▶"}
                                                    </button>
                                                    {!job.isFolder && (
                                                        <button className="icon-btn" onClick={() => handleOpenParentFolder(job.filePath!)} title="Open Parent Folder">
                                                            📂
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            <button className="icon-btn delete-btn" onClick={() => deleteJob(job.id)} title={t(settings.language, "delete")}>
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* In-app Alert Popups */}
            {alertQueue.length > 0 && (
                <div className="alert-popup-container">
                    {alertQueue.map((msg, idx) => (
                        <div key={idx} className="alert-popup">{msg.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</div>
                    ))}
                </div>
            )}

            {/* フッター */}
            <div className="footer">
                <div>
                    Status: {settings.webhookUrl ? t(settings.language, "connected") : t(settings.language, "localOnly")}
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <a
                        href="https://ko-fi.com/rieszedit"
                        onClick={(e) => { e.preventDefault(); openPath("https://ko-fi.com/rieszedit"); }}
                        style={{ color: 'var(--text-sub)', textDecoration: 'none', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <span>☕</span> {t(settings.language, "support")}
                    </a>
                    <span>|</span>
                    {t(settings.language, "version", { v: appVersion })}
                </div>
            </div>

            {/* Invoice Settings Modal */}


            {/* Invoice Generation Modal */}
            {showInvoiceModal && selectedJobForInvoice && settings.invoice && (
                <InvoiceGenerationModal
                    job={selectedJobForInvoice}
                    settings={settings.invoice}
                    language={settings.language}
                    onClose={() => {
                        setShowInvoiceModal(false);
                        setSelectedJobForInvoice(null);
                    }}
                    onGenerated={(invoiceNumber, invoiceDate) => {
                        const updatedJobs = jobs.map(j =>
                            j.id === selectedJobForInvoice.id
                                ? { ...j, invoiceGenerated: true, invoiceNumber, invoiceDate }
                                : j
                        );
                        setJobs(updatedJobs);
                        setSettings({
                            ...settings,
                            invoice: {
                                ...settings.invoice!,
                                nextInvoiceNumber: settings.invoice!.nextInvoiceNumber + 1
                            }
                        });
                        setShowInvoiceModal(false);
                        setSelectedJobForInvoice(null);
                    }}
                />
            )}
        </div>
    );
}

export default App;
