export type RangePreset = "current_year" | "previous_year" | "all_time" | "custom";

export interface DateRange {
  preset: RangePreset;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
}

export function computeRange(
  preset: RangePreset,
  customStart?: string | null,
  customEnd?: string | null,
): DateRange {
  const year = new Date().getFullYear();
  if (preset === "current_year") {
    return { preset, startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }
  if (preset === "previous_year") {
    return { preset, startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31` };
  }
  if (preset === "custom") {
    return { preset, startDate: customStart || null, endDate: customEnd || null };
  }
  return { preset: "all_time", startDate: null, endDate: null };
}

export function rangeLabel(range: DateRange): string {
  const year = new Date().getFullYear();
  if (range.preset === "all_time") return "Sve vreme";
  if (range.preset === "current_year") return String(year);
  if (range.preset === "previous_year") return String(year - 1);
  if (range.startDate && range.endDate) return `${range.startDate} – ${range.endDate}`;
  if (range.startDate) return `Od ${range.startDate}`;
  if (range.endDate) return `Do ${range.endDate}`;
  return "Prilagođeno";
}

export function rangeQueryParams(range: DateRange): Record<string, string> {
  const params: Record<string, string> = {};
  if (range.startDate) params.start_date = range.startDate;
  if (range.endDate) params.end_date = range.endDate;
  return params;
}
