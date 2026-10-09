const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwphXfMQiKax7jESt6mOww5AAK4xDofqRDEA5sMaim84OQXj_QDAtilHOMo7sIymP_9/exec";
const ANSWER_KEY = "sendagiChankoSurveyAnswered2026";
const ANSWER_COOKIE = "sendagi_chanko_answered_2026";

if (hasAnswered()) {
  window.location.replace("wallpaper.html?status=answered");
} else {
  initializeSurvey();
}

window.addEventListener("pageshow", () => {
  if (hasAnswered() && !window.location.pathname.endsWith("thank-you.html")) {
    window.location.replace("wallpaper.html?status=answered");
  }
});

function initializeSurvey() {
  const form = document.querySelector("#survey-form");
  const frame = document.querySelector("#submit-frame");
  const submitButton = document.querySelector("#submit-button");
  const message = document.querySelector("#form-message");
  const comment = form.elements.comments;
  const commentCount = document.querySelector("#comment-count");
  let isSubmitting = false;
  let timeoutId;

  form.action = SCRIPT_URL;

  comment.addEventListener("input", () => {
    commentCount.textContent = comment.value.length;
  });

  form.addEventListener("submit", (event) => {
    message.classList.remove("is-visible");
    message.textContent = "";

    if (hasAnswered()) {
      event.preventDefault();
      window.location.replace("wallpaper.html?status=answered");
      return;
    }

    if (!form.checkValidity()) {
      event.preventDefault();
      form.reportValidity();
      showError("必須の質問に回答してください。");
      const firstInvalid = form.querySelector(":invalid");
      firstInvalid?.closest(".question")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (isSubmitting) {
      event.preventDefault();
      return;
    }

    isSubmitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "送信しています…";

    timeoutId = window.setTimeout(() => {
      if (isSubmitting) {
        isSubmitting = false;
        submitButton.disabled = false;
        submitButton.textContent = "回答を送信する";
        showError("送信を確認できませんでした。通信状況を確認して、もう一度お試しください。");
      }
    }, 15000);
  });

  frame.addEventListener("load", () => {
    if (!isSubmitting) return;
    window.clearTimeout(timeoutId);
    isSubmitting = false;
    markAnswered();
    window.location.replace("wallpaper.html?status=completed");
  });

  function showError(text) {
    message.textContent = text;
    message.classList.add("is-visible");
  }
}

function hasAnswered() {
  try {
    if (window.localStorage.getItem(ANSWER_KEY)) return true;
  } catch (error) {
    console.info("localStorage is unavailable", error);
  }

  return document.cookie
    .split(";")
    .map((item) => item.trim())
    .some((item) => item === `${ANSWER_COOKIE}=1`);
}

function markAnswered() {
  try {
    window.localStorage.setItem(ANSWER_KEY, new Date().toISOString());
  } catch (error) {
    console.info("localStorage is unavailable", error);
  }

  document.cookie = `${ANSWER_COOKIE}=1; Max-Age=31536000; Path=/; SameSite=Lax`;
}
