const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.documentElement.classList.add("motion-enabled");

if (!reduceMotion) {
  requestAnimationFrame(() => document.documentElement.classList.add("motion-started"));
  createAutumnLeaves();
  observeRevealItems();
  initializeChoiceAnimations();
}

if (document.querySelector("#survey-form")) {
  initializeSurveyProgress();
}

function createAutumnLeaves() {
  const layer = document.createElement("div");
  layer.className = "autumn-motion";
  layer.setAttribute("aria-hidden", "true");
  const symbols = ["🍁", "🍂", "🍁", "◆"];

  for (let index = 0; index < 9; index += 1) {
    const leaf = document.createElement("span");
    leaf.textContent = symbols[index % symbols.length];
    leaf.style.setProperty("--leaf-x", `${5 + ((index * 13) % 91)}vw`);
    leaf.style.setProperty("--leaf-delay", `${-2.2 * index}s`);
    leaf.style.setProperty("--leaf-duration", `${12 + (index % 5) * 2.4}s`);
    leaf.style.setProperty("--leaf-drift", `${index % 2 ? 46 : -38}px`);
    leaf.style.setProperty("--leaf-size", `${12 + (index % 4) * 4}px`);
    layer.appendChild(leaf);
  }

  document.body.appendChild(layer);
}

function observeRevealItems() {
  const items = document.querySelectorAll(".question, .gift-card, footer");
  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-revealed"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-revealed");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -7%" });

  items.forEach((item, index) => {
    item.style.setProperty("--reveal-delay", `${Math.min(index, 3) * 70}ms`);
    observer.observe(item);
  });
}

function initializeChoiceAnimations() {
  document.querySelectorAll("input[type='radio'], input[type='checkbox']").forEach((input) => {
    input.addEventListener("change", () => {
      const label = input.closest("label");
      if (!label) return;
      label.classList.remove("is-popping");
      void label.offsetWidth;
      label.classList.add("is-popping");
      window.setTimeout(() => label.classList.remove("is-popping"), 520);

      const question = input.closest(".question");
      question?.classList.add("is-answered");
    });
  });
}

function initializeSurveyProgress() {
  const requiredNames = ["taste", "portion", "price", "returnIntent", "discovery"];
  const progress = document.createElement("div");
  progress.className = "survey-progress";
  progress.setAttribute("aria-hidden", "true");
  progress.innerHTML = '<span class="survey-progress__bar"></span><span class="survey-progress__label"></span>';
  document.body.appendChild(progress);

  const bar = progress.querySelector(".survey-progress__bar");
  const label = progress.querySelector(".survey-progress__label");

  const update = () => {
    const answered = requiredNames.filter((name) => document.querySelector(`input[name="${name}"]:checked`)).length;
    const percent = Math.round((answered / requiredNames.length) * 100);
    bar.style.width = `${percent}%`;
    label.textContent = answered === requiredNames.length ? "必須回答 完了！" : `必須回答 ${answered}/${requiredNames.length}`;
    progress.classList.toggle("is-complete", answered === requiredNames.length);
  };

  document.querySelector("#survey-form").addEventListener("change", update);
  update();
}
