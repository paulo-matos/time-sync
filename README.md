# Timezone Clock Extension

A Chrome extension that displays multiple clocks for different timezones. Users can add major cities, countries, US states, or search using time zone abbreviations (e.g., PST, CST, UTC-3). The extension also supports 12H/24H formats and shows day/night indicators.

---

## Features

- Show multiple clocks for different timezones.
- Add/remove timezones easily.
- Search by city, country, US state, or time zone abbreviation.
- Supports big US cities (including Texas), European, and Latin American locations.
- 12H/24H toggle.
- Day/Night indicator with sun/moon icons.
- Local timezone is automatically added on first use.
- Custom names for clocks.

---

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/timezone-clock-extension.git
```

Open Chrome and go to chrome://extensions/.

Enable Developer mode (top-right corner).

Click Load unpacked and select the cloned repository folder.

The extension should appear in your toolbar.

Usage
Click the extension icon to open the popup.

Add a new timezone using the search bar:

You can type city names (e.g., "San Francisco", "Moscow").

Country names (e.g., "Belarus", "Brazil").

US states or major cities (e.g., "Texas", "Dallas").

Timezone abbreviations (e.g., "PST", "CST", "UTC-3").

Click a search result to add it.

Remove a timezone using the × button.

Toggle between 12H/24H formats with the 24H/12H button.

Optional: Rename clocks by clicking the timezone label (editable).

Development
The timezone list is located in timezones.js.

Add new timezones by updating the TIMEZONE_DATA array with:

zone: valid IANA timezone string.

display: user-friendly display name.

aliases: searchable keywords (city names, country, abbreviation, etc.).

Main app logic is in popup.html and popup.js.

Technologies
JavaScript (ES6+)

Luxon for date/time management

Chrome Extensions API

Notes
Only valid IANA timezone names are supported for Luxon compatibility.

Day/Night calculation is approximate based on representative city coordinates.

No external API is required for search; all data is local for speed and reliability.

```

```
