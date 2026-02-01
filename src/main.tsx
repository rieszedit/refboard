import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ReferenceBoard from "./ReferenceBoard";
import { InvoiceSettingsWindow } from "./InvoiceSettingsWindow";
import { InvoiceWindow } from "./InvoiceWindow";
import "./styles/index.css";
import type { Language } from "./utils/i18n";

// URLパラメータでウィンドウタイプを判定
const params = new URLSearchParams(window.location.search);
const windowType = params.get("window");

function getWindowComponent() {
    switch (windowType) {
        case "reference":
            return <ReferenceBoard />;
        case "invoice":
            return (
                <InvoiceWindow
                    jobId={params.get("id") || ""}
                    jobTitle={decodeURIComponent(params.get("title") || "")}
                    theme={(params.get("theme") as "dark" | "light") || "dark"}
                    language={(params.get("lang") as Language) || "ja"}
                />
            );
        case "invoice-settings":
            return (
                <InvoiceSettingsWindow
                    theme={(params.get("theme") as "dark" | "light") || "dark"}
                    language={(params.get("lang") as Language) || "ja"}
                />
            );
        default:
            return <App />;
    }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        {getWindowComponent()}
    </React.StrictMode>
);
