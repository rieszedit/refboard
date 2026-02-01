import { useState } from 'react';
import type { InvoiceSettings } from '../types/invoice';
import { t, type Language } from '../utils/i18n';
import type { Job } from '../types';
import { generateJapaneseInvoice, generateInternationalInvoice, calculateInvoiceTotal } from '../utils/invoiceGenerator';
import type { InvoiceData, InvoiceLanguage } from '../types/invoice';
import { writeFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

registerLocale('ja', ja);


interface InvoiceGenerationModalProps {
    job: Job;
    settings: InvoiceSettings;
    language: Language;
    onClose: () => void;
    onGenerated: (invoiceNumber: string, invoiceDate: string) => void;
}

export function InvoiceGenerationModal({
    job,
    settings,
    language,
    onClose,
    onGenerated
}: InvoiceGenerationModalProps) {
    const [clientName, setClientName] = useState(job.title);
    const [subject, setSubject] = useState(job.title);
    const [amount, setAmount] = useState('');
    const [paymentDeadline, setPaymentDeadline] = useState<Date>(() => {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
    });
    const [includeTax, setIncludeTax] = useState(true);
    const [includeWithholding, setIncludeWithholding] = useState(false);
    const [invoiceLanguage, setInvoiceLanguage] = useState<InvoiceLanguage>(language === 'ja' ? 'ja' : 'en');
    const [isGenerating, setIsGenerating] = useState(false);

    const amountNum = parseInt(amount.replace(/,/g, ''), 10) || 0;
    const { taxAmount, withholdingAmount, totalAmount } = calculateInvoiceTotal(
        amountNum,
        includeTax,
        includeWithholding
    );

    const handleGenerate = async () => {
        if (!amountNum || amountNum <= 0) {
            alert(t(language, 'amount') + ' is required');
            return;
        }

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
                paymentDeadline: paymentDeadline.toISOString().split('T')[0],
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
                filters: [{
                    name: 'PDF',
                    extensions: ['pdf']
                }]
            });

            if (savePath) {
                await writeFile(savePath, new Uint8Array(pdfBytes));
                onGenerated(invoiceNumber, today);
                onClose();
            }
        } catch (error) {
            console.error('PDF generation error:', error);
            alert('Failed to generate invoice');
        } finally {
            setIsGenerating(false);
        }
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
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: '480px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '24px',
                }}
            >
                <h2 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>📄</span>
                    {t(language, 'generateInvoice')}
                </h2>

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
                        <span style={{
                            position: 'absolute',
                            left: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-sub)',
                            fontSize: '14px',
                        }}>¥</span>
                        <input
                            type="text"
                            value={amount}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^\d]/g, '');
                                setAmount(val ? parseInt(val, 10).toLocaleString() : '');
                            }}
                            placeholder="130,000"
                            style={{ ...inputStyle, paddingLeft: '28px' }}
                        />
                    </div>
                </div>

                {/* Payment Deadline - Fixed */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>{t(language, 'paymentDeadline')}</label>
                    <DatePicker
                        selected={paymentDeadline}
                        onChange={(date: Date | null) => {
                            if (date) {
                                setPaymentDeadline(date);
                            }
                        }}
                        locale={language === 'ja' ? 'ja' : undefined}
                        dateFormat={language === 'ja' ? "yyyy/MM/dd" : "yyyy-MM-dd"}
                        customInput={
                            <input
                                className="datepicker-input"
                                style={{ ...inputStyle, width: '100%', cursor: 'pointer', display: 'block' }}
                            />
                        }
                    />
                </div>

                {/* Tax Options */}
                <div style={{
                    display: 'flex',
                    gap: '20px',
                    marginBottom: '16px',
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        fontSize: '13px',
                        gap: '8px',
                    }}>
                        <input
                            type="checkbox"
                            checked={includeTax}
                            onChange={(e) => setIncludeTax(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                        />
                        {t(language, 'includeTax')}
                    </label>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        fontSize: '13px',
                        gap: '8px',
                    }}>
                        <input
                            type="checkbox"
                            checked={includeWithholding}
                            onChange={(e) => setIncludeWithholding(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                        />
                        {t(language, 'includeWithholding')}
                    </label>
                </div>

                {/* Language */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>{t(language, 'invoiceLanguage')}</label>
                    <select
                        value={invoiceLanguage}
                        onChange={(e) => setInvoiceLanguage(e.target.value as InvoiceLanguage)}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                        <option value="ja">{t(language, 'japanese')}</option>
                        <option value="en">{t(language, 'english')}</option>
                    </select>
                </div>

                {/* Summary */}
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    padding: '16px',
                    borderRadius: '10px',
                    marginBottom: '20px',
                    border: '1px solid var(--border)',
                }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-sub)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {t(language, 'summary')}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-sub)' }}>{t(language, 'subtotal')}</span>
                        <span>¥{amountNum.toLocaleString()}</span>
                    </div>

                    {includeTax && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                            <span style={{ color: 'var(--text-sub)' }}>{settings.taxLabel || "Tax"} ({settings.taxRate ?? 10}%)</span>
                            <span style={{ color: '#4ade80' }}>+¥{taxAmount.toLocaleString()}</span>
                        </div>
                    )}

                    {includeWithholding && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                            <span style={{ color: 'var(--text-sub)' }}>Withholding ({settings.withholdingRate ?? 10.21}%)</span>
                            <span style={{ color: '#f87171' }}>-¥{withholdingAmount.toLocaleString()}</span>
                        </div>
                    )}

                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border)',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }}>
                        <span>{t(language, 'total')}</span>
                        <span style={{ color: 'var(--accent)' }}>¥{totalAmount.toLocaleString()}</span>
                    </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '12px' }}>
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
                        }}
                    >
                        {t(language, 'cancel')}
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !amountNum}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: amountNum ? 'var(--accent)' : 'var(--bg-secondary)',
                            border: 'none',
                            borderRadius: '8px',
                            color: amountNum ? '#000' : 'var(--text-sub)',
                            cursor: amountNum ? 'pointer' : 'not-allowed',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                        }}
                    >
                        {isGenerating ? (
                            <>{t(language, 'generating')}</>
                        ) : (
                            <>
                                <span>📄</span>
                                {t(language, 'downloadPDF')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
