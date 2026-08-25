import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "../i18n";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  function goTo(code) {
    setOpen(false);
    i18n.changeLanguage(code);
  }

  return (
    <div className="lang-switcher">
      <button
        className={`icon-btn lang-trigger${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
      >
        <span className="lang-code">{current.code.toUpperCase()}</span>
      </button>

      {open && (
        <>
          <div className="league-menu-backdrop" onClick={() => setOpen(false)}></div>
          <div className="league-menu lang-menu" role="listbox">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                className={`league-option${l.code === i18n.language ? " active" : ""}`}
                onClick={() => goTo(l.code)}
                role="option"
                aria-selected={l.code === i18n.language}
              >
                <span className="lang-code">{l.code.toUpperCase()}</span>
                {l.label}
                {l.code === i18n.language && <i className="fa-solid fa-check check"></i>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function MobileLangChip({ lang }) {
  const { i18n } = useTranslation();
  return (
    <button
      className={`chip${lang.code === i18n.language ? " active" : ""}`}
      onClick={() => i18n.changeLanguage(lang.code)}
    >
      {lang.label}
    </button>
  );
}
