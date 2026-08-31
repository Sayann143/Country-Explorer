"use strict";

/* ============================================================
   Atlas — country explorer
   ============================================================ */

// Calling the official API directly. If your network/region blocks this
// (CORS/Cloudflare errors), loadCountries() below will silently fall back
// to the hardcoded fallbackData array so the UI never breaks.
const API_URL =
  "https://restcountries.com/v3.1/all?fields=name,flags,population,region,capital,cca3";

const REGION_LABELS = {
  africa: "Africa",
  americas: "Americas",
  asia: "Asia",
  europe: "Europe",
  oceania: "Oceania",
  antarctic: "Antarctic",
};

// ---- Fallback dataset -----------------------------------------------
// Used only when the live API request fails (e.g. network/CORS block).
// Shape matches the REST Countries v3.1 "fields=name,flags,population,
// region,capital,cca3" response exactly, so buildCard()/populateRegionOptions()
// work unmodified against it.
const fallbackData = [
  {
    name: {
      common: "India",
      official: "Republic of India",
    },
    flags: {
      svg: "https://flagcdn.com/in.svg",
      png: "https://flagcdn.com/w320/in.png",
      alt: "The flag of India has three equal horizontal bands of saffron, white, and green, with a navy blue chakra centered on the white band.",
    },
    population: 1380004385,
    region: "Asia",
    capital: ["New Delhi"],
    cca3: "IND",
  },
  {
    name: {
      common: "United States",
      official: "United States of America",
    },
    flags: {
      svg: "https://flagcdn.com/us.svg",
      png: "https://flagcdn.com/w320/us.png",
      alt: "The flag of the United States has thirteen horizontal stripes of red and white, with a blue canton containing fifty white stars.",
    },
    population: 329484123,
    region: "Americas",
    capital: ["Washington, D.C."],
    cca3: "USA",
  },
  {
    name: {
      common: "Nigeria",
      official: "Federal Republic of Nigeria",
    },
    flags: {
      svg: "https://flagcdn.com/ng.svg",
      png: "https://flagcdn.com/w320/ng.png",
      alt: "The flag of Nigeria has three equal vertical bands of green, white, and green.",
    },
    population: 206139589,
    region: "Africa",
    capital: ["Abuja"],
    cca3: "NGA",
  },
  {
    name: {
      common: "Germany",
      official: "Federal Republic of Germany",
    },
    flags: {
      svg: "https://flagcdn.com/de.svg",
      png: "https://flagcdn.com/w320/de.png",
      alt: "The flag of Germany has three equal horizontal bands of black, red, and gold.",
    },
    population: 83240525,
    region: "Europe",
    capital: ["Berlin"],
    cca3: "DEU",
  },
  {
    name: {
      common: "Australia",
      official: "Commonwealth of Australia",
    },
    flags: {
      svg: "https://flagcdn.com/au.svg",
      png: "https://flagcdn.com/w320/au.png",
      alt: "The flag of Australia has a blue field with the Union Jack in the canton, a large white star below it, and the Southern Cross constellation.",
    },
    population: 25687041,
    region: "Oceania",
    capital: ["Canberra"],
    cca3: "AUS",
  },
  {
    name: {
      common: "Brazil",
      official: "Federative Republic of Brazil",
    },
    flags: {
      svg: "https://flagcdn.com/br.svg",
      png: "https://flagcdn.com/w320/br.png",
      alt: "The flag of Brazil has a green field with a yellow rhombus and a blue globe bearing the national motto.",
    },
    population: 212559409,
    region: "Americas",
    capital: ["Brasília"],
    cca3: "BRA",
  },
  {
    name: {
      common: "Japan",
      official: "Japan",
    },
    flags: {
      svg: "https://flagcdn.com/jp.svg",
      png: "https://flagcdn.com/w320/jp.png",
      alt: "The flag of Japan has a white field with a crimson-red disc in the center.",
    },
    population: 125836021,
    region: "Asia",
    capital: ["Tokyo"],
    cca3: "JPN",
  },
  {
    name: {
      common: "South Africa",
      official: "Republic of South Africa",
    },
    flags: {
      svg: "https://flagcdn.com/za.svg",
      png: "https://flagcdn.com/w320/za.png",
      alt: "The flag of South Africa has a black, green, and gold Y-shaped band, with white-edged red and blue bands.",
    },
    population: 59308690,
    region: "Africa",
    capital: ["Pretoria", "Bloemfontein", "Cape Town"],
    cca3: "ZAF",
  },
  {
    name: {
      common: "France",
      official: "French Republic",
    },
    flags: {
      svg: "https://flagcdn.com/fr.svg",
      png: "https://flagcdn.com/w320/fr.png",
      alt: "The flag of France has three equal vertical bands of blue, white, and red.",
    },
    population: 67391582,
    region: "Europe",
    capital: ["Paris"],
    cca3: "FRA",
  },
  {
    name: {
      common: "New Zealand",
      official: "New Zealand",
    },
    flags: {
      svg: "https://flagcdn.com/nz.svg",
      png: "https://flagcdn.com/w320/nz.png",
      alt: "The flag of New Zealand has a blue field with the Union Jack in the canton and four red, white-edged stars representing the Southern Cross.",
    },
    population: 5084300,
    region: "Oceania",
    capital: ["Wellington"],
    cca3: "NZL",
  },
];

// ---- DOM references ----------------------------------------------------
const countryCountEl = document.getElementById("countryCount");
const searchInput = document.getElementById("searchInput");
const regionSelect = document.getElementById("regionSelect");
const resultsSection = document.querySelector(".results");

const skeletonGrid = document.getElementById("skeletonGrid");
const countryGrid = document.getElementById("countryGrid");
const emptyState = document.getElementById("emptyState");
const errorState = document.getElementById("errorState");

const emptyTitle = document.getElementById("emptyTitle");
const emptyMessage = document.getElementById("emptyMessage");
const errorMessage = document.getElementById("errorMessage");

const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const retryBtn = document.getElementById("retryBtn");

const cardTemplate = document.getElementById("cardTemplate");

// ---- State ---------------------------------------------------------------
let allCountries = [];
let searchTerm = "";
let selectedRegion = "all";

// ---- Utilities -------------------------------------------------------

function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function regionSlug(region) {
  return String(region || "").toLowerCase().trim().replace(/\s+/g, "-");
}

// ---- View state switches -------------------------------------------

function setBusy(isBusy) {
  resultsSection.setAttribute("aria-busy", String(isBusy));
}

function showSkeleton() {
  setBusy(true);
  skeletonGrid.hidden = false; skeletonGrid.style.display = "grid";
  countryGrid.hidden = true; countryGrid.style.display = "none";
  emptyState.hidden = true; emptyState.style.display = "none";
  errorState.hidden = true; errorState.style.display = "none";
}

function showGrid() {
  setBusy(false);
  skeletonGrid.hidden = true; skeletonGrid.style.display = "none";
  countryGrid.hidden = false; countryGrid.style.display = "grid";
  emptyState.hidden = true; emptyState.style.display = "none";
  errorState.hidden = true; errorState.style.display = "none";
}

function showEmpty(title, message) {
  setBusy(false);
  skeletonGrid.hidden = true; skeletonGrid.style.display = "none";
  countryGrid.hidden = true; countryGrid.style.display = "none";
  errorState.hidden = true; errorState.style.display = "none";
  emptyTitle.textContent = title;
  emptyMessage.textContent = message;
  emptyState.hidden = false; emptyState.style.display = "flex";
}

function showError(message) {
  setBusy(false);
  skeletonGrid.hidden = true; skeletonGrid.style.display = "none";
  countryGrid.hidden = true; countryGrid.style.display = "none";
  emptyState.hidden = true; emptyState.style.display = "none";
  errorMessage.textContent = message;
  errorState.hidden = false; errorState.style.display = "flex";
}

// ---- Rendering -------------------------------------------------------

/** Builds a single country card from the <template> and returns the node. */
function buildCard(country) {
  const node = cardTemplate.content.cloneNode(true);

  const name = country?.name?.common ?? "Unknown";
  const population =
    typeof country.population === "number"
      ? country.population.toLocaleString("en-US")
      : "Unknown";
  const region = country.region || "Unknown";
  const capital =
    Array.isArray(country.capital) && country.capital.length > 0
      ? country.capital.join(", ")
      : "No capital";

  const flagSrc = country.flags?.svg || country.flags?.png || "";
  const flagAlt = country.flags?.alt || `Flag of ${name}`;

  const img = node.querySelector(".flag-img");
  img.src = flagSrc;
  img.alt = flagAlt;
  img.onerror = () => {
    if (img.src !== country.flags?.png && country.flags?.png) {
      img.src = country.flags.png;
    } else {
      img.onerror = null;
      img.src =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200'><rect width='300' height='200' fill='#17203a'/></svg>`
        );
    }
  };

  node.querySelector(".card-name").textContent = name;
  node.querySelector(".pop-value").textContent = population;
  node.querySelector(".capital-value").textContent = capital;

  const regionValueEl = node.querySelector(".region-value");
  regionValueEl.textContent = region;

  const dot = node.querySelector(".region-dot");
  dot.classList.add(`r-${regionSlug(region)}`);

  const article = node.querySelector(".card");
  article.setAttribute("aria-label", `${name}, ${region}`);

  return node;
}

/** Renders the given list of countries into the grid (replacing prior content). */
function renderCountries(list) {
  countryGrid.innerHTML = "";

  if (list.length === 0) {
    if (searchTerm) {
      showEmpty(
        "No countries found",
        `We couldn't find a country matching "${searchTerm}". Check the spelling or clear the filters.`
      );
    } else {
      showEmpty(
        "No countries in this region",
        "Try selecting a different region."
      );
    }
    return;
  }

  const fragment = document.createDocumentFragment();
  list.forEach((country) => fragment.appendChild(buildCard(country)));
  countryGrid.appendChild(fragment);
  showGrid();
}

/** Updates the header's "Indexed" counter to reflect filtered / total. */
function updateCount(filteredCount) {
  const total = allCountries.length;
  countryCountEl.textContent =
    filteredCount === total ? `${total}` : `${filteredCount} / ${total}`;
}

// ---- Filtering -------------------------------------------------------

function applyFilters() {
  const term = searchTerm.trim().toLowerCase();

  const filtered = allCountries.filter((country) => {
    const matchesRegion =
      selectedRegion === "all" ||
      regionSlug(country.region) === selectedRegion;

    const matchesSearch =
      term === "" ||
      (country.name?.common ?? "").toLowerCase().includes(term) ||
      (country.name?.official ?? "").toLowerCase().includes(term);

    return matchesRegion && matchesSearch;
  });

  updateCount(filtered.length);
  renderCountries(filtered);
}

// ---- Region dropdown -------------------------------------------------

/** Populates the region <select> from whatever regions actually exist in the data. */
function populateRegionOptions(countries) {
  // Reset in case this runs twice (e.g. live load, then a later fallback).
  regionSelect.querySelectorAll("option:not([value='all'])").forEach((opt) =>
    opt.remove()
  );

  const regionsFound = new Set();
  countries.forEach((c) => {
    if (c.region) regionsFound.add(c.region);
  });

  const sortedRegions = Array.from(regionsFound).sort((a, b) =>
    a.localeCompare(b)
  );

  sortedRegions.forEach((region) => {
    const option = document.createElement("option");
    option.value = regionSlug(region);
    option.textContent = REGION_LABELS[regionSlug(region)] || region;
    regionSelect.appendChild(option);
  });
}

// ---- Data fetching -------------------------------------------------------

/** Loads the bundled fallback dataset and renders it, applying current filters. */
function loadFallbackData() {
  console.warn(
    "Atlas: live API request failed — using bundled fallback dataset instead."
  );

  allCountries = [...fallbackData].sort((a, b) =>
    (a.name?.common ?? "").localeCompare(b.name?.common ?? "")
  );

  populateRegionOptions(allCountries);
  applyFilters();
}

async function loadCountries() {
  showSkeleton();

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("The API returned no country data.");
    }

    allCountries = data.sort((a, b) =>
      (a.name?.common ?? "").localeCompare(b.name?.common ?? "")
    );

    populateRegionOptions(allCountries);
    updateCount(allCountries.length);
    renderCountries(allCountries);
  } catch (err) {
    // Network/CORS block, timeout, bad response, etc. — don't show the
    // error state to the user; fall back to the bundled dataset instead
    // so the UI keeps working.
    console.error("Failed to load live country data:", err);
    loadFallbackData();
  }
}

// ---- Event wiring -------------------------------------------------------

searchInput.addEventListener(
  "input",
  debounce((event) => {
    searchTerm = event.target.value;
    applyFilters();
  }, 250)
);

regionSelect.addEventListener("change", (event) => {
  selectedRegion = event.target.value;
  applyFilters();
});

clearFiltersBtn.addEventListener("click", () => {
  searchTerm = "";
  selectedRegion = "all";
  searchInput.value = "";
  regionSelect.value = "all";
  applyFilters();
});

retryBtn.addEventListener("click", () => {
  loadCountries();
});

// ---- Boot -------------------------------------------------------

loadCountries();