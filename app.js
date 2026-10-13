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
let storyMotion = null;

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
    <div class="scene-art story-art dilemma-story">
      <svg class="story-svg" viewBox="0 0 900 280" role="img" aria-label="한정된 재보증 풀에서 지역 상점으로 재원이 이동하며 지원이 늘어나고, 방패가 손실 흐름을 차단하며 손실 표시가 줄어드는 개념 애니메이션">
        <path class="story-path" data-support-path d="M308 150 C270 215 214 215 166 162"/>
        <path class="story-path story-path-risk" data-loss-path d="M594 150 C660 105 713 105 818 142"/>
        <path class="story-path story-path-return" data-return-path d="M726 140 C709 225 649 229 596 165"/>
        <g class="story-stores" data-store-cluster>
          ${[0, 1, 2].map((i) => `<g transform="translate(${69 + i * 55} 100)"><g data-store="${i}" class="story-store"><path d="M0 24 7 8h34l7 16" class="store-roof"/><rect x="3" y="24" width="42" height="49" rx="3" class="store-body"/><path d="M0 24h48M12 24v8m12-8v8m12-8v8" class="store-detail"/><rect x="11" y="43" width="12" height="12" rx="1" class="store-window"/><path d="M30 73V45h10v28" class="store-detail"/></g></g>`).join("")}
          <path d="M61 177h177" class="store-ground"/>
        </g>
        <g data-pool-graphic>
          <use href="#object-pool" x="290" y="61" width="320" height="170"/>
          <text class="story-pool-label" x="450" y="149">가용 재보증</text>
          <text class="story-pool-value" x="450" y="191" id="capacity" data-value="${DEMO_DATA.availableGuarantee}">${formatter.format(DEMO_DATA.availableGuarantee)}</text>
          <text class="story-pool-unit" x="450" y="214">억원</text>
          <g data-reserve-fill>${Array.from({ length: 8 }, (_, i) => `<rect x="${322 + i * 32}" y="107" width="24" height="5" rx="2" class="reserve-unit"/>`).join("")}</g>
        </g>
        <g transform="translate(758 94)"><g data-protection-shield><path d="m0 0 30 12v26c0 21-30 37-30 37S-30 59-30 38V12L0 0Z" class="story-shield"/><path d="m-12 35 10 10 17-22" class="story-shield-check"/></g></g>
        <g data-loss-stack>${[0, 1, 2].map(i => `<rect x="802" y="${130 + i * 14}" width="${35 - i * 5}" height="8" rx="3" class="loss-unit" data-loss-unit="${i}"/>`).join("")}</g>
        ${[0, 1, 2].map(i => `<circle r="7" class="resource-token" data-resource-token="${i}"/>`).join("")}
        ${[0, 1].map(i => `<circle r="5" class="loss-token" data-loss-token="${i}"/>`).join("")}
        <circle r="5" class="return-token" data-return-token/>
        <text class="story-goal" x="148" y="222">지역 지원 <tspan class="story-mint">↑</tspan></text>
        <text class="story-goal" x="772" y="222">손실 <tspan class="story-orange">↓</tspan></text>
        <text class="story-caption" x="450" y="271" data-motion-caption>한정된 재원, 두 가지 목표</text>
      </svg>
    </div>`;
}

function signalScene(scene) {
  const regions = [["서울", 90, 169], ["경기", 260, 125], ["전북", 450, 165], ["충남", 640, 125], ["부산", 810, 169]];
  const route = "M90 169 C135 169 194 125 260 125 S384 165 450 165 S574 125 640 125 S765 169 810 169";
  return `${titleMarkup(scene)}<div class="scene-art story-art signal-story">
    <svg class="story-svg" viewBox="0 0 900 300" role="img" aria-label="서울, 경기, 전북, 충남, 부산을 따라 신호가 부드럽게 이동하는 지역 순차 탐색. 전북의 가상 뉴스가 제조·운송·음식·숙박 위험 신호로 연결됩니다. 지역 간 실제 전염 경로를 뜻하지 않는 개념도입니다.">
      <path class="story-path region-flow-base" d="${route}"/>
      <path class="region-flow-trace" data-region-path d="${route}"/>
      ${Array.from({ length: 12 }, (_, i) => `<circle class="minor-region" cx="${108 + i * 61}" cy="${211 + Math.sin(i / 11 * Math.PI) * 25}" r="3"/>`).join("")}
      ${regions.map(([name, x, y], i) => `<g class="flow-region" data-region="${i}" transform="translate(${x} ${y})"><circle class="flow-region-ring" r="18"/><circle class="flow-region-dot" r="8"/><text class="flow-region-label" y="39">${name}</text>${i === 2 ? '<text class="flow-risk-mark" y="6">!</text>' : ""}</g>`).join("")}
      <g data-regional-news transform="translate(345 3) scale(.62)">${storyNewsMarkup()}</g>
      <path class="story-path" data-news-route d="M450 141 C450 146 450 151 450 156"/>
      <circle r="4" class="loss-token" data-news-signal/>
      ${[0, 1, 2].map(i => `<g data-industry="${i}"><path class="story-path industry-branch" data-industry-path="${i}" d="M465 172 Q${522 + i * 48} 214 ${585 + i * 87} 241"/><circle class="loss-token" data-industry-token="${i}" r="3"/><text class="industry-label" x="${575 + i * 99}" y="268">${["제조업 ↑", "운송업 ↑", "음식·숙박 ↑"][i]}</text></g>`).join("")}
      <circle class="flow-packet" r="7" data-flow-packet/>
      <circle class="flow-packet-tail" r="3" data-flow-tail/>
      <text class="story-caption" x="450" y="297" data-motion-caption>17개 지역의 경제 신호를 순차 탐색</text>
    </svg>
  </div>`;
}

function storyNewsMarkup() {
  return `<path class="news-sheet" data-news-sheet d="M0 0H313L340 27V215Q340 228 327 228H13Q0 228 0 215Z"/>
    <path class="news-fold" d="M313 0v27h27"/>
    <g data-news-copy>
      <text class="news-eyebrow" x="26" y="33">지역 경제 신호 · 가상 뉴스</text>
      <text class="news-headline" x="26" y="82"><tspan data-keyword="region">${DEMO_DATA.news.region}</tspan><tspan dx="9">주요 제조사업장</tspan></text>
      <text class="news-headline" x="26" y="119"><tspan data-keyword="duration">${DEMO_DATA.news.months}개월</tspan><tspan dx="15" data-keyword="event">${DEMO_DATA.news.event}</tspan></text>
      <text class="news-body" x="26" y="158"><tspan data-keyword="direct">제조업</tspan><tspan dx="7">현장 변화</tspan></text>
      <text class="news-body" x="26" y="184"><tspan data-keyword="secondary">운송 · 음식 · 숙박</tspan><tspan dx="7">영향</tspan></text>
      <path class="news-rule" d="M26 204h180"/>
    </g>`;
}

function extractionScene(scene) {
  const fields = [
    ["지역", DEMO_DATA.news.region], ["Event", DEMO_DATA.news.event], ["지속기간", `${DEMO_DATA.news.months}개월`],
    ["직접 영향", "제조업"], ["2차 영향", "운송 · 음식 · 숙박"], ["Risk", '<span class="risk-value">↑ 위험 신호</span>'],
    ["Confidence", `${DEMO_DATA.news.confidence}%`],
  ];
  const keywords = [
    { key: "region", value: DEMO_DATA.news.region, from: [123, 103], to: [757, 55], width: 67, row: 0 },
    { key: "event", value: DEMO_DATA.news.event, from: [214, 140], to: [766, 85], width: 99, row: 1 },
    { key: "duration", value: `${DEMO_DATA.news.months}개월`, from: [123, 140], to: [757, 115], width: 67, row: 2 },
    { key: "direct", value: "제조업", from: [118, 179], to: [757, 145], width: 77, row: 3 },
    { key: "secondary", value: "운송 · 음식 · 숙박", from: [172, 205], to: [790, 175], width: 152, row: 4 },
  ];
  return `${titleMarkup(scene)}<div class="scene-art story-art extraction-story">
    <svg class="story-svg" viewBox="0 0 900 300" role="img" aria-label="가상 뉴스의 군산, 생산중단, 3개월, 제조업, 2차 영향 문구를 스캔하고 추출합니다. 문구가 뉴스에서 분리되어 지역, Event, 지속기간, 영향 변수로 이동하며 Risk Event로 변환됩니다.">
      <g data-extraction-document transform="translate(280 21)">
        ${storyNewsMarkup()}
        <rect class="news-scan" data-news-scan x="13" y="51" width="314" height="32" rx="3"/>
        <path class="news-scan-edge" data-news-scan-edge d="M13 51h314"/>
      </g>
      <path class="story-path extraction-path" data-extraction-path d="M410 145H558"/>
      <g class="extraction-gate" data-extraction-gate transform="translate(469 129)"><path d="M-20-20h-7v54h7m40-54h7v54h-7"/><path d="M-12 0h24m-12-12v24"/><text y="57">LLM Extraction</text></g>
      <g data-risk-record>
        ${fields.map(([label, value], i) => `<g class="risk-record-row" data-risk-row="${i}" transform="translate(577 ${55 + i * 30})"><text class="risk-record-label">${label}</text><text class="risk-record-value ${i === 5 ? "risk-record-warning" : ""}" x="${i === 4 ? 122 : 147}" data-risk-value="${i}">${value.replace(/<[^>]*>/g, "")}</text>${i < 6 ? '<path class="risk-record-rule" d="M0 13h288"/>' : ""}</g>`).join("")}
        <path class="extraction-verified" data-extraction-check d="m819 232 7 7 15-17"/>
      </g>
      ${keywords.map(item => `<g class="extracted-word" data-extracted-word="${item.key}" data-from="${item.from.join(",")}" data-to="${item.to.join(",")}" data-row="${item.row}"><rect x="${-item.width / 2}" y="-17" width="${item.width}" height="31" rx="4"/><text text-anchor="middle" y="5">${item.value}</text></g>`).join("")}
      <g class="event-seal" data-event-seal transform="translate(244 133)"><circle r="37"/><path d="m-13 0 9 9 18-22"/><text y="65">Risk Event</text></g>
      <text class="story-caption" x="450" y="292" data-motion-caption>한 장의 뉴스에서 출발합니다.</text>
    </svg>
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
  storyMotion = null;
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

// Continuous motion explains the idea: funds actually travel, regional signals
// follow a curve, and words leave a document and become typed risk variables.
// This timeline is independent of automatic scene navigation. Manual navigation
// stops autoplay but allows the selected scene's explanation to finish.
function unit(value) { return Math.max(0, Math.min(1, value)); }
function progress(time, start, end) {
  const p = unit((time - start) / (end - start));
  return p * p * (3 - 2 * p);
}
function mix(from, to, p) { return from + (to - from) * p; }
function opacity(element, value) { if (element) element.style.opacity = String(unit(value)); }
function pathSampler(path) {
  const length = path.getTotalLength();
  return p => path.getPointAtLength(length * unit(p));
}
function placeToken(token, point, visibility) {
  token.setAttribute("cx", point.x);
  token.setAttribute("cy", point.y);
  opacity(token, visibility);
}
function tokenVisibility(p) { return progress(p, 0, .14) * (1 - progress(p, .82, 1)); }
function caption(root, text) {
  const element = root.querySelector("[data-motion-caption]");
  if (element.textContent !== text) element.textContent = text;
}

function createDilemmaMotion(root) {
  const supportPath = pathSampler(root.querySelector("[data-support-path]"));
  const lossPath = pathSampler(root.querySelector("[data-loss-path]"));
  const returnPath = pathSampler(root.querySelector("[data-return-path]"));
  const stores = [...root.querySelectorAll("[data-store]")];
  const resources = [...root.querySelectorAll("[data-resource-token]")];
  const losses = [...root.querySelectorAll("[data-loss-token]")];
  const reserve = [...root.querySelectorAll(".reserve-unit")];
  const lossUnits = [...root.querySelectorAll("[data-loss-unit]")];
  const pool = root.querySelector("[data-pool-graphic]");
  const shield = root.querySelector("[data-protection-shield]");
  const shieldCheck = root.querySelector(".story-shield-check");
  const returnToken = root.querySelector("[data-return-token]");
  const returnLine = root.querySelector("[data-return-path]");
  const capacity = root.querySelector("#capacity");
  shieldCheck.style.strokeDasharray = "60";
  return elapsed => {
    const t = elapsed / 1000;
    const support = progress(t, 2.4, 6);
    const protection = progress(t, 4.3, 6.2);
    opacity(pool, progress(t, .6, 1.5));
    stores.forEach((store, i) => {
      const grown = progress(t, i ? 2.1 + i * 1.3 : .85, i ? 3 + i * 1.3 : 1.65);
      opacity(store, grown);
      store.setAttribute("transform", `translate(24 73) scale(${mix(.86, 1, grown)} ${mix(.12, 1, grown)}) translate(-24 -73)`);
    });
    resources.forEach((token, i) => {
      const p = unit((t - (2.2 + i * .8)) / 1.45);
      placeToken(token, supportPath(progress(p, 0, 1)), tokenVisibility(p));
    });
    losses.forEach((token, i) => {
      const p = unit((t - (2.15 + i * 2.35)) / 1.65);
      placeToken(token, lossPath(progress(p, 0, 1) * (i ? .67 : 1)), tokenVisibility(p));
    });
    const returning = unit((t - 6.15) / 1.65);
    placeToken(returnToken, returnPath(progress(returning, 0, 1)), tokenVisibility(returning));
    opacity(returnLine, progress(t, 5.7, 6.3) * .6);
    opacity(shield, mix(.28, 1, protection));
    shield.setAttribute("transform", `scale(1 ${mix(.62, 1, protection)})`);
    shieldCheck.style.strokeDashoffset = String(60 * (1 - protection));
    const shrinking = progress(t, 5.1, 8);
    lossUnits.forEach((bar, i) => {
      bar.setAttribute("width", mix(35 - i * 5, i ? 0 : 10, shrinking));
      opacity(bar, i ? 1 - shrinking : 1);
    });
    reserve.forEach((bar, i) => opacity(bar, i > 5 ? mix(.22, .035, support) : .22));
    const value = Math.round(mix(DEMO_DATA.availableGuarantee, DEMO_DATA.constrainedGuarantee, support));
    capacity.textContent = formatter.format(value);
    capacity.dataset.value = String(value);
    root.dataset.supportLevel = String(1 + Number(t >= 4.3) + Number(t >= 5.6));
    root.dataset.lossLevel = String(3 - Number(t >= 6.5) - Number(t >= 8));
    root.dataset.motionPhase = t < 2.2 ? "resource" : t < 4.5 ? "support" : t < 8 ? "protect" : "balanced";
    caption(root, t < 2.2 ? "한정된 재원, 두 가지 목표" : t < 4.5 ? "재원이 이동하고, 지역 지원이 늘어납니다." : t < 8 ? "손실 흐름을 막고, 여력을 지킵니다." : "지원은 늘리고, 손실은 줄이고.");
  };
}

function createSignalMotion(root) {
  const line = root.querySelector("[data-region-path]");
  const sample = pathSampler(line);
  const length = line.getTotalLength();
  const regions = [...root.querySelectorAll("[data-region]")];
  const packet = root.querySelector("[data-flow-packet]");
  const tail = root.querySelector("[data-flow-tail]");
  const news = root.querySelector("[data-regional-news]");
  const newsToken = root.querySelector("[data-news-signal]");
  const newsSample = pathSampler(root.querySelector("[data-news-route]"));
  const industries = [...root.querySelectorAll("[data-industry]")].map(group => ({ group, token: group.querySelector("[data-industry-token]"), sample: pathSampler(group.querySelector("[data-industry-path]")) }));
  const fractions = [0, .237, .5, .763, 1];
  const names = ["서울", "경기", "전북", "충남", "부산"];
  line.style.strokeDasharray = String(length);
  return elapsed => {
    const t = elapsed / 1000;
    const leg = Math.max(0, Math.min(3, Math.floor((t - 1.2) / 1.4)));
    const withinLeg = progress(t, 1.2 + leg * 1.4, 2.6 + leg * 1.4);
    const p = mix(fractions[leg], fractions[leg + 1], withinLeg);
    line.style.strokeDashoffset = String(length * (1 - p));
    opacity(line, progress(t, .7, 1.25) * .75);
    placeToken(packet, sample(p), progress(t, 1, 1.3) * (1 - progress(t, 7.2, 7.6)));
    placeToken(tail, sample(Math.max(0, p - .025)), progress(t, 1.2, 1.5) * (1 - progress(t, 7.1, 7.6)) * .7);
    regions.forEach((region, i) => {
      const arrived = progress(t, 1.2 + i * 1.4 - .2, 1.2 + i * 1.4 + .35);
      const focus = Math.sin(Math.PI * unit((t - (1.2 + i * 1.4)) / .9));
      opacity(region, mix(.35, 1, arrived));
      region.querySelector(".flow-region-dot").setAttribute("r", 8 + focus * 3);
      const ring = region.querySelector(".flow-region-ring");
      ring.setAttribute("r", 18 + focus * 5);
      opacity(ring, mix(.18, .6, arrived));
    });
    const risk = progress(t, 4.2, 5.3);
    regions[2].querySelector(".flow-region-dot").style.fill = risk > .5 ? "var(--risk)" : "var(--muted)";
    regions[2].querySelector(".flow-region-ring").style.stroke = risk > .5 ? "var(--risk)" : "var(--mint)";
    opacity(regions[2].querySelector(".flow-risk-mark"), risk);
    opacity(news, progress(t, 3.25, 4.15));
    const newsP = unit((t - 4.1) / 1.2);
    placeToken(newsToken, newsSample(newsP), tokenVisibility(newsP));
    industries.forEach((item, i) => {
      opacity(item.group, progress(t, 5.1 + i * .25, 6 + i * .25));
      const branchP = unit((t - 5.3 - i * .35) / 1.6);
      placeToken(item.token, item.sample(progress(branchP, 0, 1)), tokenVisibility(branchP));
    });
    const visited = Math.max(0, Math.min(4, Math.floor((t - 1.2) / 1.4)));
    root.dataset.signalStop = names[visited];
    root.dataset.motionPhase = t < 4.2 ? "regional-flow" : t < 7.3 ? "risk-detected" : "structured-signal";
    caption(root, t < 4.2 ? "서울 → 경기 → 전북 → 충남 → 부산 · 순차 탐색" : t < 7.3 ? "전북의 신호를 발견하고, 업종별 영향을 연결합니다." : "17개 지역 신호 탐색 · 위치와 흐름은 개념도");
  };
}

function createExtractionMotion(root) {
  const documentGraphic = root.querySelector("[data-extraction-document]");
  const copy = root.querySelector("[data-news-copy]");
  const scan = root.querySelector("[data-news-scan]");
  const scanEdge = root.querySelector("[data-news-scan-edge]");
  const gate = root.querySelector("[data-extraction-gate]");
  const rows = [...root.querySelectorAll("[data-risk-row]")];
  const check = root.querySelector("[data-extraction-check]");
  const seal = root.querySelector("[data-event-seal]");
  const highlightGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  documentGraphic.insertBefore(highlightGroup, copy);
  const words = [...root.querySelectorAll("[data-extracted-word]")].map(token => {
    const row = Number(token.dataset.row);
    const sourceWord = root.querySelector(`[data-keyword="${token.dataset.extractedWord}"]`);
    const sourceBox = sourceWord.getBBox();
    const destination = rows[row].querySelector("[data-risk-value]");
    const destinationBox = destination.getBBox();
    const highlight = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    for (const [name, value] of Object.entries({ x: sourceBox.x - 4, y: sourceBox.y - 2, width: sourceBox.width + 8, height: sourceBox.height + 4, rx: 3, fill: "var(--mint)" })) highlight.setAttribute(name, value);
    highlightGroup.appendChild(highlight);
    return { token, row, sourceWord, destination, highlight, from: { x: sourceBox.x + sourceBox.width / 2 + 70, y: sourceBox.y + sourceBox.height / 2 + 21 }, to: { x: destinationBox.x + destinationBox.width / 2 + 577, y: destinationBox.y + destinationBox.height / 2 + 55 + row * 30 } };
  });
  check.style.strokeDasharray = "45";
  return elapsed => {
    const t = elapsed / 1000;
    const unfolded = progress(t, 1.1, 2.2);
    const morphed = progress(t, 6.8, 8.4);
    const x = mix(mix(280, 70, unfolded), 172, morphed);
    documentGraphic.setAttribute("transform", `translate(${x} ${mix(21, 85, morphed)}) scale(${mix(1, .42, morphed)})`);
    opacity(documentGraphic, progress(t, .5, 1.1) * (1 - morphed));
    const scanY = mix(49, 189, progress(t, 1.7, 3.5));
    scan.setAttribute("y", scanY);
    scanEdge.setAttribute("d", `M13 ${scanY}h314`);
    const scanVisible = progress(t, 1.6, 1.9) * (1 - progress(t, 3.5, 3.9));
    opacity(scan, scanVisible * .45);
    opacity(scanEdge, scanVisible);
    opacity(gate, progress(t, 2.1, 2.8) * (1 - progress(t, 7, 8.1)));
    opacity(root.querySelector("[data-extraction-path]"), progress(t, 2, 2.8) * .45);
    rows.forEach((row, i) => opacity(row, progress(t, 2.1 + i * .08, 2.7 + i * .08)));
    let extracted = 0;
    words.forEach((word, i) => {
      const start = 2.6 + i * .6;
      const p = unit((t - start) / 1.55);
      const eased = progress(p, 0, 1);
      const q = 1 - eased;
      // Cubic travel curves converge at the extraction gate before separating
      // into each destination field. This is the actual text-to-variable action.
      const wordX = q ** 3 * word.from.x + 3 * q ** 2 * eased * 430 + 3 * q * eased ** 2 * 520 + eased ** 3 * word.to.x;
      const wordY = q ** 3 * word.from.y + 3 * q ** 2 * eased * 145 + 3 * q * eased ** 2 * 129 + eased ** 3 * word.to.y;
      word.token.setAttribute("transform", `translate(${wordX} ${wordY}) scale(${mix(1, .94, eased)})`);
      opacity(word.token, tokenVisibility(p));
      opacity(word.sourceWord, 1 - .88 * progress(t, start, start + .3));
      opacity(word.highlight, progress(t, start - .35, start) * .75);
      opacity(word.destination, progress(t, start + 1.2, start + 1.55));
      if (p === 1) extracted++;
    });
    opacity(rows[5].querySelector("[data-risk-value]"), progress(t, 6.6, 7.3));
    opacity(rows[6].querySelector("[data-risk-value]"), progress(t, 7, 7.7));
    const verified = progress(t, 7.3, 8.1);
    opacity(check, verified);
    check.style.strokeDashoffset = String(45 * (1 - verified));
    opacity(seal, progress(t, 7.5, 8.6));
    seal.setAttribute("transform", `translate(244 133) scale(${mix(.7, 1, progress(t, 7.5, 8.6))})`);
    root.dataset.extractedCount = String(extracted);
    root.dataset.motionPhase = t < 1.7 ? "news" : t < 3.5 ? "scan" : t < 6.6 ? "extract" : t < 8.4 ? "compile" : "risk-event";
    caption(root, t < 1.7 ? "한 장의 뉴스에서 출발합니다." : t < 3.5 ? "문장 속 지역 · 사건 · 기간을 읽습니다." : t < 6.6 ? "핵심 정보가 분리되어 변수로 이동합니다." : t < 8.4 ? "영향과 신뢰도를 연결하고 위험 변수로 변환합니다." : "뉴스 → 구조화된 Risk Event · DEMO SIMULATION");
  };
}

function startSceneEffects() {
  if (state.index < 3) {
    const root = elements.host.querySelector(".scene:not(.is-leaving)");
    const createMotion = [createDilemmaMotion, createSignalMotion, createExtractionMotion][state.index];
    storyMotion = { elapsed: 0, update: createMotion(root) };
    storyMotion.update(state.reducedMotion ? 10000 : 0);
  }
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
    ["지역의 변화에서 위험 신호를 발견", ["서울 → 경기 → 전북 → 충남 → 부산의 지역 신호를 순차 탐색합니다.", `가상 뉴스: ${DEMO_DATA.news.region} 주요 제조사업장 ${DEMO_DATA.news.months}개월 생산중단`, "전북의 제조업과 운송·음식·숙박업에 영향이 퍼집니다. 위치와 탐색 경로는 개념도입니다."]],
    ["뉴스를 구조화된 Risk Event로 변환", ["기사 속 단어를 읽고, 분리하고, 각각의 위험 변수로 옮깁니다.", `${DEMO_DATA.news.region} · ${DEMO_DATA.news.event} · ${DEMO_DATA.news.months}개월`, "직접 영향: 제조업 / 2차 영향: 운송·음식·숙박", `추출 신뢰도 ${DEMO_DATA.news.confidence}% (가상 예시)`]],
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
  if (storyMotion && !document.hidden && !state.reducedMotion) {
    storyMotion.elapsed = Math.min(storyMotion.elapsed + delta, 10000);
    storyMotion.update(storyMotion.elapsed);
  }
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
