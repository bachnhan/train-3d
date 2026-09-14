// Localization strings for Tokyo 3D Diorama & Multi-Vehicle Simulation

const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
export const lang = urlParams.get("lang") === "en" ? "en" : "ja";

export function getLocalizedText(str) {
  if (!str) return "";
  if (typeof str === "object") {
    return str[lang] || str["ja"] || "";
  }
  if (typeof str === "string") {
    const parts = str.split(" / ");
    if (lang === "en" && parts[1]) return parts[1];
    return parts[0];
  }
  return String(str);
}

export function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const TRANSLATIONS = {
  ja: {
    diorama: {
      title: "Tokyo 3D ジオラマ",
      eyebrow: "TOKYO URBAN DIORAMA · MULTI-VEHICLE SIMULATION",
      hudTitle: "Tokyo 3D ジオラマ",
      hudSubtitle: "TOKYO URBAN DIORAMA · MULTI-VEHICLE SIMULATION",
      camera: "カメラ視点",
      explore: "エリア・主要スポット",
      landmarks: {
        shibuya: { domain: "SHIBUYA", name: "渋谷スクランブル", caption: "世界的に有名なスクランブル交差点と高密度な商業街区。" },
        namikibashi: { domain: "NAMIKIBASHI", name: "並木橋・渋谷川", caption: "緑の鉄橋が道路と渋谷川を跨ぐ、歴史ある都市水脈の要所。" },
        address: { domain: "DAIKANYAMA", name: "代官山アドレス", caption: "旧車両基地跡に建設された高さ120m・36階建てのシンボルタワー。" },
        daikanyama: { domain: "DAIKANYAMA", name: "代官山エリア", caption: "洗練されたブティックやカフェが建ち並ぶ閑静な丘陵街区。" }
      },
      weather: "天候環境",
      weathers: {
        clear: "晴天",
        sunset: "夕暮れ",
        night: "夜景",
        rain: "雨天",
        snow: "降雪",
        storm: "雷雨"
      },
      vehiclesLabel: "モビリティ追跡",
      vehicles: {
        train: "2026系 電車",
        plane: "旅客機 羽田便",
        boat: "渋谷川 巡回艇",
        bus: "都バス 渋72",
        taxi: "個人タクシー"
      },
      lightning: "落雷発生",
      speed: "シミュレーション速度",
      hint: "ドラッグで見回す · スクロールでズーム",
      loading: "3D都市ジオラマを構築中…",
      pause: "一時停止",
      resume: "シミュレーション再開",
      soundOn: "音声オン",
      soundOff: "音声オフ",
      cameras: {
        room: "俯瞰", layout: "広域", trackside: "沿道視点",
        locomotive: "周回", follow: "追跡", cab: "搭乗視点",
        orbit: "周回", cockpit: "搭乗視点"
      }
    }
  },
  en: {
    diorama: {
      title: "Tokyo 3D Diorama",
      eyebrow: "TOKYO URBAN DIORAMA · MULTI-VEHICLE SIMULATION",
      hudTitle: "Tokyo 3D Diorama",
      hudSubtitle: "TOKYO URBAN DIORAMA · MULTI-VEHICLE SIMULATION",
      camera: "Camera View",
      explore: "Areas & Landmarks",
      landmarks: {
        shibuya: { domain: "SHIBUYA", name: "Shibuya Scramble", caption: "World-famous pedestrian crossing and dense commercial district." },
        namikibashi: { domain: "NAMIKIBASHI", name: "Namikibashi & Shibuya River", caption: "Historic green iron bridge spanning urban waterways." },
        address: { domain: "DAIKANYAMA", name: "Daikanyama Address", caption: "120m 36-storey residential landmark tower." },
        daikanyama: { domain: "DAIKANYAMA", name: "Daikanyama Hillside", caption: "Sophisticated boutique shopping and leafy promenade district." }
      },
      weather: "Atmosphere & Weather",
      weathers: {
        clear: "Clear",
        sunset: "Sunset",
        night: "Night",
        rain: "Rain",
        snow: "Snow",
        storm: "Storm"
      },
      vehiclesLabel: "Vehicle Tracking",
      vehicles: {
        train: "Series 2026 Train",
        plane: "Airliner Haneda",
        boat: "Shibuya Canal Patrol",
        bus: "Tokyo City Bus 72",
        taxi: "Tokyo Crown Taxi"
      },
      lightning: "Lightning Trigger",
      speed: "Simulation Speed",
      hint: "Drag to look around · Scroll to zoom",
      loading: "Building 3D Urban Diorama…",
      pause: "Pause Simulation",
      resume: "Resume Simulation",
      soundOn: "Sound On",
      soundOff: "Sound Off",
      cameras: {
        room: "Overhead", layout: "Wide Corridor", trackside: "Roadside",
        locomotive: "Orbit", follow: "Follow", cab: "Cab View",
        orbit: "Orbit", cockpit: "Cockpit"
      }
    }
  }
};

// Automatic DOM i18n text interpolation
if (typeof document !== "undefined") {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (TRANSLATIONS[lang]?.diorama?.[key]) {
      el.textContent = TRANSLATIONS[lang].diorama[key];
    }
  });
}
