import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ReferenceBoard from "./ReferenceBoard";
import "./styles/index.css";

// URLパラメータでウィンドウタイプを判定
const params = new URLSearchParams(window.location.search);
const windowType = params.get("window");

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        {windowType === "reference" ? <ReferenceBoard /> : <App />}
    </React.StrictMode>
);
