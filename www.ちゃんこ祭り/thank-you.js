const status = new URLSearchParams(window.location.search).get("status") || "answered";
window.location.replace(`wallpaper.html?status=${encodeURIComponent(status)}`);
