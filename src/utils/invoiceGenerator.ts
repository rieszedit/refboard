import jsPDF from 'jspdf';
import type { InvoiceData, InvoiceSettings } from '../types/invoice';

/**
 * 請求書の税金計算
 */
export function calculateInvoiceTotal(
    amount: number,
    includeTax: boolean,
    includeWithholding: boolean
): { taxAmount: number; withholdingAmount: number; totalAmount: number } {
    let taxAmount = 0;
    let withholdingAmount = 0;
    let totalAmount = amount;

    if (includeTax) {
        taxAmount = Math.floor(amount * 0.1); // 消費税10%
        totalAmount += taxAmount;
    }

    if (includeWithholding) {
        withholdingAmount = Math.floor(amount * 0.1021); // 源泉徴収10.21%
        totalAmount -= withholdingAmount;
    }

    return { taxAmount, withholdingAmount, totalAmount };
}

/**
 * 日付フォーマット（日本語）
 */
function formatDateJa(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

/**
 * 日付フォーマット（英語）
 */
function formatDateEn(dateStr: string): string {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * 金額フォーマット
 */
function formatAmount(amount: number): string {
    return amount.toLocaleString('ja-JP');
}

/**
 * 日本語請求書PDF生成
 */
export function generateJapaneseInvoice(
    data: InvoiceData,
    settings: InvoiceSettings
): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // タイトル
    doc.setFontSize(24);
    doc.text('請求書', pageWidth / 2, 25, { align: 'center' });

    // 宛名（左上）
    doc.setFontSize(13);
    doc.text(`${data.clientName} 御中`, 20, 45);

    // 請求番号・日付（右上）
    doc.setFontSize(10);
    doc.text(`No.`, 155, 45);
    doc.text(data.invoiceNumber, 170, 45);
    doc.text('請求日', 155, 51);
    doc.text(formatDateJa(data.invoiceDate), 170, 51);

    // 説明文
    doc.setFontSize(11);
    doc.text('以下のとおり、御請求申し上げます。', 20, 65);

    // 事業者情報（右側）
    doc.setFontSize(9);
    let yPos = 70;
    doc.text(`〒${settings.postalCode}`, 155, yPos);
    yPos += 5;
    doc.text(settings.address, 155, yPos);
    yPos += 5;
    doc.text(settings.businessName, 155, yPos);
    yPos += 5;
    doc.text(`TEL: ${settings.phone}`, 155, yPos);
    if (settings.email) {
        yPos += 5;
        doc.text(`Email: ${settings.email}`, 155, yPos);
    }

    // インボイス登録番号（右側ボックス）
    if (settings.hasInvoiceRegistration && settings.invoiceRegistrationNumber) {
        yPos += 8;
        doc.rect(155, yPos, 45, 12);
        doc.setFontSize(8);
        doc.text('インボイス登録番号', 157, yPos + 4);
        doc.setFontSize(9);
        doc.text(settings.invoiceRegistrationNumber, 157, yPos + 9);
    }

    // 案件情報（左側）
    doc.setFontSize(10);
    doc.text(`件名:`, 20, 80);
    doc.text(data.subject, 35, 80);
    doc.text(`支払期限:`, 20, 86);
    doc.text(formatDateJa(data.paymentDeadline), 42, 86);

    // 振込先情報
    doc.text(`振込先:`, 20, 95);
    doc.text(`${settings.bankName} ${settings.branchName}`, 38, 95);
    doc.text(`口座:`, 20, 101);
    const accountTypeJa = settings.accountType === 'savings' ? '普通' : '当座';
    doc.text(`${accountTypeJa} ${settings.accountNumber}`, 33, 101);
    doc.text(`口座名義:`, 20, 107);
    doc.text(settings.accountHolder, 42, 107);

    // 合計金額ボックス
    doc.setFontSize(14);
    doc.setLineWidth(0.5);
    doc.rect(20, 115, 90, 15);
    doc.setFontSize(12);
    doc.text('合計', 25, 125);
    doc.setFontSize(14);
    doc.text(`${formatAmount(data.totalAmount)} 円（税込）`, 50, 125);

    // 明細テーブル
    const tableStartY = 145;
    doc.setFontSize(10);
    doc.setLineWidth(0.3);

    // ヘッダー
    doc.setFillColor(60, 60, 60);
    doc.rect(20, tableStartY, 170, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('品目', 25, tableStartY + 5.5);
    doc.text('数量', 95, tableStartY + 5.5);
    doc.text('単位', 115, tableStartY + 5.5);
    doc.text('単価', 135, tableStartY + 5.5);
    doc.text('金額', 165, tableStartY + 5.5);
    doc.setTextColor(0, 0, 0);

    // 明細行
    doc.rect(20, tableStartY + 8, 170, 10);
    doc.text(data.subject, 25, tableStartY + 14.5);
    doc.text('1', 95, tableStartY + 14.5);
    doc.text('式', 115, tableStartY + 14.5);
    doc.text(formatAmount(data.amount), 135, tableStartY + 14.5);
    doc.text(formatAmount(data.amount), 165, tableStartY + 14.5);

    // 小計・税金・合計
    let summaryY = tableStartY + 25;
    doc.setFontSize(10);

    doc.text('小計', 135, summaryY);
    doc.text(formatAmount(data.amount), 165, summaryY);

    if (data.includeTax && data.taxAmount) {
        summaryY += 6;
        doc.text('消費税(10%)', 135, summaryY);
        doc.text(formatAmount(data.taxAmount), 165, summaryY);
    }

    if (data.includeWithholding && data.withholdingAmount) {
        summaryY += 6;
        doc.text('源泉徴収(10.21%)', 135, summaryY);
        doc.text(`-${formatAmount(data.withholdingAmount)}`, 165, summaryY);
    }

    summaryY += 8;
    doc.setFontSize(12);
    doc.setFillColor(240, 240, 240);
    doc.rect(130, summaryY - 5, 60, 8, 'F');
    doc.text('合計', 135, summaryY);
    doc.text(formatAmount(data.totalAmount), 165, summaryY);

    return doc;
}

/**
 * 英語請求書PDF生成
 */
export function generateInternationalInvoice(
    data: InvoiceData,
    settings: InvoiceSettings
): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // タイトル
    doc.setFontSize(28);
    doc.text('INVOICE', pageWidth / 2, 25, { align: 'center' });

    // 事業者情報（左上）
    doc.setFontSize(11);
    let yPos = 45;
    doc.text(settings.businessNameEn || settings.businessName, 20, yPos);
    yPos += 5;
    doc.text(settings.addressEn || settings.address, 20, yPos);
    yPos += 5;
    doc.text(`Phone: ${settings.phone}`, 20, yPos);
    if (settings.email) {
        yPos += 5;
        doc.text(`Email: ${settings.email}`, 20, yPos);
    }

    // 請求情報（右上）
    doc.setFontSize(10);
    doc.text(`Invoice #:`, 155, 45);
    doc.text(data.invoiceNumber, 175, 45);
    doc.text('Date:', 155, 51);
    doc.text(formatDateEn(data.invoiceDate), 175, 51);
    doc.text('Due Date:', 155, 57);
    doc.text(formatDateEn(data.paymentDeadline), 175, 57);

    // BILL TO
    doc.setFontSize(12);
    doc.text('BILL TO:', 20, 80);
    doc.setFontSize(11);
    doc.text(data.clientName, 20, 87);

    // 明細テーブル
    const tableStartY = 105;
    doc.setFontSize(10);
    doc.setLineWidth(0.3);

    // ヘッダー
    doc.setFillColor(60, 60, 60);
    doc.rect(20, tableStartY, 170, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Description', 25, tableStartY + 5.5);
    doc.text('Qty', 125, tableStartY + 5.5);
    doc.text('Rate', 145, tableStartY + 5.5);
    doc.text('Amount', 170, tableStartY + 5.5);
    doc.setTextColor(0, 0, 0);

    // 明細行
    doc.rect(20, tableStartY + 8, 170, 10);
    doc.text(data.subject, 25, tableStartY + 14.5);
    doc.text('1', 125, tableStartY + 14.5);
    doc.text(`¥${formatAmount(data.amount)}`, 145, tableStartY + 14.5);
    doc.text(`¥${formatAmount(data.amount)}`, 170, tableStartY + 14.5);

    // 小計・税金・合計
    let summaryY = tableStartY + 25;
    doc.setFontSize(10);

    doc.text('Subtotal:', 135, summaryY);
    doc.text(`¥${formatAmount(data.amount)}`, 170, summaryY);

    if (data.includeTax && data.taxAmount) {
        summaryY += 6;
        doc.text('Tax (10%):', 135, summaryY);
        doc.text(`¥${formatAmount(data.taxAmount)}`, 170, summaryY);
    }

    if (data.includeWithholding && data.withholdingAmount) {
        summaryY += 6;
        doc.text('Withholding (10.21%):', 135, summaryY);
        doc.text(`-¥${formatAmount(data.withholdingAmount)}`, 170, summaryY);
    }

    summaryY += 8;
    doc.setFontSize(12);
    doc.setFillColor(240, 240, 240);
    doc.rect(130, summaryY - 5, 60, 8, 'F');
    doc.text('Total:', 135, summaryY);
    doc.text(`¥${formatAmount(data.totalAmount)}`, 170, summaryY);

    // 支払い情報
    doc.setFontSize(10);
    summaryY += 20;
    doc.text('PAYMENT INFORMATION:', 20, summaryY);
    summaryY += 6;
    doc.text(`Bank: ${settings.bankNameEn || settings.bankName}`, 20, summaryY);
    summaryY += 5;
    doc.text(`Branch: ${settings.branchNameEn || settings.branchName}`, 20, summaryY);
    summaryY += 5;
    const accountTypeEn = settings.accountType === 'savings' ? 'Savings' : 'Checking';
    doc.text(`Account Type: ${accountTypeEn}`, 20, summaryY);
    summaryY += 5;
    doc.text(`Account Number: ${settings.accountNumber}`, 20, summaryY);
    summaryY += 5;
    doc.text(`Account Holder: ${settings.accountHolderEn || settings.accountHolder}`, 20, summaryY);

    return doc;
}
