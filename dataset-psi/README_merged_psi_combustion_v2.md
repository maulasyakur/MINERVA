# merged_psi_combustion_v2.csv  (1,929 rows)

v2 = the original 9 datasets (batch = "core", 663 rows, identical to merged_psi_combustion.csv)
   + 6 extra investigations (batch = "extra", 1,266 rows):
CFI PSI-39 (87), ACME Flame Design PSI-10 (207 normal + 120 inverse), ACME CFI-G PSI-159 (179 normal + 154 inverse),
SPICE PSI-107 (469), ACME BRE PSI-20 (18), ACME CLD Flame PSI-21 (32).
Source files were not modified; every row keeps its raw values in raw_row_json.
All v1 caveats still apply (see README_merged_psi_combustion.md). Scripts: merge_psi_v2.py (kept outside this folder).

New column: o2_location = "ambient" or "burner oxidizer stream (inverse flame), not ambient".
  In the inverse-flame tables (PSI-10 inverse, PSI-159 inverse) XO2 is the O2 fraction in the burner jet (up to 85%),
  NOT the chamber atmosphere. Do not compare it directly with ambient O2 from other datasets.

Coverage of the extra batch
- O2: CFI, Flame Design, CFI-G, BRE (BRE as min/max ranges). None in SPICE or CLD.
- Pressure: CFI, Flame Design, CFI-G only (converted: bar / 1.01325 -> atm). BRE chamber pressures are NOT listed in the table.
- Airflow cm/s: SPICE only (co-flow air rate; 444 of 469 rows have a value). Flame Design / CFI-G give mass flows (mg/s) in notes only.
- Gas fractions: CFI has O2/N2/He mole fractions.

Source-data problems found (fixed where marked, raw value always kept)
- BRE: "3400%" and "2100%" read as 34 and 21 (percent-format artifact). Fixed, flagged in notes.
- CLD Flame: fuel labels CH5..CH14 and C2H5..C2H11 read as CH4 / C2H4 (fill-down artifact). Fixed, flagged in notes. Test Day yyddd converted to a date.
- SPICE: 8 negative air rates (min -5.92 cm/s) left as-is and flagged; 34 exact duplicate rows left in; GMT date is a day-of-year with no year, so date_iso is blank.
- CFI-G inverse: 861 blank lines dropped (154 real tests). Flame Design normal has some "RAMPED" tests with no steady pressure/flow values.
- Fuel names are not normalised (e.g. "C2H4" vs "Ethylene" vs "100%C2H4"); dilution is part of the label in several tables.
