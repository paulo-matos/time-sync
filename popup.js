import { TIMEZONE_DATA } from "./timezones.js";

// Timezone Clock Extension
class TimezoneClockApp {
  constructor() {
    this.use24HourFormat = true;
    this.timezones = [];
    this.currentTime = null;
    this.isEditing = false;
    this.editedTime = null;
    this.updateInterval = null;
    this.dayNightCache = new Map();
    this.editingName = false;

    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();

    // If no saved timezones, add local one and persist it
    if (this.timezones.length === 0) {
      this.addLocalTimezone();
      await this.saveSettings(); // ✅ persist
    }

    await this.loadSavedTimezones();
    this.startUpdating();
  }

  async loadSettings() {
    const result = await chrome.storage.local.get([
      "use24HourFormat",
      "timezones",
    ]);
    this.use24HourFormat =
      result.use24HourFormat !== undefined ? result.use24HourFormat : true;
    this.timezones = result.timezones || [];
    this.updateFormatToggle();
  }

  async saveSettings() {
    await chrome.storage.local.set({
      use24HourFormat: this.use24HourFormat,
      timezones: this.timezones,
    });
  }

  setupEventListeners() {
    document.getElementById("formatToggle").addEventListener("click", () => {
      this.toggleFormat();
    });

    document.getElementById("resetBtn").addEventListener("click", () => {
      this.resetToCurrentTime();
    });

    const searchInput = document.getElementById("timezoneSearch");
    searchInput.addEventListener("input", (e) => {
      this.handleSearch(e.target.value);
    });

    searchInput.addEventListener("blur", () => {
      setTimeout(() => this.hideSearchResults(), 200);
    });

    // Handle enter key in search
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const results = document.querySelectorAll(".search-result");
        if (results.length > 0) {
          results[0].click();
        }
      }
    });
  }

  addLocalTimezone() {
    const localTimezone = luxon.DateTime.now().zoneName;
    if (!this.timezones.find((tz) => tz.zone === localTimezone)) {
      this.timezones.unshift({
        zone: localTimezone,
        isLocal: true,
        customName: null,
      });
    }
  }

  async loadSavedTimezones() {
    this.renderClocks();
  }

  toggleFormat() {
    this.use24HourFormat = !this.use24HourFormat;
    this.updateFormatToggle();
    this.saveSettings();
    this.renderClocks();
  }

  updateFormatToggle() {
    const btn = document.getElementById("formatToggle");
    btn.textContent = this.use24HourFormat ? "24H" : "12H";
  }

  resetToCurrentTime() {
    this.isEditing = false;
    this.editedTime = null;
    this.currentTime = luxon.DateTime.now();
    this.renderClocks();
  }

  startUpdating() {
    this.currentTime = luxon.DateTime.now();
    this.renderClocks();

    this.updateInterval = setInterval(() => {
      if (!this.isEditing && !this.editingName) {
        this.currentTime = luxon.DateTime.now();
        this.renderClocks();
      }
    }, 1000);
  }

  async handleSearch(query) {
    if (!query.trim()) {
      this.hideSearchResults();
      return;
    }

    const resultsContainer = document.getElementById("searchResults");

    // Show spinner while fetching
    resultsContainer.innerHTML = `<div class="spinner">Loading…</div>`;
    resultsContainer.classList.remove("hidden");

    const suggestions = await this.getTimezoneSuggestions(query); // ✅ await

    this.showSearchResults(suggestions);
  }

  async getTimezoneSuggestions(query) {
    if (!query.trim()) return [];

    const queryLower = query.toLowerCase();
    const results = [];

    for (const tz of TIMEZONE_DATA) {
      // Match zone, display, or aliases
      const matchesZone = tz.zone.toLowerCase().includes(queryLower);
      const matchesDisplay = tz.display.toLowerCase().includes(queryLower);
      const matchesAlias =
        tz.aliases &&
        tz.aliases.some((a) => a.toLowerCase().includes(queryLower));

      if (matchesZone || matchesDisplay || matchesAlias) {
        results.push(tz);
      }
    }

    return results.slice(0, 8);
  }

  showSearchResults(suggestions) {
    const resultsContainer = document.getElementById("searchResults");

    if (suggestions.length === 0) {
      this.hideSearchResults();
      return;
    }

    resultsContainer.innerHTML = suggestions
      .map((item) => {
        const parts = item.zone.split("/"); // e.g., "America/Argentina/Buenos_Aires"
        const city = parts[parts.length - 1].replace(/_/g, " "); // "Buenos Aires"
        const region =
          parts.length > 1 ? parts[parts.length - 2].replace(/_/g, " ") : "";
        const display = region ? `${city}, ${region}` : city;
        return `<div class="search-result" data-zone="${item.zone}">${display}</div>`;
      })
      .join("");

    resultsContainer.classList.remove("hidden");

    // Add click listeners
    resultsContainer.querySelectorAll(".search-result").forEach((result) => {
      result.addEventListener("click", () => {
        this.addTimezone(result.dataset.zone);
        document.getElementById("timezoneSearch").value = "";
        this.hideSearchResults();
      });
    });
  }

  hideSearchResults() {
    document.getElementById("searchResults").classList.add("hidden");
  }

  async addTimezone(timezoneInput) {
    // Check if timezone already exists
    if (this.timezones.find((tz) => tz.zone === timezoneInput)) {
      return;
    }

    try {
      // Validate timezone by creating a DateTime object
      const testTime = luxon.DateTime.now().setZone(timezoneInput);
      if (!testTime.isValid) {
        throw new Error("Invalid timezone");
      }

      this.timezones.push({ zone: timezoneInput, isLocal: false });
      await this.saveSettings();
      this.renderClocks();
    } catch (error) {
      console.error("Invalid timezone:", timezoneInput);
    }
  }

  async removeTimezone(index) {
    // Remove the timezone at the given index
    this.timezones.splice(index, 1);
    await this.saveSettings();
    this.renderClocks();
  }

  async renderClocks() {
    const container = document.getElementById("clocksContainer");
    const baseTime = this.editedTime || this.currentTime;

    if (!baseTime) return; // Prevents blank popup crashes

    const clocksHTML = await Promise.all(
      this.timezones.map(async (tz, index) => {
        const time = baseTime.setZone(tz.zone);
        const isCurrentTime = !this.editedTime;
        const dayNightInfo = await this.getDayNightInfo(tz.zone);

        return this.createClockHTML(
          tz,
          time,
          index,
          isCurrentTime,
          dayNightInfo
        );
      })
    );

    container.innerHTML = clocksHTML.join("");
    this.attachClockEventListeners();
  }

  async getDayNightInfo(timezone) {
    // Get representative coordinates for timezone
    const coords = this.getTimezoneCoordinates(timezone);
    const cacheKey = `${timezone}-${luxon.DateTime.now().toISODate()}`;

    if (this.dayNightCache.has(cacheKey)) {
      return this.dayNightCache.get(cacheKey);
    }

    try {
      const response = await fetch(
        `https://api.sunrise-sunset.org/json?lat=${coords.lat}&lng=${coords.lng}&formatted=0`
      );

      if (!response.ok) throw new Error("API failed");

      const data = await response.json();
      const now = luxon.DateTime.now().setZone(timezone);
      const sunrise = luxon.DateTime.fromISO(data.results.sunrise).setZone(
        timezone
      );
      const sunset = luxon.DateTime.fromISO(data.results.sunset).setZone(
        timezone
      );

      const isDayTime = now >= sunrise && now <= sunset;
      const result = { isDayTime, sunrise, sunset };

      this.dayNightCache.set(cacheKey, result);
      return result;
    } catch (error) {
      // Fallback: 6 AM - 6 PM is day
      const hour = luxon.DateTime.now().setZone(timezone).hour;
      const isDayTime = hour >= 6 && hour < 18;
      return { isDayTime, sunrise: null, sunset: null };
    }
  }

  getTimezoneCoordinates(timezone) {
    // Simplified mapping of timezones to approximate coordinates
    const coords = {
      "America/New_York": { lat: 40.7128, lng: -74.006 },
      "America/Chicago": { lat: 41.8781, lng: -87.6298 },
      "America/Denver": { lat: 39.7392, lng: -104.9903 },
      "America/Los_Angeles": { lat: 34.0522, lng: -118.2437 },
      "Europe/London": { lat: 51.5074, lng: -0.1278 },
      "Europe/Paris": { lat: 48.8566, lng: 2.3522 },
      "Europe/Berlin": { lat: 52.52, lng: 13.405 },
      "Asia/Tokyo": { lat: 35.6762, lng: 139.6503 },
      "Asia/Shanghai": { lat: 31.2304, lng: 121.4737 },
      "Asia/Kolkata": { lat: 28.6139, lng: 77.209 },
      "Australia/Sydney": { lat: -33.8688, lng: 151.2093 },
    };

    return coords[timezone] || { lat: 0, lng: 0 };
  }

  createClockHTML(tz, time, index, isCurrentTime, dayNightInfo) {
    const formattedTime = this.formatTime(time);
    const timeClass = isCurrentTime ? "current-time" : "edited-time";
    const dayNightClass = dayNightInfo.isDayTime ? "day" : "night";
    const displayName = tz.customName || this.getTimezoneDisplayName(tz.zone);

    const sunIcon = `
        <svg class="sun-icon" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="7"/>
            <line x1="12" y1="0.5" x2="12" y2="3" stroke-width="1.5"/>
            <line x1="12" y1="21" x2="12" y2="23.5" stroke-width="1.5"/>
            <line x1="3" y1="3" x2="5" y2="5" stroke-width="1.5"/>
            <line x1="19" y1="19" x2="21" y2="21" stroke-width="1.5"/>
            <line x1="1" y1="12" x2="4" y2="12" stroke-width="1.5"/>
            <line x1="20" y1="12" x2="23" y2="12" stroke-width="1.5"/>
            <line x1="3" y1="21" x2="5" y2="19" stroke-width="1.5"/>
            <line x1="19" y1="5" x2="21" y2="3" stroke-width="1.5"/>
        </svg>
    `;

    const moonIcon = `
        <svg class="moon-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
    `;

    return `
        <div class="clock-card ${dayNightClass}" data-index="${index}">
            <div class="day-night-indicator">
                ${dayNightInfo.isDayTime ? sunIcon : moonIcon}
            </div>
            <div class="clock-content">
                <div class="clock-header">
                    <span class="timezone-label ${
                      !tz.isLocal ? "editable" : ""
                    }" data-index="${index}">${displayName}</span>
                    ${
                      !tz.isLocal
                        ? `<button class="remove-btn" data-index="${index}">×</button>`
                        : ""
                    }
                </div>
                <div class="time-display ${timeClass}">
                    <span class="time-part hours" data-type="hours">${
                      formattedTime.hours
                    }</span>:
                    <span class="time-part minutes" data-type="minutes">${
                      formattedTime.minutes
                    }</span>
                    ${
                      !this.use24HourFormat
                        ? `<span class="time-part period">${
                            formattedTime.period || ""
                          }</span>`
                        : ""
                    }
                </div>
            </div>
            ${!isCurrentTime ? `<span class="edited-hourglass">⌛</span>` : ""}
        </div>
    `;
  }

  getTimezoneDisplayName(timezone) {
    const parts = timezone.split("/");
    if (parts.length > 1) {
      return parts[parts.length - 1].replace(/_/g, " ");
    }
    return timezone;
  }

  formatTime(dateTime) {
    if (this.use24HourFormat) {
      return {
        hours: String(dateTime.hour).padStart(2, "0"),
        minutes: String(dateTime.minute).padStart(2, "0"),
      };
    } else {
      const hour12 =
        dateTime.hour === 0
          ? 12
          : dateTime.hour > 12
          ? dateTime.hour - 12
          : dateTime.hour;
      return {
        hours: String(hour12).padStart(2, "0"),
        minutes: String(dateTime.minute).padStart(2, "0"),
        period: dateTime.hour >= 12 ? "PM" : "AM",
      };
    }
  }

  attachClockEventListeners() {
    // Remove button listeners
    document.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        this.removeTimezone(index);
      });
    });

    // Time editing listeners
    document.querySelectorAll(".time-part").forEach((part) => {
      if (part.dataset.type) {
        part.addEventListener("click", () => {
          this.startEditing(part);
        });
      }
    });

    // Name editing listeners
    document.querySelectorAll(".timezone-label.editable").forEach((label) => {
      label.addEventListener("click", () => {
        this.startNameEditing(label);
      });
    });
  }

  startNameEditing(element) {
    if (this.editingName) return;

    this.editingName = true;
    const index = parseInt(element.dataset.index);
    const originalText = element.textContent;

    element.contentEditable = true;
    element.classList.add("editing-name");
    element.focus();

    const selectText = () => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    };

    selectText();

    const finishEditing = async () => {
      element.classList.remove("editing-name");
      element.contentEditable = false;

      const newName = element.textContent.trim();
      if (newName && newName !== originalText) {
        this.timezones[index].customName = newName;
        await this.saveSettings();
      } else if (!newName) {
        element.textContent = originalText;
      }

      this.editingName = false;
    };

    element.addEventListener("blur", finishEditing, { once: true });
    element.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          element.blur();
        } else if (e.key === "Escape") {
          element.textContent = originalText;
          element.blur();
        }
      },
      { once: true }
    );
  }

  startEditing(element) {
    if (this.isEditing) return;

    this.isEditing = true;
    element.classList.add("editing");
    element.contentEditable = true;
    element.focus();

    const selectText = () => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    };

    selectText();

    const finishEditing = () => {
      element.classList.remove("editing");
      element.contentEditable = false;
      this.handleTimeEdit(element);
      this.isEditing = false;
    };

    element.addEventListener("blur", finishEditing);
    element.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        element.blur();
      } else if (e.key === "Escape") {
        element.textContent = element.dataset.originalValue;
        element.blur();
      }
      // Arrow up/down to increment/decrement
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        let currentVal = parseInt(element.textContent) || 0;
        const delta = e.key === "ArrowUp" ? 1 : -1;
        if (element.dataset.type === "hours") {
          const maxHour = this.use24HourFormat ? 23 : 12;
          const minHour = this.use24HourFormat ? 0 : 1;
          currentVal = Math.max(minHour, Math.min(maxHour, currentVal + delta));
        } else if (element.dataset.type === "minutes") {
          currentVal = (currentVal + delta + 60) % 60; // wrap around
        }
        element.textContent = String(currentVal).padStart(2, "0");
      }
      // Only allow numbers
      else if (
        !/[\d\b]/.test(e.key) &&
        !["ArrowLeft", "ArrowRight", "Delete", "Backspace"].includes(e.key)
      ) {
        e.preventDefault();
      }
    });

    // Store original value
    element.dataset.originalValue = element.textContent;
  }

  handleTimeEdit(element) {
    const clockCard = element.closest(".clock-card");
    const timezoneIndex = parseInt(clockCard.dataset.index);
    const timezone = this.timezones[timezoneIndex];

    const newValue = parseInt(element.textContent) || 0;
    const type = element.dataset.type;

    // Get current time in this timezone
    const currentTimeInZone = (this.editedTime || this.currentTime).setZone(
      timezone.zone
    );

    let newTime;
    if (type === "hours") {
      const maxHour = this.use24HourFormat ? 23 : 12;
      const validHour = Math.max(
        this.use24HourFormat ? 0 : 1,
        Math.min(maxHour, newValue)
      );

      let hour24 = validHour;
      if (!this.use24HourFormat) {
        const isPM = currentTimeInZone.hour >= 12;
        if (validHour === 12) {
          hour24 = isPM ? 12 : 0;
        } else {
          hour24 = isPM ? validHour + 12 : validHour;
        }
      }

      newTime = currentTimeInZone.set({ hour: hour24 });
    } else if (type === "minutes") {
      const validMinutes = Math.max(0, Math.min(59, newValue));
      newTime = currentTimeInZone.set({ minute: validMinutes });
    }

    if (newTime) {
      // Convert to UTC and then update all clocks
      this.editedTime = newTime.toUTC();
      this.renderClocks();
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new TimezoneClockApp();
});
