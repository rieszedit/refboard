import { useCallback } from "react";
import { t, type Language } from "../utils/i18n";

interface DiscordEmbedField {
    name: string;
    value: string;
    inline?: boolean;
}

interface DiscordEmbed {
    title: string;
    description?: string;
    color: number;
    fields?: DiscordEmbedField[];
    timestamp?: string;
    footer?: {
        text: string;
    };
}

export function useDiscord(webhookUrl: string) {
    const sendToDiscord = useCallback(
        async (content: string, jobTitle?: string, deadline?: string, daysRemaining?: number, language: Language = "en") => {
            if (!webhookUrl || !content.trim()) return;

            try {
                let payload: any;

                // Rich embed if job details provided
                if (jobTitle && deadline) {
                    const deadlineDate = new Date(deadline);
                    const urgencyColor =
                        daysRemaining === undefined || daysRemaining < 0 ? 0xef4444 : // Red - Expired
                            daysRemaining === 0 ? 0xf59e0b : // Orange - Today
                                daysRemaining <= 1 ? 0xfbbf24 : // Yellow - 1 day
                                    daysRemaining <= 3 ? 0xa5b4fc : // Light blue - 3 days
                                        0x10b981; // Green - More time

                    const urgencyEmoji =
                        daysRemaining === undefined || daysRemaining < 0 ? "🚨" :
                            daysRemaining === 0 ? "🔥" :
                                daysRemaining <= 1 ? "⚠️" :
                                    daysRemaining <= 3 ? "📌" : "✅";

                    const statusText =
                        daysRemaining === undefined || daysRemaining < 0 ? `**${t(language, "discordExpired")}**` :
                            daysRemaining === 0 ? `**${t(language, "discordDueToday")}**` :
                                daysRemaining === 1 ? `**${t(language, "discordDueTomorrow")}**` :
                                    t(language, "discordDueInDays", { days: daysRemaining.toString() });

                    const embed: DiscordEmbed = {
                        title: `${urgencyEmoji} ${jobTitle}`,
                        description: `**${t(language, "discordStatus")}:** ${statusText}`,
                        color: urgencyColor,
                        fields: [
                            {
                                name: `📅 ${t(language, "discordDeadline")}`,
                                value: `\`${deadlineDate.toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US', {
                                    month: language === 'ja' ? 'long' : 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}\``,
                                inline: true
                            },
                            {
                                name: `⏰ ${t(language, "discordRemaining")}`,
                                value: daysRemaining === undefined || daysRemaining < 0
                                    ? `~~${t(language, "discordOverdue")}~~`
                                    : daysRemaining === 0
                                        ? `**${t(language, "discordToday")}**`
                                        : `**${t(language, "discordDaysRemaining", { days: daysRemaining.toString(), plural: daysRemaining !== 1 ? 's' : '' })}**`,
                                inline: true
                            }
                        ],
                        timestamp: new Date().toISOString(),
                        footer: {
                            text: "RefBoard Reminder"
                        }
                    };

                    payload = { embeds: [embed] };
                } else {
                    // Fallback to simple content
                    payload = { content };
                }

                const response = await fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    throw new Error(`送信失敗: ${response.status}`);
                }

                if (import.meta.env.DEV) {
                    console.log("Discord通知送信:", jobTitle || content);
                }
            } catch (e) {
                console.error("Discord送信エラー:", e);
            }
        },
        [webhookUrl]
    );

    return { sendToDiscord };
}
