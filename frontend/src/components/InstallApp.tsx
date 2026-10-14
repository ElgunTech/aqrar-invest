import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { useT } from "../lib/i18n";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "aqrar-install-dismissed";

function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function dismissedRecently() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY));
    return t > 0 && Date.now() - t < 7 * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * "Add to home screen" for phone visitors. Chrome/Edge/Samsung on Android: the browser's own install dialog
 * (beforeinstallprompt). iPhone/iPad Safari has no such API, so the button opens two-step instructions
 * (Share → Add to Home Screen). Hidden on desktop, when already installed, and for a week after "not now".
 */
export function InstallApp() {
  const { t } = useT();
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [help, setHelp] = useState(false);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const phone = window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 1024;
    if (!phone || standalone() || dismissedRecently()) return;
    setShow(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  const install = async () => {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setShow(false);
      setPrompt(null);
    } else {
      setHelp(true);
    }
  };
  const later = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* storage unavailable */ }
    setShow(false);
  };

  return (
    <>
      <div className="install-bar" role="region" aria-label={t("Tətbiq kimi quraşdır")}>
        <img src="/icons/icon-192.png" alt="" width={36} height={36} />
        <span><b>Aqrar İnvest</b><small>{t("Telefonun ana ekranına əlavə edin")}</small></span>
        <button className="btn btn--sm" onClick={install}><Download size={15} /> {t("Əlavə et")}</button>
        <button className="install-bar__close" onClick={later} aria-label={t("Sonra")}><X size={16} /></button>
      </div>
      {help && (
        <div className="install-help" role="dialog" aria-modal="true" aria-label={t("Ana ekrana əlavə et")} onClick={() => setHelp(false)}>
          <div className="install-help__card" onClick={(e) => e.stopPropagation()}>
            <img src="/icons/icon-192.png" alt="" width={56} height={56} />
            <h3>{t("Ana ekrana əlavə et")}</h3>
            {ios ? (
              <ol>
                <li><Share size={18} /> {t("Safari-nin aşağı panelində «Paylaş» düyməsinə toxunun")}</li>
                <li><SquarePlus size={18} /> {t("«Ana ekrana əlavə et» (Add to Home Screen) seçin, sonra «Əlavə et»")}</li>
              </ol>
            ) : (
              <ol>
                <li>⋮ {t("Brauzerin menyusunu açın (yuxarı sağda)")}</li>
                <li><SquarePlus size={18} /> {t("«Ana ekrana əlavə et» və ya «Tətbiqi quraşdır» seçin")}</li>
              </ol>
            )}
            <button className="btn btn--block" onClick={() => setHelp(false)}>{t("Aydındır")}</button>
          </div>
        </div>
      )}
    </>
  );
}
