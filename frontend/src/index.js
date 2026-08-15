import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { StarknetProvider } from "./providers/StarknetProvider";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <StarknetProvider>
    <App />
  </StarknetProvider>
);
