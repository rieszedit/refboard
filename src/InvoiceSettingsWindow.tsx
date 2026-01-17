import { useState, useEffect } from 'react';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen, emit } from '@tauri-apps/api/event';
import { t, type Language } from './utils/i18n';
import type { InvoiceSettings } from './types/invoice';
import './styles/App.css';
import './styles/ReferenceBoard.css';

interface InvoiceSettingsWindowProps {
    theme: 'light' | 'dark';
    language: Language;
}

export function InvoiceSettingsWindow({ theme: initialTheme, language: initialLanguage }: InvoiceSettingsWindowProps) {
    const [settings, setSettings] = useState<InvoiceSettings | null>(null);
    const [theme, setTheme] = useState(initialTheme);
    const [language, setLanguage] = useState(initialLanguage);
    const [isPinned, setIsPinned] = useState(false);

    // Sync theme with body/html
    useEffect(() => {
        const themeValue = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', themeValue);
        document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
        document.body.style.backgroundColor = theme === 'dark' ? '#1a1a1a' : '#ffffff';
    }, [theme]);

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

        // Request initial settings data
        emit('invoice-settings-request-data');

        // Listen for settings data response
        const unlistenData = listen<{ settings: InvoiceSettings }>('invoice-settings-data', (event) => {
            setSettings(event.payload.settings);
        });

        return () => {
            unlistenTheme.then(fn => fn());
            unlistenLang.then(fn => fn());
            unlistenData.then(fn => fn());
        };

    }, []);

    // Auto-save logic with debounce
    useEffect(() => {
        if (!settings) return;

        const timer = setTimeout(() => {
            emit('invoice-settings-save', settings);
        }, 500);

        return () => clearTimeout(timer);
    }, [settings]);

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
        transition: 'border-color 0.2s',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        marginBottom: '6px',
        fontSize: '11px',
        color: 'var(--text-sub)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    };

    const sectionStyle: React.CSSProperties = {
        marginBottom: '24px',
        padding: '16px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
    };

    const sectionTitleStyle: React.CSSProperties = {
        fontSize: '13px',
        fontWeight: 'bold',
        marginBottom: '16px',
        color: 'var(--text-main)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    };

    const rowStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginBottom: '12px',
    };

    const isJapanese = language === 'ja';

    return (
        <div className={`app ${theme === 'dark' ? 'dark-theme' : 'light-theme'}`} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
            {/* Title Bar */}
            <div
                className="custom-titlebar"
                data-tauri-drag-region
                style={{
                    height: '40px',
                    position: 'relative',
                    padding: '0 12px',
                    background: 'var(--bg-primary)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <div className="titlebar-info" data-tauri-drag-region style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span data-tauri-drag-region style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 'bold', pointerEvents: 'none' }}>
                        {t(language, 'invoiceSettings')}
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
                        Loading...
                    </div>
                ) : (
                    <>
                        {/* 事業者情報セクション */}
                        <div style={sectionStyle}>
                            <div style={sectionTitleStyle}>
                                <span>{t(language, 'businessInfo')}</span>
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                                <label style={labelStyle}>{t(language, 'businessName')}</label>
                                <input
                                    type="text"
                                    value={isJapanese ? settings.businessName : (settings.businessNameEn || '')}
                                    onChange={(e) => setSettings(isJapanese
                                        ? { ...settings, businessName: e.target.value }
                                        : { ...settings, businessNameEn: e.target.value } as InvoiceSettings
                                    )}
                                    placeholder={isJapanese ? "株式会社サンプル" : "Sample Inc."}
                                    style={inputStyle}
                                />
                            </div>

                            <div style={rowStyle}>
                                <div>
                                    <label style={labelStyle}>{t(language, 'postalCode')}</label>
                                    <input
                                        type="text"
                                        value={settings.postalCode}
                                        onChange={(e) => setSettings({ ...settings, postalCode: e.target.value })}
                                        placeholder="123-4567"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>{t(language, 'phone')}</label>
                                    <input
                                        type="text"
                                        value={settings.phone}
                                        onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                                        placeholder="03-1234-5678"
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                                <label style={labelStyle}>{t(language, 'address')}</label>
                                <input
                                    type="text"
                                    value={isJapanese ? settings.address : (settings.addressEn || '')}
                                    onChange={(e) => setSettings(isJapanese
                                        ? { ...settings, address: e.target.value }
                                        : { ...settings, addressEn: e.target.value } as InvoiceSettings
                                    )}
                                    placeholder={isJapanese ? "東京都渋谷区..." : "Shibuya-ku, Tokyo..."}
                                    style={inputStyle}
                                />
                            </div>

                            <div>
                                <label style={labelStyle}>Email</label>
                                <input
                                    type="email"
                                    value={settings.email || ''}
                                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                                    placeholder="contact@example.com"
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {/* 振込先情報セクション */}
                        <div style={sectionStyle}>
                            <div style={sectionTitleStyle}>
                                <span>{t(language, 'bankInfo')}</span>
                            </div>

                            <div style={rowStyle}>
                                <div>
                                    <label style={labelStyle}>{t(language, 'bankName')}</label>
                                    <input
                                        type="text"
                                        value={isJapanese ? settings.bankName : (settings.bankNameEn || '')}
                                        onChange={(e) => setSettings(isJapanese
                                            ? { ...settings, bankName: e.target.value }
                                            : { ...settings, bankNameEn: e.target.value } as InvoiceSettings
                                        )}
                                        placeholder={isJapanese ? "三菱UFJ銀行" : "MUFG Bank"}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>{t(language, 'branchName')}</label>
                                    <input
                                        type="text"
                                        value={isJapanese ? settings.branchName : (settings.branchNameEn || '')}
                                        onChange={(e) => setSettings(isJapanese
                                            ? { ...settings, branchName: e.target.value }
                                            : { ...settings, branchNameEn: e.target.value } as InvoiceSettings
                                        )}
                                        placeholder={isJapanese ? "渋谷支店" : "Shibuya Branch"}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={rowStyle}>
                                <div>
                                    <label style={labelStyle}>{t(language, 'accountType')}</label>
                                    <select
                                        value={settings.accountType}
                                        onChange={(e) => setSettings({ ...settings, accountType: e.target.value as 'savings' | 'checking' })}
                                        style={{ ...inputStyle, cursor: 'pointer' }}
                                    >
                                        <option value="savings">{isJapanese ? '普通' : 'Savings'}</option>
                                        <option value="checking">{isJapanese ? '当座' : 'Checking'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>{t(language, 'accountNumber')}</label>
                                    <input
                                        type="text"
                                        value={settings.accountNumber}
                                        onChange={(e) => setSettings({ ...settings, accountNumber: e.target.value })}
                                        placeholder="1234567"
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>{t(language, 'accountHolder')}</label>
                                <input
                                    type="text"
                                    value={isJapanese ? settings.accountHolder : (settings.accountHolderEn || '')}
                                    onChange={(e) => setSettings(isJapanese
                                        ? { ...settings, accountHolder: e.target.value }
                                        : { ...settings, accountHolderEn: e.target.value } as InvoiceSettings
                                    )}
                                    placeholder={isJapanese ? "ヤマダ タロウ" : "Taro Yamada"}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {/* インボイス設定セクション */}
                        <div style={sectionStyle}>
                            <div style={sectionTitleStyle}>
                                <span>{t(language, 'invoiceDefaults')}</span>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    gap: '10px',
                                    color: 'var(--text-main)',
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={settings.hasInvoiceRegistration}
                                        onChange={(e) => setSettings({ ...settings, hasInvoiceRegistration: e.target.checked })}
                                        style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                                    />
                                    {t(language, 'hasInvoiceRegistration')}
                                </label>
                            </div>

                            {settings.hasInvoiceRegistration && (
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={labelStyle}>{t(language, 'invoiceRegistrationNumber')}</label>
                                    <input
                                        type="text"
                                        value={settings.invoiceRegistrationNumber || ''}
                                        onChange={(e) => setSettings({ ...settings, invoiceRegistrationNumber: e.target.value })}
                                        placeholder="T1234567890123"
                                        style={inputStyle}
                                    />
                                </div>
                            )}

                            <div style={rowStyle}>
                                <div>
                                    <label style={labelStyle}>{t(language, 'invoicePrefix')}</label>
                                    <input
                                        type="text"
                                        value={settings.invoicePrefix}
                                        onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
                                        placeholder="INV-"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>{t(language, 'nextInvoiceNumber')}</label>
                                    <input
                                        type="number"
                                        value={settings.nextInvoiceNumber}
                                        onChange={(e) => setSettings({ ...settings, nextInvoiceNumber: parseInt(e.target.value) || 1 })}
                                        min={1}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ボタン */}
                        {/* フッター */}
                        <div style={{
                            marginTop: '20px',
                            paddingTop: '20px',
                            borderTop: '1px solid var(--border)',
                            position: 'sticky',
                            bottom: '-20px',
                            background: 'var(--bg-primary)',
                            paddingBottom: '20px',
                            zIndex: 10,
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-sub)' }}>
                                {isJapanese ? "設定は自動保存されます" : "Changes are saved automatically"}
                            </span>
                            <button
                                onClick={closeWindow}
                                style={{
                                    padding: '8px 24px',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    color: 'var(--text-main)',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {isJapanese ? "閉じる" : "Close"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
