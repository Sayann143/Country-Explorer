"use strict";

/* ============================================================
   Atlas — country explorer
   ============================================================ */

// Using a highly reliable, pre-encoded CORS proxy that bypasses adblockers
const API_URL = "https://restcountries.com/v3.1/all?fields=name,flags,population,region,capital,cca3";

const REGION_LABELS = {
  africa: "Africa",
  americas: "Americas",
  asia: "Asia",
  europe: "Europe",
  oceania: "Oceania",
  antarctic: "Antarctic",
};

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

// ---- View state switches (Bulletproof Cache Fix) -------------

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
    console.error("Failed to load countries:", err);
    const isNetworkFailure = err?.name === "TypeError";
    const message = isNetworkFailure
      ? "We couldn't reach the REST Countries API. Check your internet connection and try again."
      : `${err.message || "An unexpected error occurred."} Please try again.`;
    showError(message);
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