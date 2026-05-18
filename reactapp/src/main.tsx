import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import DocsPage from "./DocsPage";
import { ColorModeProvider } from "./context/colorMode";
import './index.css';
import "./styles/theme.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ColorModeProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </ColorModeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
