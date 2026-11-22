import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable, LineChart } from "./charts";

describe("charts", () => {
  it("gives every chart a text summary and a data table", () => {
    render(
      <LineChart id="t" title="Accuracy by day" summary="2 days practised" max={100}
        points={[{ label: "11-20", value: 50 }, { label: "11-21", value: null }, { label: "11-22", value: 80 }]}
        table={<DataTable summary="Show the data as a table" caption="Accuracy by day" head={["Day", "Accuracy"]}
          rows={[["2026-11-20", "50%"], ["2026-11-21", "—"], ["2026-11-22", "80%"]]} />} />,
    );
    expect(screen.getByRole("img", { name: "2 days practised" })).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "Accuracy by day" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "2026-11-22" })).toBeInTheDocument();
    // A day with no data breaks the line rather than inventing a value: two separate segments
    expect(document.querySelectorAll("path")).toHaveLength(2);
    expect(document.querySelectorAll("circle")).toHaveLength(2);
  });
});
