import { readTextFile, writeTextFile, BaseDirectory, mkdir, exists } from "@tauri-apps/plugin-fs";
import type { AppData, AppSettings } from "../types";

const DATA_DIR = "refboard-pro";
const DATA_FILE = `${DATA_DIR}/data.json`;

// デフォルト設定
const DEFAULT_SETTINGS: AppSettings = {
    isDark: true,
    webhookUrl: "",
    discordAlertDays: [1, 0],
    inAppAlertDays: [1, 0],
    language: "en",
    notificationHour: 9,
    notificationMinute: 0,
};

// データディレクトリを確保
async function ensureDataDir(): Promise<void> {
    const dirExists = await exists(DATA_DIR, { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
        await mkdir(DATA_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
    }
}

// データ読み込み
export async function loadAppData(): Promise<AppData> {
    try {
        await ensureDataDir();
        const content = await readTextFile(DATA_FILE, { baseDir: BaseDirectory.AppData });
        const data: AppData = JSON.parse(content);

        // デフォルト値でマージ
        return {
            settings: { ...DEFAULT_SETTINGS, ...data.settings },
            jobs: data.jobs || [],
        };
    } catch (e) {
        console.log("新規データ作成:", e);
        return {
            settings: DEFAULT_SETTINGS,
            jobs: [],
        };
    }
}

// データ保存
export async function saveAppData(data: AppData): Promise<void> {
    try {
        await ensureDataDir();
        await writeTextFile(DATA_FILE, JSON.stringify(data, null, 2), {
            baseDir: BaseDirectory.AppData,
        });
        console.log("データ保存成功:", data.jobs.length, "件");
    } catch (e) {
        console.error("保存エラー:", e);
        throw new Error("データの保存に失敗しました: " + e);
    }
}

// 画像保存用ディレクトリ確保
export async function ensureImagesDir(): Promise<void> {
    const imagesDir = `${DATA_DIR}/images`;
    const dirExists = await exists(imagesDir, { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
        await mkdir(imagesDir, { baseDir: BaseDirectory.AppData, recursive: true });
    }
}
