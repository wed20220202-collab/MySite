const ANSWER_KEY = "sendagiChankoSurveyAnswered2026";
const ANSWER_COOKIE = "sendagi_chanko_answered_2026";
const GIFT_KEY = "sendagiChankoWallpaperChoice2026";
const GIFT_COOKIE = "sendagi_chanko_wallpaper_2026";

const WALLPAPERS = {
  akane: {
    iphone: "assets/wallpapers/akane-sendagi-iphone.jpg",
    android: "assets/wallpapers/akane-sendagi-android.jpg",
    pc: "assets/wallpapers/akane-sendagi-pc.jpg"
  },
  soryu: {
    iphone: "assets/wallpapers/soryu-garden-iphone.jpg",
    android: "assets/wallpapers/soryu-garden-android.jpg",
    pc: "assets/wallpapers/soryu-garden-pc.jpg"
  },
  shuei: {
    iphone: "assets/wallpapers/shuei-grove-iphone.jpg",
    android: "assets/wallpapers/shuei-grove-android.jpg",
    pc: "assets/wallpapers/shuei-grove-pc.jpg"
  }
};

const DESIGN_LABELS = {
  akane: "茜の千駄木",
  soryu: "蒼流の庭",
  shuei: "朱映の杜"
};

const LEGACY_DESIGNS = {
  A: "akane",
  B: "soryu",
  C: "shuei"
};

if (!hasAnswered()) {
  window.location.replace("index.html");
} else {
  initializeGiftChooser();
}

function initializeGiftChooser() {
  const status = new URLSearchParams(window.location.search).get("status");
  const savedChoice = getSavedChoice();

  if (status === "answered") {
    document.querySelector("#result-title").textContent = "回答済みです。";
    document.querySelector("#result-message").textContent = savedChoice
      ? "すでにアンケートへ回答し、壁紙デザインも選択済みです。各サイズを何度でも保存できます。"
      : "すでにアンケートへご回答いただいています。壁紙を1デザインお選びください。";
  }

  if (savedChoice) {
    showClaimedGift(savedChoice);
    return;
  }

  const designButtons = [...document.querySelectorAll("[data-design]")];
  const dialog = document.querySelector("#design-confirm-dialog");
  const confirmButton = document.querySelector("#confirm-design-button");
  const cancelButton = document.querySelector("#cancel-design-button");
  const confirmName = document.querySelector("#confirm-design-name");
  const confirmPreview = document.querySelector("#confirm-design-preview");
  let pendingDesign = "";

  designButtons.forEach((button) => {
    button.addEventListener("click", () => {
      pendingDesign = button.dataset.design;
      confirmName.textContent = DESIGN_LABELS[pendingDesign];
      confirmPreview.innerHTML = `<img src="${WALLPAPERS[pendingDesign].iphone}" alt="${DESIGN_LABELS[pendingDesign]}のプレビュー">`;
      openConfirmDialog(dialog);
    });
  });

  cancelButton.addEventListener("click", () => {
    pendingDesign = "";
    dialog.close();
  });

  confirmButton.addEventListener("click", () => {
    if (!pendingDesign) return;
    const choice = { design: pendingDesign };
    saveChoice(choice);
    dialog.close();
    showClaimedGift(choice);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  dialog.addEventListener("cancel", () => {
    pendingDesign = "";
  });
}

function openConfirmDialog(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }
  dialog.setAttribute("open", "");
}

function showClaimedGift(choice) {
  const chooser = document.querySelector("#chooser");
  const claimed = document.querySelector("#claimed-gift");
  const previewPath = WALLPAPERS[choice.design]?.iphone;

  if (!previewPath) return;
  chooser.hidden = true;
  claimed.hidden = false;
  document.querySelector("#claimed-summary").textContent = DESIGN_LABELS[choice.design];
  document.querySelector("#claimed-preview").innerHTML = `<img src="${previewPath}" alt="選択した壁紙 ${DESIGN_LABELS[choice.design]}">`;
  document.querySelectorAll("[data-download-device]").forEach((link) => {
    const path = WALLPAPERS[choice.design][link.dataset.downloadDevice];
    link.href = path;
    link.download = path.split("/").pop();
  });
}

function hasAnswered() {
  try {
    if (window.localStorage.getItem(ANSWER_KEY)) return true;
  } catch (error) {
    console.info("localStorage is unavailable", error);
  }
  return readCookie(ANSWER_COOKIE) === "1";
}

function getSavedChoice() {
  try {
    const value = window.localStorage.getItem(GIFT_KEY);
    if (value) {
      const parsed = JSON.parse(value);
      const normalized = {
        design: LEGACY_DESIGNS[parsed.design] || parsed.design
      };

      if (WALLPAPERS[normalized.design]) {
        if (normalized.design !== parsed.design || parsed.device) saveChoice(normalized);
        return normalized;
      }

      window.localStorage.removeItem(GIFT_KEY);
    }
  } catch (error) {
    console.info("Stored gift choice is unavailable", error);
  }

  const cookieValue = readCookie(GIFT_COOKIE);
  if (!cookieValue) return null;
  const [rawDesign] = cookieValue.split(/[.-]/);
  const design = LEGACY_DESIGNS[rawDesign] || rawDesign;
  return WALLPAPERS[design] ? { design } : null;
}

function saveChoice(choice) {
  try {
    window.localStorage.setItem(GIFT_KEY, JSON.stringify(choice));
  } catch (error) {
    console.info("localStorage is unavailable", error);
  }
  document.cookie = `${GIFT_COOKIE}=${choice.design}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

function readCookie(name) {
  const prefix = `${name}=`;
  const item = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? item.slice(prefix.length) : "";
}

function showGiftMessage(text) {
  const message = document.querySelector("#gift-message");
  message.textContent = text;
  message.classList.add("is-visible");
  message.scrollIntoView({ behavior: "smooth", block: "center" });
}
