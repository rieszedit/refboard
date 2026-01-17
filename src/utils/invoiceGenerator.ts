import html2canvas from 'html2canvas';
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
        taxAmount = Math.floor(amount * 0.1);
        totalAmount += taxAmount;
    }

    if (includeWithholding) {
        withholdingAmount = Math.floor(amount * 0.1021);
        totalAmount -= withholdingAmount;
    }

    return { taxAmount, withholdingAmount, totalAmount };
}

function formatDateJa(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatAmount(amount: number): string {
    return amount.toLocaleString('ja-JP');
}

/**
 * 日本語請求書HTMLを生成
 */
function generateJapaneseInvoiceHTML(data: InvoiceData, settings: InvoiceSettings): string {
    const accountTypeJa = settings.accountType === 'savings' ? '普通' : '当座';

    return `
    <div style="
        width: 794px;
        padding: 40px;
        font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
        font-size: 14px;
        color: #333;
        background: white;
    ">
        <!-- タイトル -->
        <h1 style="text-align: center; font-size: 28px; margin-bottom: 30px; letter-spacing: 8px;">請求書</h1>
        
        <!-- 宛名と請求情報 -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
            <div>
                <div style="font-size: 18px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px;">
                    ${data.clientName} 御中
                </div>
            </div>
            <div style="text-align: right; font-size: 12px;">
                <div>No. ${data.invoiceNumber}</div>
                <div>請求日: ${formatDateJa(data.invoiceDate)}</div>
            </div>
        </div>
        
        <!-- 説明文 -->
        <p style="margin-bottom: 20px;">以下のとおり、御請求申し上げます。</p>
        
        <!-- 合計金額ボックス -->
        <div style="
            border: 2px solid #333;
            padding: 15px 30px;
            margin-bottom: 30px;
            display: inline-block;
        ">
            <span style="font-size: 14px;">合計金額　</span>
            <span style="font-size: 24px; font-weight: bold;">¥${formatAmount(data.totalAmount)}-</span>
            <span style="font-size: 12px;">（税込）</span>
        </div>
        
        <!-- 事業者情報 -->
        <div style="text-align: right; font-size: 12px; margin-bottom: 20px;">
            <div>〒${settings.postalCode}</div>
            <div>${settings.address}</div>
            <div style="font-weight: bold;">${settings.businessName}</div>
            <div>TEL: ${settings.phone}</div>
            ${settings.email ? `<div>Email: ${settings.email}</div>` : ''}
            ${settings.hasInvoiceRegistration && settings.invoiceRegistrationNumber ? `
                <div style="margin-top: 10px; border: 1px solid #333; padding: 5px; display: inline-block;">
                    <div style="font-size: 10px;">インボイス登録番号</div>
                    <div>${settings.invoiceRegistrationNumber}</div>
                </div>
            ` : ''}
        </div>
        
        <!-- 案件情報 -->
        <div style="margin-bottom: 20px; font-size: 13px;">
            <div><strong>件名：</strong>${data.subject}</div>
            <div><strong>支払期限：</strong>${formatDateJa(data.paymentDeadline)}</div>
        </div>
        
        <!-- 振込先情報 -->
        <div style="margin-bottom: 20px; font-size: 13px; background: #f5f5f5; padding: 15px;">
            <div><strong>振込先</strong></div>
            <div>${settings.bankName} ${settings.branchName}</div>
            <div>${accountTypeJa} ${settings.accountNumber}</div>
            <div>口座名義: ${settings.accountHolder}</div>
        </div>
        
        <!-- 明細テーブル -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
                <tr style="background: #444; color: white;">
                    <th style="padding: 10px; text-align: left; width: 50%;">品目</th>
                    <th style="padding: 10px; text-align: center; width: 10%;">数量</th>
                    <th style="padding: 10px; text-align: center; width: 10%;">単位</th>
                    <th style="padding: 10px; text-align: right; width: 15%;">単価</th>
                    <th style="padding: 10px; text-align: right; width: 15%;">金額</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px;">${data.subject}</td>
                    <td style="padding: 10px; text-align: center;">1</td>
                    <td style="padding: 10px; text-align: center;">式</td>
                    <td style="padding: 10px; text-align: right;">¥${formatAmount(data.amount)}</td>
                    <td style="padding: 10px; text-align: right;">¥${formatAmount(data.amount)}</td>
                </tr>
            </tbody>
        </table>
        
        <!-- 小計・税金・合計 -->
        <div style="text-align: right; font-size: 13px;">
            <div style="display: flex; justify-content: flex-end; margin-bottom: 5px;">
                <span style="width: 120px;">小計</span>
                <span style="width: 120px; text-align: right;">¥${formatAmount(data.amount)}</span>
            </div>
            ${data.includeTax ? `
                <div style="display: flex; justify-content: flex-end; margin-bottom: 5px;">
                    <span style="width: 120px;">消費税 (10%)</span>
                    <span style="width: 120px; text-align: right;">¥${formatAmount(data.taxAmount || 0)}</span>
                </div>
            ` : ''}
            ${data.includeWithholding ? `
                <div style="display: flex; justify-content: flex-end; margin-bottom: 5px;">
                    <span style="width: 120px;">源泉徴収 (10.21%)</span>
                    <span style="width: 120px; text-align: right;">-¥${formatAmount(data.withholdingAmount || 0)}</span>
                </div>
            ` : ''}
            <div style="display: flex; justify-content: flex-end; margin-top: 10px; padding-top: 10px; border-top: 2px solid #333; font-weight: bold; font-size: 16px;">
                <span style="width: 120px;">合計</span>
                <span style="width: 120px; text-align: right;">¥${formatAmount(data.totalAmount)}</span>
            </div>
        </div>
    </div>
    `;
}

/**
 * 英語請求書HTMLを生成
 */
function generateInternationalInvoiceHTML(data: InvoiceData, settings: InvoiceSettings): string {
    const formatDateEn = (dateStr: string): string => {
        const d = new Date(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    };

    const accountTypeEn = settings.accountType === 'savings' ? 'Savings' : 'Checking';

    return `
    <div style="
        width: 794px;
        padding: 40px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        color: #333;
        background: white;
    ">
        <!-- Title -->
        <h1 style="text-align: center; font-size: 32px; margin-bottom: 30px; letter-spacing: 4px;">INVOICE</h1>
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <!-- From -->
            <div>
                <div style="font-weight: bold; font-size: 16px;">${settings.businessNameEn || settings.businessName}</div>
                <div>${settings.addressEn || settings.address}</div>
                <div>Phone: ${settings.phone}</div>
                ${settings.email ? `<div>Email: ${settings.email}</div>` : ''}
            </div>
            
            <!-- Invoice Info -->
            <div style="text-align: right;">
                <div><strong>Invoice #:</strong> ${data.invoiceNumber}</div>
                <div><strong>Date:</strong> ${formatDateEn(data.invoiceDate)}</div>
                <div><strong>Due Date:</strong> ${formatDateEn(data.paymentDeadline)}</div>
            </div>
        </div>
        
        <!-- Bill To -->
        <div style="margin-bottom: 30px;">
            <div style="font-weight: bold; margin-bottom: 5px;">BILL TO:</div>
            <div style="font-size: 16px;">${data.clientName}</div>
        </div>
        
        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
                <tr style="background: #444; color: white;">
                    <th style="padding: 10px; text-align: left; width: 60%;">Description</th>
                    <th style="padding: 10px; text-align: center; width: 10%;">Qty</th>
                    <th style="padding: 10px; text-align: right; width: 15%;">Rate</th>
                    <th style="padding: 10px; text-align: right; width: 15%;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px;">${data.subject}</td>
                    <td style="padding: 10px; text-align: center;">1</td>
                    <td style="padding: 10px; text-align: right;">¥${formatAmount(data.amount)}</td>
                    <td style="padding: 10px; text-align: right;">¥${formatAmount(data.amount)}</td>
                </tr>
            </tbody>
        </table>
        
        <!-- Totals -->
        <div style="text-align: right; font-size: 13px;">
            <div style="display: flex; justify-content: flex-end; margin-bottom: 5px;">
                <span style="width: 150px;">Subtotal</span>
                <span style="width: 120px; text-align: right;">¥${formatAmount(data.amount)}</span>
            </div>
            ${data.includeTax ? `
                <div style="display: flex; justify-content: flex-end; margin-bottom: 5px;">
                    <span style="width: 150px;">Tax (10%)</span>
                    <span style="width: 120px; text-align: right;">¥${formatAmount(data.taxAmount || 0)}</span>
                </div>
            ` : ''}
            ${data.includeWithholding ? `
                <div style="display: flex; justify-content: flex-end; margin-bottom: 5px;">
                    <span style="width: 150px;">Withholding (10.21%)</span>
                    <span style="width: 120px; text-align: right;">-¥${formatAmount(data.withholdingAmount || 0)}</span>
                </div>
            ` : ''}
            <div style="display: flex; justify-content: flex-end; margin-top: 10px; padding-top: 10px; border-top: 2px solid #333; font-weight: bold; font-size: 16px;">
                <span style="width: 150px;">Total</span>
                <span style="width: 120px; text-align: right;">¥${formatAmount(data.totalAmount)}</span>
            </div>
        </div>
        
        <!-- Payment Info -->
        <div style="margin-top: 30px; padding: 15px; background: #f5f5f5;">
            <div style="font-weight: bold; margin-bottom: 10px;">PAYMENT INFORMATION</div>
            <div>Bank: ${settings.bankNameEn || settings.bankName}</div>
            <div>Branch: ${settings.branchNameEn || settings.branchName}</div>
            <div>Account Type: ${accountTypeEn}</div>
            <div>Account Number: ${settings.accountNumber}</div>
            <div>Account Holder: ${settings.accountHolderEn || settings.accountHolder}</div>
        </div>
    </div>
    `;
}

/**
 * HTMLからPDFを生成
 */
async function generatePDFFromHTML(html: string): Promise<jsPDF> {
    // 一時的なコンテナを作成
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    try {
        // html2canvasでキャンバスに変換
        const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        // jsPDFドキュメントを作成
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // 画像をPDFに追加
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, Math.min(imgHeight, pdfHeight));

        return pdf;
    } finally {
        // 一時コンテナを削除
        document.body.removeChild(container);
    }
}

/**
 * 日本語請求書PDF生成
 */
export async function generateJapaneseInvoice(
    data: InvoiceData,
    settings: InvoiceSettings
): Promise<jsPDF> {
    const html = generateJapaneseInvoiceHTML(data, settings);
    return generatePDFFromHTML(html);
}

/**
 * 英語請求書PDF生成
 */
export async function generateInternationalInvoice(
    data: InvoiceData,
    settings: InvoiceSettings
): Promise<jsPDF> {
    const html = generateInternationalInvoiceHTML(data, settings);
    return generatePDFFromHTML(html);
}
