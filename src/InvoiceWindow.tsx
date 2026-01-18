import { useState, useEffect } from 'react';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen, emit } from '@tauri-apps/api/event';
import { t, type Language } from './utils/i18n';
import { generateJapaneseInvoice, generateInternationalInvoice, calculateInvoiceTotal, getCurrencySymbol, formatAmount } from './utils/invoiceGenerator';
import type { InvoiceData, InvoiceLanguage, InvoiceSettings } from './types/invoice';
import { writeFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import './styles/App.css';
import './styles/ReferenceBoard.css';
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

// Register Japanese locale
registerLocale('ja', ja);

interface InvoiceWindowProps {
    jobId: string;
    jobTitle: string;
    theme: 'dark' | 'light';
    language: Language;
}

export function InvoiceWindow({ jobId, jobTitle, theme: initialTheme, language: initialLanguage }: InvoiceWindowProps) {
    const [settings, setSettings] = useState<InvoiceSettings | null>(null);
    const [theme, setTheme] = useState(initialTheme);
    const [language, setLanguage] = useState(initialLanguage);
    const [clientName, setClientName] = useState(jobTitle);
    const [subject, setSubject] = useState(jobTitle);
    const [amount, setAmount] = useState('');
    const [paymentDeadline, setPaymentDeadline] = useState<string>(() => {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date.toISOString().split('T')[0];
    });
    const [includeTax, setIncludeTax] = useState(true);
    const [includeWithholding, setIncludeWithholding] = useState(false);
    const [invoiceLanguage, setInvoiceLanguage] = useState<InvoiceLanguage>(initialLanguage === 'ja' ? 'ja' : 'en');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPinned, setIsPinned] = useState(false);

    // Listen for global setting changes
    useEffect(() => {
        const unlistenTheme = listen<{ theme: 'dark' | 'light' }>('theme-changed', (event) => {
            if (event.payload.theme === 'dark' || event.payload.theme === 'light') {
                setTheme(event.payload.theme);
            }
        });
        const unlistenLang = listen<{ language: Language }>('language-changed', (event) => {
            setLanguage(event.payload.language);
        });

        return () => {
            unlistenTheme.then(fn => fn());
            unlistenLang.then(fn => fn());
        };
    }, []);



    const amountNum = parseInt(amount.replace(/,/g, ''), 10) || 0;
    const { taxAmount, withholdingAmount, totalAmount } = calculateInvoiceTotal(
        amountNum,
        includeTax,
        includeWithholding,
        settings?.taxRate ?? 10,
        settings?.withholdingRate ?? 10.21
    );

    // Listen for settings from main window
    useEffect(() => {
        const unlistenSettings = listen<{ settings: InvoiceSettings }>('invoice-settings-data', (event) => {
            setSettings(event.payload.settings);
        });

        // Request settings from main window
        emit('invoice-request-settings', { jobId });

        return () => {
            unlistenSettings.then(fn => fn());
        };
    }, [jobId]);

    // Sync theme with body for portaled elements
    useEffect(() => {
        const themeValue = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', themeValue);
        document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
        document.body.style.backgroundColor = theme === 'dark' ? '#1a1a1a' : '#ffffff';
    }, [theme]);

    const handleGenerate = async () => {
        if (!settings || !amountNum || amountNum <= 0) return;

        setIsGenerating(true);

        try {
            const invoiceNumber = `${settings.invoicePrefix}${settings.nextInvoiceNumber.toString().padStart(4, '0')}`;
            const today = new Date().toISOString().split('T')[0];

            const invoiceData: InvoiceData = {
                invoiceNumber,
                invoiceDate: today,
                clientName,
                subject,
                amount: amountNum,
                paymentDeadline,
                includeTax,
                includeWithholding,
                taxAmount,
                withholdingAmount,
                totalAmount,
            };

            const doc = invoiceLanguage === 'ja'
                ? await generateJapaneseInvoice(invoiceData, settings)
                : await generateInternationalInvoice(invoiceData, settings);

            const pdfBytes = doc.output('arraybuffer');
            const fileName = `invoice_${invoiceNumber}_${today}.pdf`;

            const savePath = await save({
                defaultPath: fileName,
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });

            if (savePath) {
                await writeFile(savePath, new Uint8Array(pdfBytes));
                // Notify main window
                emit('invoice-generated', {
                    jobId,
                    invoiceNumber,
                    invoiceDate: today,
                    nextNumber: settings.nextInvoiceNumber + 1
                });
            }
        } catch (error) {
            console.error('PDF generation error:', error);
            alert('Failed to generate invoice');
        } finally {
            setIsGenerating(false);
        }
    };

    const togglePin = async () => {
        const win = getCurrentWebviewWindow();
        const newState = !isPinned;
        setIsPinned(newState);
        await win.setAlwaysOnTop(newState);
    };

    const closeWindow = async () => {
        const win = getCurrentWebviewWindow();
        const main = await WebviewWindow.getByLabel('main');
        if (main) {
            await main.setFocus();
        }
        await win.close();
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 12px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        color: 'var(--text-main)',
        fontSize: '13px',
        outline: 'none',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        marginBottom: '6px',
        fontSize: '11px',
        color: 'var(--text-sub)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    };

    return (
        <div className={`app ${theme === 'dark' ? 'dark-theme' : 'light-theme'}`} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
            {/* Custom Title Bar matching ReferenceBoard */}
            <div
                className="custom-titlebar"
                data-tauri-drag-region
                style={{
                    height: '40px',
                    position: 'relative', // Override fixed positioning
                    padding: '0 12px',
                    background: 'var(--bg-primary)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <div className="titlebar-info" data-tauri-drag-region style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ // Keeping the custom document icon as requested
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-primary)',
                        opacity: 0.9,
                        pointerEvents: 'none'
                    }}>
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="5" ry="5"></rect>
                            <path d="M9 17h6"></path>
                            <path d="M9 13h6"></path>
                            <path d="M9 9h6"></path>
                        </svg>
                    </div>
                    <span data-tauri-drag-region style={{ fontSize: '12px', color: 'var(--text-sub)', pointerEvents: 'none' }}>
                        {t(language, 'generateInvoice')} - <span style={{ color: 'var(--text-primary)' }}>{jobTitle}</span>
                    </span>
                </div>

                <div className="titlebar-controls" style={{ display: 'flex', gap: '4px' }}>
                    <button
                        className={`titlebar-btn pin ${isPinned ? 'active' : ''}`}
                        onClick={togglePin}
                        title="Always on Top"
                        style={{
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: '4px'
                        }}
                    >
                        <svg viewBox="0 0 24 24" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" width="14" height="14">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </button>
                    <button
                        className="titlebar-btn close"
                        onClick={closeWindow}
                        style={{
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: '4px'
                        }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                {!settings ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-sub)', padding: '40px' }}>
                        {t(language, 'configureInvoice')}
                    </div>
                ) : (
                    <>
                        {/* Client Name */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={labelStyle}>{t(language, 'clientName')}</label>
                            <input
                                type="text"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                style={inputStyle}
                            />
                        </div>

                        {/* Subject */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={labelStyle}>{t(language, 'subject')}</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                style={inputStyle}
                            />
                        </div>

                        {/* Amount */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={labelStyle}>{t(language, 'amount')}</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }}>{getCurrencySymbol(settings?.currency)}</span>
                                <input
                                    type="text"
                                    value={amount}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^\d]/g, '');
                                        setAmount(val ? formatAmount(parseInt(val, 10), settings?.currency) : '');
                                    }}
                                    placeholder="130,000"
                                    style={{ ...inputStyle, paddingLeft: '28px' }}
                                />
                            </div>
                        </div>

                        {/* Payment Deadline */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={labelStyle}>{t(language, 'paymentDeadline')}</label>
                            <DatePicker
                                selected={paymentDeadline ? new Date(paymentDeadline) : null}
                                onChange={(date: Date | null) => {
                                    if (date) {
                                        const offset = date.getTimezoneOffset();
                                        const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
                                        setPaymentDeadline(adjustedDate.toISOString().split('T')[0]);
                                    } else {
                                        setPaymentDeadline('');
                                    }
                                }}
                                locale={language === 'ja' ? 'ja' : undefined}
                                dateFormat={language === 'ja' ? "yyyy/MM/dd" : "yyyy-MM-dd"}
                                className="datepicker-input"
                                wrapperClassName="datepicker-wrapper"
                            />
                        </div>

                        {/* Tax Options */}
                        <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', gap: '8px' }}>
                                <input type="checkbox" checked={includeTax} onChange={(e) => setIncludeTax(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }} />
                                {settings?.taxLabel || t(language, 'taxLabel')} ({settings?.taxRate ?? 10}%)
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', gap: '8px' }}>
                                <input type="checkbox" checked={includeWithholding} onChange={(e) => setIncludeWithholding(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }} />
                                {language === 'ja' ? '源泉徴収' : 'Withholding Tax'} ({settings?.withholdingRate ?? 10.21}%)
                            </label>
                        </div>

                        {/* Language */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>{t(language, 'invoiceLanguage')}</label>
                            <select value={invoiceLanguage} onChange={(e) => setInvoiceLanguage(e.target.value as InvoiceLanguage)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                <option value="ja">{t(language, 'japanese')}</option>
                                <option value="en">{t(language, 'english')}</option>
                            </select>
                        </div>

                        {/* Summary */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-sub)', marginBottom: '12px', textTransform: 'uppercase' }}>{t(language, 'summary')}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                <span style={{ color: 'var(--text-sub)' }}>{t(language, 'subtotal')}</span>
                                <span>{getCurrencySymbol(settings?.currency)}{formatAmount(amountNum, settings?.currency)}</span>
                            </div>
                            {includeTax && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-sub)' }}>{settings?.taxLabel || "Tax"} ({settings?.taxRate ?? 10}%)</span>
                                    <span style={{ color: '#4ade80' }}>+{getCurrencySymbol(settings?.currency)}{formatAmount(taxAmount, settings?.currency)}</span>
                                </div>
                            )}
                            {includeWithholding && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-sub)' }}>Withholding ({settings?.withholdingRate ?? 10.21}%)</span>
                                    <span style={{ color: '#f87171' }}>-{getCurrencySymbol(settings?.currency)}{formatAmount(withholdingAmount, settings?.currency)}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', fontSize: '16px', fontWeight: 'bold' }}>
                                <span>{t(language, 'total')}</span>
                                <span style={{ color: 'var(--accent)' }}>{getCurrencySymbol(settings?.currency)}{formatAmount(totalAmount, settings?.currency)}</span>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !amountNum}
                            style={{
                                width: '100%',
                                padding: '14px',
                                background: amountNum ? 'var(--accent)' : 'var(--bg-secondary)',
                                border: 'none',
                                borderRadius: '8px',
                                color: amountNum ? '#fff' : 'var(--text-sub)',
                                cursor: amountNum ? 'pointer' : 'not-allowed',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                            }}
                        >
                            {isGenerating ? t(language, 'generating') : t(language, 'downloadPDF')}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
