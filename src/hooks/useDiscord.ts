import { useCallback } from "react";

export function useDiscord(webhookUrl: string) {
    const sendToDiscord = useCallback(
        async (content: string) => {
            if (!webhookUrl || !content.trim()) return;

            try {
                const response = await fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content }),
                });

                if (!response.ok) {
                    throw new Error(`送信失敗: ${response.status}`);
                }
                console.log("Discord通知送信:", content);
            } catch (e) {
                console.error("Discord送信エラー:", e);
            }
        },
        [webhookUrl]
    );

    return { sendToDiscord };
}
