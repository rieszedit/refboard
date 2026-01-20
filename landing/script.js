const translations = {
    en: {
        nav_features: "Features",
        nav_download: "Download",
        hero_title: "Focus on Creation.<br>Let us handle the rest.",
        hero_subtitle: "RefBoard is a minimalist reference board for creators. Track deadlines, organize resources, and simplify your workflow.",
        hero_cta: "Download for Windows",
        features_title: "Designed for focus.",
        features_subtitle: "Everything you need, nothing you don't.",
        feat_minimal_title: "Minimalist Dashboard",
        feat_minimal_desc: "Clean luxury aesthetic designed to stay out of your way while you work.",
        feat_canvas_title: "Infinite Canvas",
        feat_canvas_desc: "Independent reference board with 8-handle resizing and aspect ratio lock.",
        feat_invoice_title: "Global Invoicing",
        feat_invoice_desc: "Generate professional PDF invoices with multi-currency support (USD, EUR, GBP, JPY) and bilingual templates.",
        feat_autosave_title: "Auto-Save",
        feat_autosave_desc: "Never lose your settings or reference layouts. Changes are saved automatically.",
        feat_reminder_title: "Smart Reminders",
        feat_reminder_desc: "Discord and in-app notifications to keep your project deadlines on track.",
        feat_bilingual_title: "Bilingual",
        feat_bilingual_desc: "Full support for English and Japanese interfaces from the first launch.",
        cta_title: "Start your creative run.",
        cta_subtitle: "Simple, professional, and built for your workflow.",
        support_title: "Support Development",
        support_desc: "RefBoard is free and open source. Your support helps keep the project alive.",
        btn_kofi: "Buy me a Coffee",
        btn_github: "GitHub Sponsors"
    },
    ja: {
        nav_features: "機能",
        nav_download: "ダウンロード",
        hero_title: "創作に集中しよう。<br>面倒な管理はRefBoardへ。",
        hero_subtitle: "RefBoardはクリエイターのためのミニマリストなリファレンス管理ツールです。納期管理、資料整理、そしてワークフローの効率化を。",
        hero_cta: "Windows版をダウンロード",
        features_title: "没入するためのデザイン",
        features_subtitle: "必要なものだけを、最高の形で。",
        feat_minimal_title: "ミニマル・ダッシュボード",
        feat_minimal_desc: "作業の邪魔をしない、洗練されたラグジュアリーな美学。",
        feat_canvas_title: "無限キャンバス",
        feat_canvas_desc: "独立したリファレンスボード。8方向リサイズとアスペクト比固定に対応。",
        feat_invoice_title: "グローバル請求書作成",
        feat_invoice_desc: "マルチ通貨（USD/EUR/GBP/JPY）と日英バイリンガルテンプレートに対応。世界中のクライアントとの取引をスムーズに。",
        feat_autosave_title: "自動保存",
        feat_autosave_desc: "設定や配置を失う心配はありません。変更は自動的に保存されます。",
        feat_reminder_title: "スマート・リマインダー",
        feat_reminder_desc: "Discordとアプリ内通知で、プロジェクトの納期を確実に管理。",
        feat_bilingual_title: "バイリンガル",
        feat_bilingual_desc: "初回起動時から英語と日本語のUIを完全にサポート。",
        cta_title: "クリエイティブな「走り」を始めよう。",
        cta_subtitle: "シンプル、プロフェッショナル、そしてあなたのワークフローのために。",
        support_title: "開発を支援する",
        support_desc: "RefBoardはオープンソースで無料です。あなたの支援がプロジェクトの継続を助けます。",
        btn_kofi: "コーヒーを奢る (Ko-fi)",
        btn_github: "GitHub Sponsors"
    }
};

let currentLang = 'en';

document.getElementById('lang-toggle').addEventListener('click', () => {
    currentLang = currentLang === 'en' ? 'ja' : 'en';
    updateLanguage();
});

function updateLanguage() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            el.innerHTML = translations[currentLang][key];
        }
    });

    const btn = document.getElementById('lang-toggle');
    btn.querySelector('.lang-text').textContent = currentLang === 'en' ? 'JP' : 'EN';
}

// Initial update not needed as HTML is EN by default
