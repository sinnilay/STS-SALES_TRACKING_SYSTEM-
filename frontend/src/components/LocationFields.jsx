import React, { useMemo } from 'react';
import { Country, State, City } from 'country-state-city';

const LABEL = 'block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5';
const INPUT = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50/60 dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 transition focus:outline-none focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 disabled:opacity-60 disabled:cursor-not-allowed';

// Cascading Country -> State -> City selects. The form stores plain names
// (country, state, cityDistrict) so existing data and the API are unchanged.
const LocationFields = ({ register, watch, setValue, errors = {}, names = {} }) => {
  const { country: countryName = 'country', state: stateName = 'state', city: cityName = 'cityDistrict' } = names;

  const country = watch(countryName);
  const state = watch(stateName);

  const countries = useMemo(() => Country.getAllCountries(), []);
  const countryIso = countries.find((c) => c.name === country)?.isoCode;

  const states = useMemo(() => (countryIso ? State.getStatesOfCountry(countryIso) : []), [countryIso]);
  const stateIso = states.find((s) => s.name === state)?.isoCode;

  const cities = useMemo(
    () => (countryIso && stateIso ? City.getCitiesOfState(countryIso, stateIso) : []),
    [countryIso, stateIso]
  );

  const reset = (...fields) => fields.forEach((f) => setValue(f, '', { shouldValidate: false }));

  return (
    <>
      <div>
        <label className={LABEL}>Country <span className="text-red-500">*</span></label>
        <div>
          <select
            {...register(countryName, { required: true, onChange: () => reset(stateName, cityName) })}
            className={INPUT}
          >
            <option value="">--Select Country--</option>
            {countries.map((c) => <option key={c.isoCode} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={LABEL}>State <span className="text-red-500">*</span></label>
        <div>
          <select
            {...register(stateName, { required: true, onChange: () => reset(cityName) })}
            disabled={!countryIso}
            className={INPUT}
          >
            <option value="">{countryIso ? '--Select State--' : 'Select a country first'}</option>
            {states.map((s) => <option key={s.isoCode} value={s.name}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={LABEL}>City <span className="text-red-500">*</span></label>
        <div>
          {stateIso && cities.length === 0 ? (
            // Some states have no city list in the dataset — let the user type it.
            <input type="text" {...register(cityName, { required: true })} placeholder="Type a city" className={INPUT} />
          ) : (
            <select {...register(cityName, { required: true })} disabled={!stateIso} className={INPUT}>
              <option value="">{stateIso ? '--Select City--' : 'Select a state first'}</option>
              {cities.map((c, i) => <option key={`${c.name}-${i}`} value={c.name}>{c.name}</option>)}
            </select>
          )}
        </div>
      </div>
    </>
  );
};

export default LocationFields;
