import React, { useState } from "react";
import { DateRange, RangePreset, computeRange } from "./dateRange";

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "current_year", label: String(new Date().getFullYear()) },
  { key: "previous_year", label: String(new Date().getFullYear() - 1) },
  { key: "all_time", label: "Sve vreme" },
  { key: "custom", label: "Prilagođeno" },
];

const DateRangePicker: React.FC<Props> = ({ value, onChange }) => {
  const [customStart, setCustomStart] = useState(value.startDate || "");
  const [customEnd, setCustomEnd] = useState(value.endDate || "");

  const handlePreset = (preset: RangePreset) => {
    if (preset === "custom") {
      onChange(computeRange("custom", customStart, customEnd));
      return;
    }
    onChange(computeRange(preset));
  };

  return (
    <div className="mhc-range">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          className={`mhc-range-btn ${value.preset === p.key ? "active" : ""}`}
          onClick={() => handlePreset(p.key)}
        >
          {p.label}
        </button>
      ))}
      {value.preset === "custom" && (
        <>
          <input
            type="date"
            className="mhc-range-date"
            value={customStart}
            onChange={(e) => {
              setCustomStart(e.target.value);
              onChange(computeRange("custom", e.target.value, customEnd));
            }}
          />
          <span style={{ color: "#94a3b8", fontSize: 12 }}>–</span>
          <input
            type="date"
            className="mhc-range-date"
            value={customEnd}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              onChange(computeRange("custom", customStart, e.target.value));
            }}
          />
        </>
      )}
    </div>
  );
};

export default DateRangePicker;
