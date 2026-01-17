export interface InvoiceSettings {
    // Business Information
    businessName: string;
    businessNameEn?: string;
    postalCode: string;
    address: string;
    addressEn?: string;
    phone: string;
    email?: string;

    // Banking Information
    bankName: string;
    bankNameEn?: string;
    branchName: string;
    branchNameEn?: string;
    accountType: 'savings' | 'checking'; // 普通 or 当座
    accountNumber: string;
    accountHolder: string;
    accountHolderEn?: string;

    // Tax Settings
    hasInvoiceRegistration: boolean; // インボイス登録
    invoiceRegistrationNumber?: string; // T + 13桁

    // Invoice Defaults
    nextInvoiceNumber: number;
    invoicePrefix: string; // e.g., "INV-"
}

export interface InvoiceData {
    invoiceNumber: string;
    invoiceDate: string;

    // Client
    clientName: string;

    // Items
    subject: string; // 件名
    amount: number; // 金額（税抜）

    // Payment
    paymentDeadline: string;

    // Tax Options
    includeTax: boolean; // 消費税
    includeWithholding: boolean; // 源泉徴収

    // Calculated
    taxAmount?: number;
    withholdingAmount?: number;
    totalAmount: number;
}

export type InvoiceLanguage = 'ja' | 'en';
