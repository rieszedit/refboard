import { useState } from 'react';
import type { InvoiceSettings } from '../types/invoice';
import { t, type Language } from '../utils/i18n';

interface InvoiceSettingsModalProps {
    settings: InvoiceSettings;
    language: Language;
    onSave: (settings: InvoiceSettings) => void;
    onClose: () => void;
}

export function InvoiceSettingsModal({
    settings: initialSettings,
    language,
    onSave,
    onClose
}: InvoiceSettingsModalProps) {
    const [settings, setSettings] = useState<InvoiceSettings>(initialSettings);
    const isJapanese = language === 'ja';

    const handleSave = () => {
        onSave(settings);
        onClose();
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 12px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        color: 'var(--text-primary)',
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
        color: 'var(--text-primary)',
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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: '500px',
                    maxHeight: '85vh',
                    overflowY: 'auto',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '24px',
                }}
            >
                <h2 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                    {t(language, 'invoiceSettings')}
                </h2>

                {/* 事業者情報セクション */}
                <div style={sectionStyle}>
                    <div style={sectionTitleStyle}>
                        <span>🏢</span>
                        <span>{t(language, 'businessInfo')}</span>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={labelStyle}>{t(language, 'businessName')}</label>
                        <input
                            type="text"
                            value={isJapanese ? settings.businessName : (settings.businessNameEn || '')}
                            onChange={(e) => setSettings(isJapanese
                                ? { ...settings, businessName: e.target.value }
                                : { ...settings, businessNameEn: e.target.value }
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
                                : { ...settings, addressEn: e.target.value }
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
                        <span>🏦</span>
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
                                    : { ...settings, bankNameEn: e.target.value }
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
                                    : { ...settings, branchNameEn: e.target.value }
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
                                : { ...settings, accountHolderEn: e.target.value }
                            )}
                            placeholder={isJapanese ? "ヤマダ タロウ" : "Taro Yamada"}
                            style={inputStyle}
                        />
                    </div>
                </div>

                {/* インボイス設定セクション */}
                <div style={sectionStyle}>
                    <div style={sectionTitleStyle}>
                        <span>📄</span>
                        <span>{t(language, 'invoiceDefaults')}</span>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            fontSize: '13px',
                            gap: '10px',
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
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                            transition: 'all 0.2s',
                        }}
                    >
                        {t(language, 'cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: 'var(--accent)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#000',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s',
                        }}
                    >
                        {t(language, 'save')}
                    </button>
                </div>
            </div>
        </div>
    );
}
