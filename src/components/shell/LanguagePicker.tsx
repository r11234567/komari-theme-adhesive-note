import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  setLanguage,
} from "@/i18n";

export function LanguagePicker() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLang =
    SUPPORTED_LANGUAGES.find((item) => item.code === i18n.language) ??
    SUPPORTED_LANGUAGES.find((item) => item.code === "en") ??
    SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="km-lang-picker">
      <button
        type="button"
        className="km-ui-button km-lang-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span aria-hidden="true">🌐</span>
        <span className="km-lang-current">{currentLang.label}</span>
        <span className="km-lang-arrow" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <ul className="km-lang-dropdown" role="listbox">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = lang.code === currentLang.code;
            return (
              <li
                key={lang.code}
                role="option"
                aria-selected={isSelected}
                className="km-lang-item"
                data-lang={lang.code}
                data-active={isSelected}
                onClick={() => {
                  setLanguage(lang.code as SupportedLanguage);
                  setOpen(false);
                }}
              >
                <span>{lang.label}</span>
                {isSelected && <span aria-hidden="true">✓</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
