import { STATIONS } from "../stations.js";
import { TRANSLATIONS, getLocalizedText, lang } from "../translations.js";

const $ = (id) => document.getElementById(id);
const text = TRANSLATIONS[lang].diorama || TRANSLATIONS[lang].demo3d;

function updateSvgUse(containerSelector, iconId) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  const useEl = container.querySelector("use");
  if (useEl) {
    useEl.setAttribute("href", iconId);
    useEl.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", iconId);
  }
}

export function initializeHud({
  cameraController,
  trainController,
  weatherController,
  trafficController,
  sound,
  onVehicleFocus,
  onStationFocus,
  onLandmarkFocus
}) {
  document.documentElement.lang = lang;

  // 1. Text internationalization
  document.querySelectorAll("[data-i18n], [data-demo-i18n]").forEach((element) => {
    const key = element.dataset.i18n || element.dataset.demoI18n;
    if (text[key]) {
      element.textContent = text[key];
    }
  });

  // Weather button labels
  document.querySelectorAll("[data-weather-label]").forEach((el) => {
    const w = el.dataset.weatherLabel;
    if (text.weathers?.[w]) el.textContent = text.weathers[w];
  });

  // Vehicle button labels
  document.querySelectorAll("[data-vehicle-label]").forEach((el) => {
    const v = el.dataset.vehicleLabel;
    if (text.vehicles?.[v]) el.textContent = text.vehicles[v];
  });

  // 2. Weather Preset Buttons
  const lightningBtn = $("lightning-button");
  document.querySelectorAll("[data-weather]").forEach((button) => {
    const preset = button.dataset.weather;
    button.addEventListener("click", () => {
      if (weatherController) weatherController.setWeather(preset);
      document.querySelectorAll("[data-weather]").forEach((b) => b.classList.toggle("active", b === button));

      // Show lightning trigger when in Storm mode
      if (lightningBtn) {
        lightningBtn.style.display = preset === "storm" ? "inline-flex" : "none";
      }

      // Update weather chip icon & label without emojis
      updateSvgUse("#weather-chip", `#icon-${preset}`);
      const wChipText = $("weather-chip-text");
      if (wChipText) {
        wChipText.textContent = text.weathers?.[preset] || preset;
      }
    });
  });

  // Lightning Trigger Button (keeps inline SVG)
  if (lightningBtn) {
    lightningBtn.addEventListener("click", () => {
      if (weatherController) {
        weatherController.triggerLightning();
      }
    });
  }

  // 3. Dynamic Vehicle Lock-On Buttons
  document.querySelectorAll("[data-vehicle]").forEach((button) => {
    const vehicleKey = button.dataset.vehicle;
    button.addEventListener("click", () => {
      if (cameraController) cameraController.setTargetVehicle(vehicleKey);
      if (onVehicleFocus) onVehicleFocus(vehicleKey);
      document.querySelectorAll("[data-vehicle]").forEach((b) => b.classList.toggle("active", b === button));
      document.querySelectorAll("[data-landmark]").forEach((b) => b.classList.remove("active"));

      // Sync camera button state to follow mode
      document.querySelectorAll("[data-camera]").forEach((b) => {
        b.classList.toggle("active", b.dataset.camera === "follow");
      });

      // Update vehicle chip icon & label without emojis
      updateSvgUse("#vehicle-chip", `#icon-${vehicleKey}`);
      const vChipText = $("vehicle-chip-text");
      if (vChipText) {
        vChipText.textContent = text.vehicles?.[vehicleKey] || vehicleKey;
      }
    });
  });

  // 4. Camera View Buttons
  document.querySelectorAll("[data-camera]").forEach((button) => {
    const view = button.dataset.camera;
    button.textContent = text.cameras[view] || view;
    button.addEventListener("click", () => {
      cameraController.setView(view);
      document.querySelectorAll("[data-camera]").forEach((item) => item.classList.toggle("active", item === button));
      if (view === "room" || view === "layout") {
        document.querySelectorAll("[data-vehicle]").forEach((b) => b.classList.remove("active"));
      }
    });
  });

  // 5. Landmark Buttons
  document.querySelectorAll("[data-landmark]").forEach((button) => {
    const key = button.dataset.landmark;
    const info = text.landmarks?.[key];
    if (info) {
      const span = button.querySelector("span");
      if (span) span.textContent = info.name;
    }
    button.addEventListener("click", () => {
      cameraController.focusLandmark(key);
      if (onLandmarkFocus) onLandmarkFocus(key);
      else if (onStationFocus) onStationFocus(key === "daikanyama" ? 1 : 0);
      document.querySelectorAll("[data-camera]").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll("[data-landmark]").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll("[data-vehicle]").forEach((item) => item.classList.remove("active"));
    });
  });

  // 6. Simulation & Audio Controls
  const pauseButton = $("pause-toggle");
  const updatePauseState = (isPaused) => {
    if (!pauseButton) return;
    updateSvgUse("#pause-toggle", isPaused ? "#icon-play" : "#icon-pause");
    pauseButton.setAttribute("aria-label", isPaused ? text.resume : text.pause);
    pauseButton.classList.toggle("active", isPaused);
  };

  if (pauseButton) {
    pauseButton.addEventListener("click", () => {
      trainController.state.paused = !trainController.state.paused;
      updatePauseState(trainController.state.paused);
    });
  }

  const speedControl = $("speed-control");
  if (speedControl) {
    speedControl.addEventListener("input", (event) => {
      trainController.state.speed = Number(event.target.value) * 0.27;
      trainController.state.paused = Number(event.target.value) === 0;
      updatePauseState(trainController.state.paused);
    });
  }

  const soundToggle = $("sound-toggle");
  if (soundToggle) {
    soundToggle.setAttribute("aria-label", text.soundOff);
    soundToggle.addEventListener("click", async (event) => {
      trainController.state.soundEnabled = !trainController.state.soundEnabled;
      soundToggle.classList.toggle("enabled", trainController.state.soundEnabled);
      soundToggle.setAttribute("aria-label", trainController.state.soundEnabled ? text.soundOn : text.soundOff);
      if (trainController.state.soundEnabled) {
        await sound.unlock();
        if (weatherController?.getWeatherState().isRain) {
          sound.startRain(weatherController.getWeatherState().isStorm);
        }
      } else {
        sound.stopRain();
      }
    });
  }

  // 7. Zen / Cinematic Mode Toggle
  const zenToggle = $("zen-toggle");
  const restoreBtn = $("hud-restore-btn");

  const toggleZenMode = () => {
    document.body.classList.toggle("hud-hidden");
  };

  if (zenToggle) {
    zenToggle.addEventListener("click", toggleZenMode);
  }

  if (restoreBtn) {
    restoreBtn.addEventListener("click", () => {
      document.body.classList.remove("hud-hidden");
    });
  }

  window.addEventListener("keydown", (event) => {
    if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") return;
    if (event.key === "h" || event.key === "H") {
      toggleZenMode();
    } else if (event.key === "m" || event.key === "M") {
      soundToggle?.click();
    } else if (["1", "2", "3", "4", "5", "6"].includes(event.key)) {
      const cameraViews = {
        "1": "follow",
        "2": "cab",
        "3": "locomotive",
        "4": "trackside",
        "5": "room",
        "6": "layout"
      };
      const view = cameraViews[event.key];
      const targetBtn = document.querySelector(`[data-camera="${view}"]`);
      if (targetBtn) targetBtn.click();
    }
  });
}

export function updateEnvironmentCard({
  targetVehicle = "train",
  domain = "SURFACE MOBILITY",
  name = "2026系 通勤列車",
  caption = "2026系 · 10両編成 高架線走行",
  speed = "45 km/h",
  location = "渋谷〜代官山",
  weather = "clear"
} = {}) {
  const domainEl = $("domain-badge");
  const nameEl = $("station-name");
  const captionEl = $("station-caption");
  const speedEl = $("telemetry-speed");
  const posEl = $("telemetry-pos");
  const vChipText = $("vehicle-chip-text");
  const wChipText = $("weather-chip-text");

  if (domainEl) domainEl.textContent = domain;
  if (nameEl) nameEl.textContent = name;
  if (captionEl) captionEl.textContent = caption;
  if (speedEl) speedEl.textContent = speed;
  if (posEl) posEl.textContent = location;

  updateSvgUse("#vehicle-chip", `#icon-${targetVehicle}`);
  if (vChipText) {
    vChipText.textContent = text.vehicles?.[targetVehicle] || targetVehicle;
  }

  updateSvgUse("#weather-chip", `#icon-${weather}`);
  if (wChipText) {
    wChipText.textContent = text.weathers?.[weather] || weather;
  }
}

export function updateLandmarkCard(key, direction) {
  const info = text.landmarks?.[key];
  if (!info) {
    if (typeof key === "number") return updateStationCard(key, direction);
    return;
  }
  const domainEl = $("domain-badge");
  const nameEl = $("station-name");
  const captionEl = $("station-caption");
  const posEl = $("telemetry-pos");
  const speedEl = $("telemetry-speed");

  if (domainEl) domainEl.textContent = info.domain || "DISTRICT LANDMARK";
  if (nameEl) nameEl.textContent = info.name;
  if (captionEl) captionEl.textContent = info.caption;
  if (posEl) posEl.textContent = info.name;
  if (speedEl) speedEl.textContent = "—";
}

export function updateStationCard(index, direction) {
  const key = index === 0 ? "shibuya" : "daikanyama";
  const info = text.landmarks?.[key];
  if (info) {
    updateLandmarkCard(key, direction);
    return;
  }
  const station = STATIONS[index];
  if (!station) return;
  const domainEl = $("domain-badge");
  const nameEl = $("station-name");
  const captionEl = $("station-caption");
  const posEl = $("telemetry-pos");

  if (domainEl) domainEl.textContent = "RAIL TRANSIT";
  if (nameEl) nameEl.textContent = getLocalizedText(station.name);
  if (captionEl) captionEl.textContent = station.character || "Heritage Station";
  if (posEl) posEl.textContent = `${station.code} · ${getLocalizedText(station.name)}`;
}
