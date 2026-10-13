"use strict";

// DEMO VALUE — replace with real analysis result.
// All financial figures, confidence, allocations, news and shocks below are
// fictional, illustrative values. No model, external API or allocation executes.
const DEMO_DATA = {
  availableGuarantee: 10000,
  constrainedGuarantee: 8700,
  news: { region: "군산", event: "생산중단", months: 3, confidence: 93 },
  forecastDemandGrowth: 12.4,
  pd: 5.8,
  expectedLoss: 540,
  recoveryRate: 41,
  scenarios: 12482,
  // Illustrative relative block heights, not measured regional allocations.
  initialAllocation: [38, 51, 43, 65, 48, 80, 58, 45, 71, 52, 41, 60, 85, 48, 62, 44, 56],
  allocations: {
    stable: [45, 54, 63, 50, 61, 65, 57, 62, 48, 53, 68, 60, 50, 56, 61, 53, 58],
    balanced: [60, 47, 68, 56, 74, 52, 65, 49, 62, 76, 55, 71, 46, 67, 58, 73, 64],
    support: [70, 59, 85, 63, 79, 54, 81, 58, 76, 90, 66, 83, 57, 75, 68, 86, 72],
  },
  preShockCapacity: 6900,
  stress: {
    construction: { label: "건설업 +30%", event: "건설업 부실 +30%", current: 3100, stable: 4300, balanced: 4050, support: 3500 },
    rate: { label: "금리 +1.5%p", event: "금리 +1.5%p", current: 4700, stable: 5600, balanced: 5300, support: 4800 },
    sales: { label: "지역매출 −10%", event: "지역매출 −10%", current: 3800, stable: 4900, balanced: 4600, support: 4200 },
  },
};

const PORTFOLIOS = {
  stable: { name: "안정형", comparison: "Re:Balance 안정안", traits: ["예상손실 ↓", "지원규모 ↓"] },
  balanced: { name: "균형형", comparison: "Re:Balance 균형안", traits: ["손실 ↔", "지원 ↔"] },
  support: { name: "지원확대형", comparison: "Re:Balance 지원확대안", traits: ["지원규모 ↑", "위험 ↑"] },
};

// Scene copy and durations are kept together for easy editorial changes.
// 8 × 10 seconds = an 80-second presentation; manual navigation pauses it.
const SCENES = [
  { chapter: "딜레마", title: ["지원은 늘려야 하고,", "손실은 줄여야 한다."], subtitle: "한정된 재보증 여력 · 지역 지원 확대 · 건전성 관리", duration: 10000, render: dilemmaScene },
  { chapter: "경제 신호", title: ["숫자가 움직이기 전에,", "지역은 먼저 움직인다."], subtitle: "Economic Signal Agent · 비정형 정보 → 구조화된 Risk Event", duration: 10000, render: signalScene },
  { chapter: "신호 구조화", title: ["하나의 뉴스가", "하나의 위험 변수로."], subtitle: "LLM Extraction · 뉴스/공시/정책자료 → 지역·업종 Risk Event", duration: 10000, render: extractionScene },
  { chapter: "예측", title: ["위험을 발견했다면,", "다음은 얼마나 커질지를 계산한다."], subtitle: "Forecast Engine · Demand · PD · Expected Loss · Recovery", duration: 10000, render: forecastScene },
  { chapter: "정책 변환", title: ["정책 언어를", "계산 가능한 조건으로."], subtitle: "Policy Compiler · 자연어 정책 목표 → Optimization Constraints", duration: 10000, render: policyScene },
  { chapter: "포트폴리오", title: ["한 개의 정답 대신,", "세 개의 선택지."], subtitle: "Portfolio Optimizer · 정책효과 · 예상손실 · 집중위험 · 재보증 여력", duration: 10000, render: portfolioScene },
  { chapter: "스트레스 테스트", title: ["그 결정,", "충격이 와도 버틸까?"], subtitle: "Stress Engine · 구조적 위험과 일시적 외부충격을 구분", duration: 10000, render: stressScene },
  { chapter: "Re:Balance", title: ["위험을 측정하는 AI에서", "정책금융을 설계하는 AI로."], subtitle: "신용보증재단중앙회 · 재보증·리스크관리 담당자를 위한 의사결정 지원", duration: 10000, render: closingScene },
];

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const state = {
  index: 0,
  autoplay: !motionQuery.matches,
  elapsed: 0,
  lastTick: 0,
  version: 0,
  reducedMotion: motionQuery.matches,
  portfolio: "balanced",
  stress: "construction",
};

const elements = {
  stage: document.getElementById("stage"),
  host: document.getElementById("scene-host"),
  chapter: document.getElementById("chapter"),
  number: document.getElementById("scene-number"),
  subtitle: document.getElementById("stage-subtitle"),
  announcement: document.getElementById("scene-announcement"),
  prev: document.getElementById("edge-prev"),
  next: document.getElementById("edge-next"),
  timeline: document.getElementById("timeline"),
  toggle: document.getElementById("play-toggle"),
  playIcon: document.getElementById("play-icon"),
  playLabel: document.getElementById("play-label"),
};
const formatter = new Intl.NumberFormat("ko-KR");
const sceneTimers = new Set();
const numberAnimations = new Map();

function icon(name, className = "") {
  return `<svg class="icon ${className}" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
}

function titleMarkup(scene) {
  return `<h1 class="scene-title reveal" style="--delay:180ms">${scene.title[0]}<br><span class="accent">${scene.title[1]}</span></h1>`;
}

function poolMarkup(id, value, label = "가용 재보증", className = "") {
  return `<div class="pool ${className}" role="group" aria-label="${label}">
    <svg class="pool-shape" viewBox="0 0 320 170" aria-hidden="true"><use href="#object-pool"/></svg>
    <div class="pool-copy"><div class="pool-label">${label}</div><div class="pool-value"><span id="${id}" data-value="${value}">${formatter.format(value)}</span><span class="pool-unit">억원</span></div></div>
  </div>`;
}

function newsMarkup(className = "") {
  return `<div class="paper ${className}"><div class="paper-heading">${icon("document")}<span>지역 경제 신호 · 가상 뉴스</span></div><p>${DEMO_DATA.news.region} 주요 제조사업장<br>${DEMO_DATA.news.months}개월 생산중단</p><span class="paper-ruling"></span><span class="paper-ruling short"></span></div>`;
}

function dilemmaScene(scene) {
  return `${titleMarkup(scene)}<p class="scene-kicker reveal" style="--delay:700ms">같은 재원 · 서로 다른 목표</p>
    <div class="scene-art dilemma-art">
      <div class="goal reveal" style="--delay:1500ms">${icon("bank")}<p>지역 지원</p><span class="up">↑</span></div>
      <div class="goal-line left reveal" style="--delay:1900ms" aria-hidden="true"></div>
      <div class="reveal" style="--delay:1000ms">${poolMarkup("capacity", DEMO_DATA.availableGuarantee)}</div>
      <div class="goal-line right reveal" style="--delay:1900ms" aria-hidden="true"></div>
      <div class="goal reveal" style="--delay:1750ms">${icon("shield")}<p>건전성 관리</p><span class="up">↑</span></div>
      <div class="capacity-note reveal" style="--delay:4500ms">여력은 한정되어 있습니다.</div>
    </div>`;
}

function signalScene(scene) {
  // Symbolic regional nodes only: this is deliberately not a geographic map.
  const names = { 1: "서울", 4: "경기", 8: "전북", 11: "충남", 15: "부산" };
  const points = Array.from({ length: 17 }, (_, i) => {
    const angle = Math.PI * (0.12 + (i / 16) * 0.76);
    return { x: 365 - Math.cos(angle) * 282, y: 72 + Math.sin(angle) * 141 };
  });
  const riskPoint = points[8];
  const nodes = points.map((point, i) => `<g class="reveal" style="--delay:${650 + i * 45}ms">
    ${i === 8 ? `<circle class="risk-outline" cx="${point.x}" cy="${point.y}" r="17"/>` : ""}
    <circle class="region-node ${i === 8 ? "region-risk" : ""}" cx="${point.x}" cy="${point.y}" r="${i === 8 ? 10 : 5}"/>
    ${i === 8 ? `<text class="risk-mark" x="${point.x}" y="${point.y + 5}">!</text>` : ""}
    ${names[i] ? `<text class="region-name" x="${point.x}" y="${point.y + 33}">${names[i]}</text>` : ""}</g>`).join("");
  const route = `M 210 105 C 260 112, 285 180, ${riskPoint.x} ${riskPoint.y - 20}`;
  return `${titleMarkup(scene)}<div class="scene-art signal-art">
    <svg class="region-network" viewBox="0 0 730 270" role="img" aria-label="17개 지역 노드 중 전북에 위험 신호가 발생해 제조·운송·음식·숙박업으로 영향이 퍼지는 가상 예시">
      <path class="event-route" d="${route}"/><path class="event-trace" d="${route}"/>
      <path class="event-route reveal" style="--delay:2400ms" d="M382 204 Q 467 167 555 114 M382 204 Q 480 191 555 155 M382 204 Q 480 216 555 197"/>
      ${nodes}
    </svg>
    ${newsMarkup("news-small reveal")}
    <div class="industry-effects"><span class="reveal" style="--delay:2450ms">제조업 <b>↑</b></span><span class="reveal" style="--delay:2700ms">운송업 <b>↑</b></span><span class="reveal" style="--delay:2950ms">음식·숙박 <b>↑</b></span></div>
  </div>`;
}

function extractionScene(scene) {
  const fields = [
    ["지역", DEMO_DATA.news.region], ["Event", DEMO_DATA.news.event], ["지속기간", `${DEMO_DATA.news.months}개월`],
    ["직접 영향", "제조업"], ["2차 영향", "운송 · 음식 · 숙박"], ["Risk", '<span class="risk-value">↑ 위험 신호</span>'],
    ["Confidence", `${DEMO_DATA.news.confidence}% <span class="check">${icon("check")}</span>`],
  ];
  return `${titleMarkup(scene)}<div class="scene-art extraction-art">
    ${newsMarkup("reveal")}
    <span class="connector reveal" style="--delay:700ms" aria-hidden="true"></span>
    <dl class="event-fields">${fields.map(([label, value], i) => `<div class="event-field reveal" style="--delay:${1000 + i * 250}ms"><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl>
    <span class="micro-label reveal" style="--delay:2900ms">DEMO SIMULATION</span>
  </div>`;
}

function forecastScene(scene) {
  const inputs = [["카드매출", "coin"], ["보증", "document"], ["재보증", "bank"], ["폐업", "document"], ["금리", "trend"]];
  const outputs = [
    ["3개월 보증수요", "demand", "%", ""], ["예상 PD", "pd", "%", ""],
    ["예상손실", "loss", "억원", "loss"], ["예상 회수율", "recovery", "%", ""],
  ];
  return `${titleMarkup(scene)}<div class="scene-art forecast-art">
    <div class="forecast-inputs">${inputs.map(([label, name], i) => `<div class="input-token reveal" style="--delay:${600 + i * 170}ms">${icon(name)}<span>${label}</span></div>`).join("")}</div>
    <div class="forecast-engine reveal" style="--delay:1400ms"><div class="forecast-feed" aria-hidden="true"></div>Forecast</div>
    <div class="forecast-outputs">${outputs.map(([label, id, unit, className], i) => `<dl class="forecast-metric ${className} reveal" style="--delay:${2100 + i * 250}ms"><dt>${label}</dt><dd><span id="forecast-${id}" data-value="0">${id === "demand" ? "+0.0" : "0"}</span><span class="metric-unit">${unit}</span></dd></dl>`).join("")}</div>
  </div>`;
}

function policyScene(scene) {
  const constraints = [["비수도권 지원", "≥ 정책 목표"], ["Expected Loss", "≤ 기준안"], ["건설업 Exposure", "≤ 집중 한도"], ["중저신용 지원", "≥ 기존 수준"], ["총 재보증", "≤ 가용 여력"]];
  return `${titleMarkup(scene)}<div class="scene-art policy-art">
    <div class="paper policy-note reveal" style="--delay:650ms"><div class="paper-heading">${icon("document")}<span>담당자의 정책 목표</span></div><p>“비수도권 지원은 확대하되<br>예상손실은 증가시키지 않고,<br>건설업 편중은 낮춰줘.”</p><span class="paper-ruling"></span><span class="paper-ruling short"></span></div>
    <div class="compiler reveal" style="--delay:1050ms"><span class="compiler-name">Policy Compiler</span><span class="connector" aria-hidden="true"></span></div>
    <div class="constraints">${constraints.map(([label, value], i) => `<div class="constraint reveal" style="--delay:${1450 + i * 300}ms"><span>${label}</span><span class="constraint-value">${value}</span><span class="check">${icon("check")}</span></div>`).join("")}
      <p class="rule-status reveal" style="--delay:3400ms">${icon("check")} Rule validation passed</p>
    </div>
  </div>`;
}

function portfolioScene(scene) {
  return `${titleMarkup(scene)}<div class="scene-art portfolio-art">
    <div class="allocation reveal" style="--delay:700ms">
      ${poolMarkup("portfolio-capacity", DEMO_DATA.availableGuarantee, "총 재보증 여력", "allocation-pool")}
      <div class="allocation-visual"><div class="allocation-caption"><span>17개 지역</span><span class="scenario-count"><span id="scenario-count" data-value="0">0</span> scenarios</span></div>
        <div class="allocation-bars" id="allocation-bars" role="img" aria-label="17개 지역의 예시 배분 비중이 바뀌는 모습">${DEMO_DATA.initialAllocation.map((value, i) => `<span class="allocation-bar" style="--initial-height:${value}%;--target-height:${DEMO_DATA.allocations[state.portfolio][i]}%"></span>`).join("")}</div>
      </div>
    </div>
    <div class="portfolio-options" role="group" aria-label="담당자가 비교할 포트폴리오 선택지">
      ${Object.entries(PORTFOLIOS).map(([key, option], i) => `<button class="portfolio-option reveal" data-portfolio="${key}" aria-pressed="${state.portfolio === key}" style="--delay:${2900 + i * 250}ms"><span class="portfolio-name">${option.name}<span class="selection-mark" aria-hidden="true">✓</span></span><span class="portfolio-traits">${option.traits.map(trait => `<span>${trait}</span>`).join("")}</span></button>`).join("")}
    </div>
    <p class="human-choice reveal" style="--delay:3900ms"><span>대안을 눌러 비교하세요.</span> 최종 선택: 담당자</p>
  </div>`;
}

function stressScene(scene) {
  return `${titleMarkup(scene)}<div class="scene-art stress-art">
    <div class="shock-event reveal" style="--delay:700ms"><span class="risk-badge" aria-hidden="true">!</span><span id="shock-event">${DEMO_DATA.stress[state.stress].event}</span></div>
    <div class="stress-pools">
      <div class="stress-case current reveal" style="--delay:1000ms"><p class="stress-case-title">현재 계획</p>${poolMarkup("stress-current", DEMO_DATA.preShockCapacity, "가용 여력")}</div>
      <div class="stress-case balanced reveal" style="--delay:1250ms"><p class="stress-case-title"><span id="comparison-label">${PORTFOLIOS[state.portfolio].comparison}</span><span class="check">${icon("check")}</span></p>${poolMarkup("stress-proposal", DEMO_DATA.preShockCapacity, "가용 여력")}</div>
    </div>
    <div class="stress-scenarios reveal" style="--delay:2400ms" role="group" aria-label="스트레스 시나리오 선택">
      ${["rate", "construction", "sales"].map(key => `<button class="stress-button" data-stress="${key}" aria-pressed="${state.stress === key}">${DEMO_DATA.stress[key].label}</button>`).join("")}
    </div>
    <div class="stress-principle reveal" style="--delay:3100ms"><strong>위험 상승 ≠ 지원 축소</strong><p><span class="principle-line">구조적 악화 → 한도 조정 검토</span><span aria-hidden="true">·</span><span class="principle-line">일시적 외부충격 → 지원 유지·확대 가능</span></p></div>
  </div>`;
}

function closingScene(scene) {
  const flow = ["SIGNAL", "FORECAST", "POLICY", "OPTIMIZE", "STRESS"];
  return `<div class="legacy-label"><span>기존</span>Risk Measurement</div>
    <h1 class="scene-title closing-title reveal" style="--delay:1700ms">${scene.title[0]}<br><span class="accent">${scene.title[1]}</span></h1>
    <div class="closing-brand reveal" style="--delay:2400ms">${icon("balance")}<span>Re:Balance AI</span></div>
    <p class="closing-tagline reveal" style="--delay:2700ms">AI-powered Policy Portfolio Engine</p>
    <div class="engine-flow reveal" style="--delay:3200ms">${flow.map((name, i) => `${i ? icon("arrow") : ""}<span>${name}</span>`).join("")}</div>
    <p class="closing-choice reveal" style="--delay:3800ms">최종 의사결정은 사람에게.</p>
    <button class="closing-replay reveal" data-replay style="--delay:4200ms">REPLAY ↺</button>`;
}

function schedule(callback, delay) {
  if (state.reducedMotion) { callback(); return; }
  const version = state.version;
  const timer = window.setTimeout(() => {
    sceneTimers.delete(timer);
    if (version === state.version) callback();
  }, delay);
  sceneTimers.add(timer);
}

function clearSceneWork() {
  sceneTimers.forEach(timer => clearTimeout(timer));
  sceneTimers.clear();
  numberAnimations.forEach(animation => cancelAnimationFrame(animation.frame));
  numberAnimations.clear();
}

function animateNumber(id, target, options = {}) {
  const element = document.getElementById(id);
  if (!element) return;
  const previous = numberAnimations.get(id);
  if (previous) cancelAnimationFrame(previous.frame);
  const from = Number(element.dataset.value || 0);
  const { decimals = 0, prefix = "", duration = 1500 } = options;
  const start = performance.now();
  const version = state.version;
  const animation = { frame: 0 };
  const format = value => prefix + (decimals ? value.toFixed(decimals) : formatter.format(Math.round(value)));
  const finish = value => { element.dataset.value = String(value); element.textContent = format(value); };
  if (state.reducedMotion) { finish(target); return; }
  function frame(now) {
    if (version !== state.version || !element.isConnected) { numberAnimations.delete(id); return; }
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    finish(from + (target - from) * eased);
    if (t < 1) animation.frame = requestAnimationFrame(frame);
    else { finish(target); numberAnimations.delete(id); }
  }
  numberAnimations.set(id, animation);
  animation.frame = requestAnimationFrame(frame);
}

function startSceneEffects() {
  if (state.index === 0) schedule(() => animateNumber("capacity", DEMO_DATA.constrainedGuarantee, { duration: 1900 }), 4300);
  if (state.index === 3) {
    schedule(() => animateNumber("forecast-demand", DEMO_DATA.forecastDemandGrowth, { decimals: 1, prefix: "+" }), 2150);
    schedule(() => animateNumber("forecast-pd", DEMO_DATA.pd, { decimals: 1 }), 2400);
    schedule(() => animateNumber("forecast-loss", DEMO_DATA.expectedLoss), 2650);
    schedule(() => animateNumber("forecast-recovery", DEMO_DATA.recoveryRate), 2900);
  }
  if (state.index === 5) {
    schedule(() => animateNumber("scenario-count", DEMO_DATA.scenarios, { duration: 1700 }), 950);
    schedule(() => document.getElementById("allocation-bars")?.classList.add("is-calculated"), 2350);
  }
  if (state.index === 6) schedule(updateStressNumbers, 1850);
}

function showScene(index, { announce = true } = {}) {
  if (index < 0 || index >= SCENES.length) return;
  clearSceneWork();
  state.version += 1;
  state.index = index;
  state.elapsed = 0;
  state.lastTick = performance.now();
  const scene = SCENES[index];
  const oldScene = elements.host.querySelector(".scene:not(.is-leaving)");
  const moveFocus = oldScene?.contains(document.activeElement);
  elements.host.querySelectorAll(".is-leaving").forEach(node => node.remove());
  // An outgoing frame stays visible only for the crossfade. Remove it from the
  // accessibility tree and keyboard order; duplicate numeric IDs are removed too.
  if (oldScene) {
    oldScene.classList.remove("is-entering");
    oldScene.classList.add("is-leaving");
    oldScene.inert = true;
    oldScene.setAttribute("aria-hidden", "true");
    oldScene.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
    window.setTimeout(() => oldScene.remove(), state.reducedMotion ? 0 : 800);
  }
  const nextScene = document.createElement("article");
  nextScene.className = `scene is-entering${index === 6 ? " stress-scene" : ""}${index === 7 ? " closing-scene" : ""}`;
  nextScene.setAttribute("aria-label", `${index + 1}번째 장면: ${scene.chapter}`);
  nextScene.innerHTML = scene.render(scene);
  elements.host.appendChild(nextScene);
  elements.chapter.textContent = scene.chapter;
  elements.number.innerHTML = `${String(index + 1).padStart(2, "0")} <span class="total">/ ${String(SCENES.length).padStart(2, "0")}</span>`;
  elements.subtitle.textContent = scene.subtitle;
  elements.prev.disabled = index === 0;
  elements.next.disabled = index === SCENES.length - 1;
  if (announce) elements.announcement.textContent = `${index + 1} / ${SCENES.length}. ${scene.chapter}. ${scene.title.join(" ")}`;
  [...elements.timeline.children].forEach((button, i) => {
    button.classList.toggle("is-complete", i < index);
    if (i === index) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
    button.querySelector(".timeline-fill").style.transform = i < index ? "scaleX(1)" : "scaleX(0)";
  });
  startSceneEffects();
  updatePlaybackUI();
  updateTranscript();
  if (moveFocus) elements.timeline.children[index].focus({ preventScroll: true });
}

function updateTranscript() {
  const stress = DEMO_DATA.stress[state.stress];
  const content = [
    ["같은 재원, 서로 다른 목표", [`지역 지원 확대와 건전성 관리를 함께 고려합니다.`, `가용 재보증 ${formatter.format(DEMO_DATA.availableGuarantee)} → ${formatter.format(DEMO_DATA.constrainedGuarantee)}억원 (가상 예시)`]],
    ["지역의 변화에서 위험 신호를 발견", [`가상 뉴스: ${DEMO_DATA.news.region} 주요 제조사업장 ${DEMO_DATA.news.months}개월 생산중단`, "전북의 제조업과 운송·음식·숙박업에 영향이 퍼집니다."]],
    ["뉴스를 구조화된 Risk Event로 변환", [`${DEMO_DATA.news.region} · ${DEMO_DATA.news.event} · ${DEMO_DATA.news.months}개월`, "직접 영향: 제조업 / 2차 영향: 운송·음식·숙박", `추출 신뢰도 ${DEMO_DATA.news.confidence}% (가상 예시)`]],
    ["Forecast Engine의 가상 예측", [`3개월 보증수요 +${DEMO_DATA.forecastDemandGrowth}% / 예상 PD ${DEMO_DATA.pd}%`, `예상손실 ${DEMO_DATA.expectedLoss}억원 / 예상 회수율 ${DEMO_DATA.recoveryRate}%`]],
    ["정책 언어를 계산 가능한 조건으로", ["비수도권 지원 ≥ 정책 목표", "예상손실 ≤ 기준안 / 건설업 Exposure ≤ 집중 한도", "중저신용 지원 ≥ 기존 수준 / 총 재보증 ≤ 가용 여력"]],
    ["세 가지 대안을 담당자가 선택", [`${formatter.format(DEMO_DATA.scenarios)}개 가상 시나리오 · ${formatter.format(DEMO_DATA.availableGuarantee)}억원 여력`, "안정형: 손실·지원 ↓ / 균형형: 손실·지원 ↔", `지원확대형: 지원·위험 ↑ / 현재 선택: ${PORTFOLIOS[state.portfolio].name}`]],
    ["충격 이후의 가상 가용 여력 비교", [`${stress.event} · 현재 계획 ${formatter.format(stress.current)}억원`, `${PORTFOLIOS[state.portfolio].comparison} ${formatter.format(stress[state.portfolio])}억원`, "구조적 악화는 한도 조정 검토, 일시적 충격은 지원 유지·확대 가능"]],
    ["위험 측정에서 정책금융 설계로", ["SIGNAL → FORECAST → POLICY → OPTIMIZE → STRESS", "최종 의사결정은 사람에게."]],
  ][state.index];
  const host = document.getElementById("transcript-content");
  host.replaceChildren();
  const heading = document.createElement("p");
  heading.textContent = content[0];
  const list = document.createElement("ul");
  content[1].forEach(line => { const item = document.createElement("li"); item.textContent = line; list.appendChild(item); });
  host.append(heading, list);
}

function updatePlaybackUI() {
  elements.toggle.setAttribute("aria-pressed", String(state.autoplay));
  elements.toggle.setAttribute("aria-label", state.autoplay ? "자동재생 일시정지" : "자동재생 시작");
  elements.playIcon.textContent = state.autoplay ? "Ⅱ" : "▷";
  elements.playLabel.textContent = state.autoplay ? "자동재생" : "재생";
}

function pause() { state.autoplay = false; updatePlaybackUI(); }

function navigate(index) { pause(); showScene(index); }

function replay() {
  state.portfolio = "balanced";
  state.stress = "construction";
  state.autoplay = !state.reducedMotion;
  showScene(0);
}

function selectPortfolio(key) {
  if (!PORTFOLIOS[key]) return;
  pause();
  state.portfolio = key;
  elements.host.querySelectorAll("[data-portfolio]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.portfolio === key)));
  const bars = document.getElementById("allocation-bars");
  bars?.classList.add("is-calculated");
  bars?.querySelectorAll(".allocation-bar").forEach((bar, i) => bar.style.setProperty("--target-height", `${DEMO_DATA.allocations[key][i]}%`));
  elements.announcement.textContent = `${PORTFOLIOS[key].name} 선택. 다음 장면에서 이 대안의 가상 스트레스 결과를 비교합니다. 최종 선택은 담당자입니다.`;
  updateTranscript();
}

function updateStressNumbers() {
  const stress = DEMO_DATA.stress[state.stress];
  animateNumber("stress-current", stress.current, { duration: 1400 });
  animateNumber("stress-proposal", stress[state.portfolio], { duration: 1400 });
}

function selectStress(key) {
  if (!DEMO_DATA.stress[key]) return;
  pause();
  // Cancel the scene's initial shock so it cannot supersede a manual selection.
  sceneTimers.forEach(timer => clearTimeout(timer));
  sceneTimers.clear();
  state.stress = key;
  document.getElementById("shock-event").textContent = DEMO_DATA.stress[key].event;
  elements.host.querySelectorAll("[data-stress]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.stress === key)));
  updateStressNumbers();
  const stress = DEMO_DATA.stress[key];
  elements.announcement.textContent = `가상 시뮬레이션. ${stress.event}. 현재 계획 가용 여력 ${formatter.format(stress.current)}억원, ${PORTFOLIOS[state.portfolio].comparison} ${formatter.format(stress[state.portfolio])}억원.`;
  updateTranscript();
}

SCENES.forEach((scene, index) => {
  const button = document.createElement("button");
  button.className = "timeline-button";
  button.setAttribute("aria-label", `${index + 1}번째 장면: ${scene.chapter}`);
  button.innerHTML = '<span class="timeline-track"><span class="timeline-fill"></span></span>';
  button.addEventListener("click", () => navigate(index));
  elements.timeline.appendChild(button);
});

elements.prev.addEventListener("click", () => navigate(state.index - 1));
elements.next.addEventListener("click", () => navigate(state.index + 1));
elements.toggle.addEventListener("click", () => {
  if (state.autoplay) pause();
  else if (state.index === SCENES.length - 1 && state.elapsed >= SCENES[state.index].duration) {
    state.autoplay = true;
    showScene(0);
  } else { state.autoplay = true; state.lastTick = performance.now(); updatePlaybackUI(); }
});
document.getElementById("replay").addEventListener("click", replay);
document.getElementById("brand-replay").addEventListener("click", event => { event.preventDefault(); replay(); });
document.getElementById("mobile-transcript").addEventListener("click", event => { if (event.target.closest("summary")) pause(); });

elements.stage.addEventListener("click", event => {
  const target = event.target.closest("button, a");
  if (target?.dataset.portfolio) selectPortfolio(target.dataset.portfolio);
  else if (target?.dataset.stress) selectStress(target.dataset.stress);
  else if (target?.hasAttribute("data-replay")) {
    // The in-scene replay disappears on navigation; move focus to a stable button.
    document.getElementById("replay").focus({ preventScroll: true });
    replay();
  } else if (!target) {
    const bounds = elements.stage.getBoundingClientRect();
    navigate(state.index + (event.clientX - bounds.left < bounds.width / 2 ? -1 : 1));
  }
});

document.addEventListener("keydown", event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  if (event.key === "Tab") { pause(); return; }
  if (event.target.closest("input, textarea, select, [contenteditable='true']")) return;
  // Space on a focused control keeps its native activation behavior.
  if (event.code === "Space" && event.target.closest("button, a, summary")) return;
  if (event.code === "Space" || event.key === "ArrowRight") { event.preventDefault(); navigate(state.index + 1); }
  else if (event.key === "ArrowLeft") { event.preventDefault(); navigate(state.index - 1); }
});

document.addEventListener("visibilitychange", () => {
  // Hidden tabs do not silently consume a presentation; returning resumes the
  // remaining scene time if the viewer had not paused manually.
  state.lastTick = performance.now();
});

motionQuery.addEventListener("change", event => {
  state.reducedMotion = event.matches;
  if (event.matches) pause();
  // Re-render to settle pending numeric effects without motion.
  showScene(state.index, { announce: false });
});

function tick(now) {
  const delta = Math.max(0, now - state.lastTick);
  state.lastTick = now;
  if (state.autoplay && !document.hidden) {
    state.elapsed += delta;
    if (state.elapsed >= SCENES[state.index].duration) {
      if (state.index < SCENES.length - 1) showScene(state.index + 1);
      else { state.elapsed = SCENES[state.index].duration; pause(); }
    }
  }
  const fill = elements.timeline.children[state.index]?.querySelector(".timeline-fill");
  if (fill) fill.style.transform = `scaleX(${Math.min(state.elapsed / SCENES[state.index].duration, 1)})`;
  requestAnimationFrame(tick);
}

showScene(0);
requestAnimationFrame(tick);
