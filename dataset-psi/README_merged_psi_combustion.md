# merged_psi_combustion.csv

One row per test/sample from the nine PSI experiment tables (BASS PSI-26, BASS-II PSI-25, SAFFIRE-I/II/III PSI-98/99/100,
FLEX PSI-69, FLEX-2 PSI-68, SAME PSI-102, SAME-R PSI-101). Original files were not modified; every row keeps its
untouched source values in `raw_row_json`, `source_file` and `source_row`.

Normalised columns: o2_pct (+_min/_max/_final), airflow_cm_s (+_min/_max), pressure_atm (+_min/_max), n2/co2/he_mole_frac,
co2_pct / co_ppm (BASS-II), gas_mixture, atmosphere_type, temperature_c, gravity_level, fuel_material, fuel_category.

Caveats
- Blank = not present in that table (not zero). BASS has no O2/airflow/pressure; SAFFIRE-III has no O2; only FLEX/FLEX-2 have pressure.
- FLEX-2 rows are test-design RANGES, not runs: only *_min/_max are filled (no midpoint).
- FLEX "CO initial ambient composition" is assumed to be CO2 (subscript lost in the source header).
- FLEX pressure converted from mmHg (/760). One FLEX row has pressure 0 in the source and is left blank.
- BASS-II airflow exists only as fan/air dial settings (airflow_raw), not cm/s.
- atmosphere_type for SAFFIRE (cabin air) and BASS-II (N2-diluted air) is inferred from investigation descriptions; see atmosphere_basis.
- SAME-R dates have no year in the source; 2010 was added from the investigation description.
- Skipped non-test rows: SAFFIRE-I (2) and SAFFIRE-II (6) pre-test flow-visualisation and footnote rows.
- gravity_level is "microgravity (flight)" for all rows; no partial-g (Moon/Mars) tests exist in these tables.
