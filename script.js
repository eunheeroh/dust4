// Vercel 서버리스 함수 엔드포인트 경로
const API_URL = "/api/dust";

// DOM 엘리먼트 참조: 시·도 선택 드롭다운
const sidoSelect = document.getElementById("sidoSelect");
// DOM 엘리먼트 참조: 신호등 전체 섹션
const trafficSection = document.getElementById("trafficSection");
// DOM 엘리먼트 참조: 대표 지역명
const trafficRegion = document.getElementById("trafficRegion");
// DOM 엘리먼트 참조: 신호등 이모지 (🔵🟢🟠🔴)
const trafficEmoji = document.getElementById("trafficEmoji");
// DOM 엘리먼트 참조: 대표 상태 텍스트 (좋음/보통/나쁨/매우나쁨)
const trafficStatus = document.getElementById("trafficStatus");
// DOM 엘리먼트 참조: 평균 미세먼지 수치
const trafficValue = document.getElementById("trafficValue");
// DOM 엘리먼트 참조: 한 줄 안내 문구
const trafficGuide = document.getElementById("trafficGuide");
// DOM 엘리먼트 참조: 대표 기준 측정 시각
const trafficTime = document.getElementById("trafficTime");
// DOM 엘리먼트 참조: 로딩 및 안내 메시지 컨테이너
const statusMessage = document.getElementById("statusMessage");
// DOM 엘리먼트 참조: 상태 텍스트
const statusText = document.getElementById("statusText");
// DOM 엘리먼트 참조: 차트 섹션 컨테이너
const chartSection = document.getElementById("chartSection");
// DOM 엘리먼트 참조: 차트 캔버스 엘리먼트
const dustChartCanvas = document.getElementById("dustChart");
// DOM 엘리먼트 참조: 집계된 측정소 개수
const stationCount = document.getElementById("stationCount");
// DOM 엘리먼트 참조: 측정소 카드 목록 그리드
const cardGrid = document.getElementById("cardGrid");

// Chart.js 인스턴스를 관리할 전역 변수
let dustChartInstance = null;

// 페이지가 처음 열리면 드롭다운의 기본값(서울)으로 데이터 조회 시작
window.addEventListener("DOMContentLoaded", () => {
  fetchAirQuality(sidoSelect.value);
});

// 사용자가 시·도 드롭다운을 변경했을 때 새로운 지역 데이터 조회
sidoSelect.addEventListener("change", (e) => {
  fetchAirQuality(e.target.value);
});

// 에어코리아 API를 호출하고 화면을 갱신하는 비동기 함수
async function fetchAirQuality(sidoName) {
  // 로딩 시작 시 신호등 영역을 '불러오는 중...' 상태로 초기화
  setLoadingState(sidoName);

  try {
    // Vercel 서버리스 함수 호출 (/api/dust?sido=지역명)
    const response = await fetch(`${API_URL}?sido=${encodeURIComponent(sidoName)}`);
    const data = await response.json();

    // 서버 오류 또는 API 예외 응답인 경우 에러 처리
    if (!response.ok || data.error) {
      throw new Error(data.error || `서버 오류 (상태 코드: ${response.status})`);
    }

    // 측정소 목록(items) 추출
    const items = data.response?.body?.items || [];

    // 조회된 데이터가 비어있는 경우 안내 처리
    if (items.length === 0) {
      showEmptyState(sidoName);
      return;
    }

    // 로딩 인디케이터 숨기기
    statusMessage.style.display = "none";

    // 1. 그 지역의 대표 평균 미세먼지 수치 및 신호등 상태 갱신
    updateTrafficHero(sidoName, items);

    // 2. 미세먼지 상위 10개 가로 막대그래프 렌더링
    renderTop10Chart(items);

    // 3. 각 측정소별 카드 목록을 은은한 등급 색상으로 렌더링
    renderStationCards(items);

  } catch (error) {
    // 오류 발생 시 콘솔 로그 출력 및 사용자 안내 메시지 표시
    console.error("데이터 조회 오류:", error);
    showErrorState(error.message);
  }
}

// 데이터를 불러오는 동안 화면을 '불러오는 중...' 상태로 설정하는 함수
function setLoadingState(sidoName) {
  // 대표 지역명 갱신
  trafficRegion.textContent = sidoName;
  // 신호등 섹션 클래스 초기화
  trafficSection.className = "traffic-section traffic-unknown";
  // 이모지를 모래시계로 변경
  trafficEmoji.textContent = "⏳";
  // 상태 텍스트를 '불러오는 중...'으로 변경
  trafficStatus.textContent = "불러오는 중...";
  // 평균 수치 초기화
  trafficValue.textContent = "-";
  // 안내 문구 설정
  trafficGuide.textContent = `${sidoName} 지역의 실시간 대기 정보를 불러오는 중입니다...`;
  // 기준 시각 초기화
  trafficTime.textContent = "-";
  // 측정소 개수 비우기
  stationCount.textContent = "";
  // 카드 목록 비우기
  cardGrid.innerHTML = "";
  // 기존 차트 인스턴스 파괴
  if (dustChartInstance) {
    dustChartInstance.destroy();
    dustChartInstance = null;
  }
  // 차트 영역 숨기기
  chartSection.style.display = "none";
  // 로딩 스피너 및 메시지 표시
  statusMessage.style.display = "flex";
  statusText.textContent = "최신 대기오염 정보를 불러오는 중...";
}

// 데이터가 없을 때의 화면 처리 함수
function showEmptyState(sidoName) {
  trafficSection.className = "traffic-section traffic-unknown";
  trafficEmoji.textContent = "⚪";
  trafficStatus.textContent = "정보 없음";
  trafficValue.textContent = "-";
  trafficGuide.textContent = `${sidoName} 지역에 조회 가능한 측정 데이터가 없습니다.`;
  chartSection.style.display = "none";
  statusMessage.style.display = "flex";
  statusText.textContent = "측정 데이터가 없습니다.";
}

// 에러 발생 시의 화면 처리 함수
function showErrorState(message) {
  trafficSection.className = "traffic-section traffic-unknown";
  trafficEmoji.textContent = "⚠️";
  trafficStatus.textContent = "불러오기 실패";
  trafficValue.textContent = "-";
  trafficGuide.textContent = "대기오염 정보를 불러오지 못했습니다. 네트워크 또는 키 설정을 확인해주세요.";
  chartSection.style.display = "none";
  statusMessage.style.display = "flex";
  statusText.textContent = message || "오류가 발생했습니다.";
}

// 그 지역의 대표 신호등(이모지, 상태 문구, 평균 수치, 안내 문구)을 계산하고 표시하는 함수
function updateTrafficHero(sidoName, items) {
  // 유효한 미세먼지 수치를 담을 배열
  const validValues = [];
  // 최신 측정 시각을 담을 변수
  let latestTime = "";

  // 측정소 목록을 순회하며 유효한 수치와 최신 측정 시각 수집
  items.forEach((item) => {
    const raw = item.pm10Value;
    if (raw && raw !== "-" && !isNaN(Number(raw))) {
      validValues.push(Number(raw));
    }
    // 유효한 측정 시각 기록
    if (item.dataTime && !latestTime) {
      latestTime = item.dataTime;
    }
  });

  // 유효한 측정값이 전혀 없을 때의 처리
  if (validValues.length === 0) {
    trafficSection.className = "traffic-section traffic-unknown";
    trafficEmoji.textContent = "⚪";
    trafficStatus.textContent = "측정 안 됨";
    trafficValue.textContent = "측정 안 됨";
    trafficGuide.textContent = "현재 집계 가능한 미세먼지 데이터가 없습니다.";
    trafficTime.textContent = formatKoreanTime(latestTime);
    stationCount.textContent = `총 ${items.length}개소 (데이터 없음)`;
    return;
  }

  // 평균 미세먼지 수치 계산 (반올림 소수 첫째 자리)
  const sum = validValues.reduce((acc, cur) => acc + cur, 0);
  const avg = Math.round((sum / validValues.length) * 10) / 10;

  // 한국 환경부 미세먼지(PM10) 기준에 따른 등급 및 신호등 테마 산출
  let emoji = "🟢";
  let statusTextValue = "보통";
  let themeClass = "traffic-normal";
  let guideText = "공기 질이 무난한 날이에요 🌿";

  if (avg <= 30) {
    emoji = "🔵";
    statusTextValue = "좋음";
    themeClass = "traffic-good";
    guideText = "공기가 깨끗해요! 안심하고 환기하세요 😊";
  } else if (avg <= 80) {
    emoji = "🟢";
    statusTextValue = "보통";
    themeClass = "traffic-normal";
    guideText = "공기 질이 무난한 날이에요 🌿";
  } else if (avg <= 150) {
    // 나쁨 이상 조건: '외출 시 마스크를 챙기세요'
    emoji = "🟠";
    statusTextValue = "나쁨";
    themeClass = "traffic-bad";
    guideText = "외출 시 마스크를 챙기세요 😷";
  } else {
    // 매우나쁨 조건: '외출 시 마스크를 챙기세요'
    emoji = "🔴";
    statusTextValue = "매우나쁨";
    themeClass = "traffic-verybad";
    guideText = "외출 시 마스크를 챙기세요 😷 (야외 활동 자제 권장)";
  }

  // 신호등 섹션 테마 클래스 적용 (파랑/초록/주황/빨강)
  trafficSection.className = `traffic-section ${themeClass}`;
  // 대표 신호등 이모지 표시
  trafficEmoji.textContent = emoji;
  // 대표 상태 텍스트 표시
  trafficStatus.textContent = statusTextValue;
  // 평균 미세먼지 수치 크게 표시 (단위 포함)
  trafficValue.textContent = `${avg} ㎍/㎥`;
  // 한 줄 안내 문구 표시
  trafficGuide.textContent = guideText;
  // 한국어 측정 시각 표시
  trafficTime.textContent = formatKoreanTime(latestTime);
  // 측정소 개수 안내 표시
  stationCount.textContent = `총 ${items.length}개 측정소 중 ${validValues.length}개 집계`;
}

// Chart.js를 사용해 미세먼지 상위 10개 측정소 가로 막대그래프를 렌더링하는 함수
function renderTop10Chart(items) {
  // 1. '측정 안 됨'(-) 및 유효하지 않은 측정소를 필터링하여 제외
  const validItems = items.filter((item) => {
    const val = item.pm10Value;
    return val && val !== "-" && !isNaN(Number(val));
  });

  // 유효한 데이터가 없을 경우 차트 섹션 숨기기
  if (validItems.length === 0) {
    chartSection.style.display = "none";
    return;
  }

  // 차트 섹션 표시
  chartSection.style.display = "block";

  // 2. 미세먼지 수치가 높은 순(내림차순)으로 정렬하고 상위 10개만 추출
  const top10 = validItems
    .sort((a, b) => Number(b.pm10Value) - Number(a.pm10Value))
    .slice(0, 10);

  // 차트 라벨(측정소 이름) 배열 생성
  const labels = top10.map((item) => item.stationName || "측정소");
  // 차트 수치(미세먼지 농도) 배열 생성
  const values = top10.map((item) => Number(item.pm10Value));

  // 3. 각 측정소의 등급 색상과 동일하게 막대 색상 배열 매핑
  const backgroundColors = top10.map((item) => getChartColor(item.pm10Grade, Number(item.pm10Value)).bg);
  const borderColors = top10.map((item) => getChartColor(item.pm10Grade, Number(item.pm10Value)).border);

  // 기존에 그려진 차트가 있다면 메모리 누수 및 중복 방지를 위해 파괴
  if (dustChartInstance) {
    dustChartInstance.destroy();
  }

  // 4. 가로 막대그래프(indexAxis: 'y') 생성
  const ctx = dustChartCanvas.getContext("2d");
  dustChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "미세먼지(PM10) ㎍/㎥",
          data: values,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 8,
          barPercentage: 0.7,
        },
      ],
    },
    options: {
      indexAxis: "y", // 가로 막대그래프 설정
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false, // 단일 항목이므로 범례 숨김
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return ` ${context.raw} ㎍/㎥`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
          },
          title: {
            display: true,
            text: "농도 (㎍/㎥)",
            color: "#6b7280",
            font: {
              size: 11,
              weight: "600",
            },
          },
        },
        y: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              family: "'Pretendard', sans-serif",
              size: 12,
              weight: "700",
            },
            color: "#1f2937",
          },
        },
      },
    },
  });
}

// 등급 코드 또는 수치에 따라 차트 막대 색상(배경색 및 테두리색)을 반환하는 함수
function getChartColor(grade, value) {
  // 1: 좋음 (파랑)
  if (grade === "1" || value <= 30) {
    return { bg: "rgba(59, 130, 246, 0.75)", border: "#2563eb" };
  }
  // 2: 보통 (초록)
  if (grade === "2" || value <= 80) {
    return { bg: "rgba(34, 197, 94, 0.75)", border: "#16a34a" };
  }
  // 3: 나쁨 (주황)
  if (grade === "3" || value <= 150) {
    return { bg: "rgba(249, 115, 22, 0.75)", border: "#ea580c" };
  }
  // 4: 매우나쁨 (빨강)
  return { bg: "rgba(239, 68, 68, 0.75)", border: "#dc2626" };
}

// 각 측정소별 카드를 은은한 등급 테마로 렌더링하는 함수
function renderStationCards(items) {
  cardGrid.innerHTML = "";

  items.forEach((item) => {
    const stationName = item.stationName || "측정소";
    const pm10Display = formatValue(item.pm10Value);
    const pm25Display = formatValue(item.pm25Value);
    const koreanTime = formatKoreanTime(item.dataTime);

    // 등급 정보 가져오기 (1: 좋음, 2: 보통, 3: 나쁨, 4: 매우나쁨)
    const { cardClass, badgeEmoji, badgeLabel } = getGradeDetail(item.pm10Grade);

    // 카드 요소 생성
    const card = document.createElement("div");
    // 등급 색이 테두리와 배경에 은은하게 반영되는 클래스 부여
    card.className = `station-card ${cardClass}`;

    // 카드 내부 구조 생성
    card.innerHTML = `
      <div class="card-header">
        <span class="station-name">${stationName}</span>
        <span class="grade-badge">${badgeEmoji} ${badgeLabel}</span>
      </div>
      <div class="info-row">
        <span class="info-label">미세먼지(PM10)</span>
        <span class="info-value">${pm10Display}</span>
      </div>
      <div class="info-row">
        <span class="info-label">초미세먼지(PM2.5)</span>
        <span class="info-value">${pm25Display}</span>
      </div>
      <div class="card-time">${koreanTime}</div>
    `;

    cardGrid.appendChild(card);
  });
}

// 측정 시각을 '2026년 10월 28일 16시 기준'처럼 한국어로 변환하는 함수
function formatKoreanTime(rawDateTime) {
  if (!rawDateTime || typeof rawDateTime !== "string") {
    return "측정 시각 정보 없음";
  }

  // 공공데이터포털 형식: "YYYY-MM-DD HH:mm" 또는 "YYYY-MM-DD HH:mm:ss"
  const regex = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/;
  const match = rawDateTime.trim().match(regex);

  if (match) {
    const year = match[1];
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    return `${year}년 ${month}월 ${day}일 ${hour}시 기준`;
  }

  // 매칭되지 않을 경우 원본 뒤에 '기준'을 붙여 반환
  return `${rawDateTime} 기준`;
}

// 수치 값이 "-" 이거나 유효하지 않을 때 "측정 안 됨" 처리하는 함수
function formatValue(value) {
  if (!value || value === "-") {
    return "측정 안 됨";
  }
  return `${value} ㎍/㎥`;
}

// 등급 코드(1~4)에 따라 은은한 카드 테마와 배지 정보를 반환하는 함수
function getGradeDetail(grade) {
  switch (grade) {
    case "1":
      return { cardClass: "card-good", badgeEmoji: "🔵", badgeLabel: "좋음" };
    case "2":
      return { cardClass: "card-normal", badgeEmoji: "🟢", badgeLabel: "보통" };
    case "3":
      return { cardClass: "card-bad", badgeEmoji: "🟠", badgeLabel: "나쁨" };
    case "4":
      return { cardClass: "card-verybad", badgeEmoji: "🔴", badgeLabel: "매우나쁨" };
    default:
      return { cardClass: "card-unknown", badgeEmoji: "⚪", badgeLabel: "정보 없음" };
  }
}
