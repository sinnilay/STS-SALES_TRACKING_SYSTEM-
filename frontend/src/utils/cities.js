import { City } from 'country-state-city';

let indiaCities = null;

// Suggestions for a city text box: the cities your employees already belong to come first,
// followed by every Indian city, so any city can be picked from the dropdown or simply typed.
export const getCitySuggestions = (employeeCities = []) => {
  if (!indiaCities) {
    indiaCities = [...new Set(City.getCitiesOfCountry('IN').map((c) => c.name))].sort((a, b) => a.localeCompare(b));
  }
  const seen = new Set();
  const out = [];
  [...employeeCities, ...indiaCities].forEach((name) => {
    const key = name.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(name.trim());
    }
  });
  return out;
};
