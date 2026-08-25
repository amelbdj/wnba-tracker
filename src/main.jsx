import ReactDOM from "react-dom/client";
import "./style.css";
import "./i18n";
import App from "./App";

import { BrowserRouter } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
