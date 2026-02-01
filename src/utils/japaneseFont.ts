/**
 * 日本語フォントローダー for jsPDF
 * 
 * 使用方法:
 * 1. Google Fonts から Noto Sans JP Regular をダウンロード
 *    https://fonts.google.com/noto/specimen/Noto+Sans+JP
 * 
 * 2. TTFファイルをBase64に変換:
 *    - オンラインツール: https://base64.guru/converter/encode/file
 *    - またはNode.js: fs.readFileSync('NotoSansJP-Regular.ttf').toString('base64')
 * 
 * 3. 変換したBase64文字列を下の NOTO_SANS_JP_BASE64 に設定
 * 
 * 4. invoiceGenerator.ts で loadJapaneseFont(doc) を呼び出す
 */

import jsPDF from 'jspdf';

// 日本語フォントのBase64文字列（ユーザーが設定）
// 注意: 実際のフォントデータは数MB以上になります
let NOTO_SANS_JP_BASE64: string | null = null;
let fontLoaded = false;

/**
 * フォントデータを設定
 */
export function setJapaneseFontData(base64Data: string): void {
    NOTO_SANS_JP_BASE64 = base64Data;
    fontLoaded = false;
}

/**
 * 日本語フォントをjsPDFドキュメントに読み込む
 */
export function loadJapaneseFont(doc: jsPDF): boolean {
    if (!NOTO_SANS_JP_BASE64) {
        console.warn('Japanese font not configured. Using default font.');
        return false;
    }

    try {
        // フォントファイルを仮想ファイルシステムに追加
        doc.addFileToVFS('NotoSansJP-Regular.ttf', NOTO_SANS_JP_BASE64);

        // フォントを追加
        doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');

        // フォントを使用
        doc.setFont('NotoSansJP', 'normal');

        fontLoaded = true;
        return true;
    } catch (error) {
        console.error('Failed to load Japanese font:', error);
        return false;
    }
}

/**
 * フォントが読み込まれているか確認
 */
export function isJapaneseFontLoaded(): boolean {
    return fontLoaded && NOTO_SANS_JP_BASE64 !== null;
}
