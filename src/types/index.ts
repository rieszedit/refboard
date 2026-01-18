import type { InvoiceSettings } from "./invoice";

// リファレンスアイテム
export interface ReferenceItem {
    id: string;
    path: string;           // ローカルファイルパス
    originalUrl?: string;   // Web由来の場合の元URL
    type: 'image' | 'video';
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    zIndex: number;
}

// 案件（Job）
export interface Job {
    id: string;
    title: string;
    deadline: string | null;
    completedRules: string[]; // すでに通知済みのキー（"day-3", "day-0" 等）
    filePath: string | null;
    isFolder?: boolean;
    isCompleted: boolean;
    references: ReferenceItem[];
    createdAt: string;
    updatedAt: string;
    invoiceGenerated?: boolean;
    invoiceNumber?: string;
    invoiceDate?: string;
}

// アプリ設定
export interface AppSettings {
    isDark: boolean;
    webhookUrl: string;
    discordAlertDays: number[]; // 通知する日数リスト [7, 3, 1, 0]
    inAppAlertDays: number[];    // アプリ内通知する日数リスト
    hasCompletedOnboarding?: boolean;
    language: "en" | "ja";
    notificationHour: number;    // 通知時刻（時）0-23
    notificationMinute: number;  // 通知時刻（分）0-59
    invoice?: InvoiceSettings;   // 請求書設定
}

// 保存データ構造
export interface AppData {
    settings: AppSettings;
    jobs: Job[];
}

// イベントペイロード型
export interface RequestReferenceDataPayload {
    jobId: string;
}

export interface UpdateReferenceDataPayload {
    job: Job;
}
