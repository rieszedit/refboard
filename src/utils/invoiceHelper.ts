/**
 * 簡易請求書生成ヘルパー
 * 
 * 使い方:
 * 1. 設定で請求書情報を入力（事業者情報、振込先など）
 * 2. 案件完了時にこの関数を呼び出す
 * 3. PDFがダウンロードされる
 */

import { generateJapaneseInvoice, generateInternationalInvoice, calculateInvoiceTotal } from './invoiceGenerator';
import type { InvoiceData, InvoiceSettings, InvoiceLanguage } from '../types/invoice';
import { writeFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';

export async function quickGenerateInvoice(
    jobTitle: string,
    settings: InvoiceSettings,
    language: InvoiceLanguage = 'ja'
): Promise<void> {
    // 簡易入力用のプロンプト（将来的にはモーダルUIに置き換え）
    const clientName = prompt('宛名を入力してください:') || jobTitle;
    const amountStr = prompt('金額（税抜）を入力してください:') || '0';
    const amount = parseInt(amountStr.replace(/,/g, ''), 10);

    if (!amount || amount <= 0) {
        alert('有効な金額を入力してください');
        return;
    }

    const includeTax = confirm('消費税(10%)を含みますか？');
    const includeWithholding = confirm('源泉徴収(10.21%)を含みますか？');

    // 税金計算
    const { taxAmount, withholdingAmount, totalAmount } = calculateInvoiceTotal(
        amount,
        includeTax,
        includeWithholding
    );

    // 請求書データ作成
    const invoiceNumber = `${settings.invoicePrefix}${settings.nextInvoiceNumber.toString().padStart(4, '0')}`;
    const today = new Date().toISOString().split('T')[0];
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30); // デフォルト30日後

    const invoiceData: InvoiceData = {
        invoiceNumber,
        invoiceDate: today,
        clientName,
        subject: jobTitle,
        amount,
        paymentDeadline: deadline.toISOString().split('T')[0],
        includeTax,
        includeWithholding,
        taxAmount,
        withholdingAmount,
        totalAmount,
    };

    // PDF生成
    const doc = language === 'ja'
        ? generateJapaneseInvoice(invoiceData, settings)
        : generateInternationalInvoice(invoiceData, settings);

    // PDF保存
    try {
        const pdfBytes = doc.output('arraybuffer');
        const fileName = `invoice_${invoiceNumber}_${today}.pdf`;

        const savePath = await save({
            defaultPath: fileName,
            filters: [{
                name: 'PDF',
                extensions: ['pdf']
            }]
        });

        if (savePath) {
            await writeFile(savePath, new Uint8Array(pdfBytes));
            alert(`請求書を保存しました: ${fileName}`);

            // 次の請求書番号をインクリメント
            settings.nextInvoiceNumber++;
        }
    } catch (error) {
        console.error('PDF保存エラー:', error);
        alert('PDFの保存に失敗しました');
    }
}
