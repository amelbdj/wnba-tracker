import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isOptedOut, setOptedOut } from "../utils/analytics";

// The switch on the privacy page that stops audience measurement for this
// browser. It stores a flag in localStorage, which Umami's script checks
// before sending anything.
export default function AnalyticsOptOut() {
  const { t } = useTranslation();
  const [optedOut, setState] = useState(isOptedOut);

  function toggle() {
    const next = !optedOut;
    setOptedOut(next);
    setState(next);
  }

  return (
    <div className="analytics-optout">
      <p className="analytics-optout-status" role="status">
        <i className={`fa-solid ${optedOut ? "fa-eye-slash" : "fa-eye"}`}></i>{" "}
        {t(optedOut ? "privacy.optOut.statusOff" : "privacy.optOut.statusOn")}
      </p>
      <button type="button" className="btn btn-ghost" onClick={toggle}>
        {t(optedOut ? "privacy.optOut.enable" : "privacy.optOut.disable")}
      </button>
    </div>
  );
}
