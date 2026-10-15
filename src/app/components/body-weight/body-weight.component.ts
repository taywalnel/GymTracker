import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BodyWeightEntry } from "../../models/body-weight.models";
import { BodyWeightService } from "../../services/body-weight.service";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { ButtonComponent } from "../button/button.component";
import { ConfirmationModalComponent } from "../confirmation-modal/confirmation-modal.component";
import { DateInputComponent } from "../date-input/date-input.component";
import { InputComponent } from "../input/input.component";
import { LoadingSpinnerComponent } from "../loading-spinner/loading-spinner.component";
import {
  PageHeaderComponent,
  PageHeaderTab,
} from "../page-header/page-header.component";
import { RoutineCardComponent } from "../routine-card/routine-card.component";
import { EmptyStateComponent } from "../empty-state/empty-state.component";

type PeriodDays = 7 | 30 | 0;

type ChartMode = "line" | "trend";

type Trend = "increased" | "decreased" | "unchanged";

interface SeriesEntry {
  date: string;
  time: number;
  weightKg: number;
  /** Smoothed weight: a moving average that discounts day-to-day noise. */
  trendKg: number;
  trend: Trend;
}

interface ChartPoint {
  date: string;
  weightKg: number;
  trend: Trend;
  x: number;
  weightY: number;
  /** Where the line passes this point: between weightY and the trend. */
  lineY: number;
  opacity: number;
}

interface ChartMonthMarker {
  label: string;
  time: number;
  x: number;
  showLabel: boolean;
}

/**
 * The animated state of the chart: the visible window (a time range and a
 * weight range) and how far the line has morphed from raw weights (0) to the
 * trend (1).
 */
interface ChartDomain {
  startTime: number;
  endTime: number;
  min: number;
  max: number;
  trendMix: number;
}

/** A gridline at a whole number in the displayed unit. */
interface ChartAxisLine {
  value: number;
  label: string;
  y: number;
  opacity: number;
}

interface ChartView {
  points: ChartPoint[];
  linePoints: string;
  axisLines: ChartAxisLine[];
  /** The widest axis label, which sets the axis column's width. */
  axisSizer: string;
  monthMarkers: ChartMonthMarker[];
}

interface TrendSummary {
  trendKg: number;
  /** Trend change per week over the last RATE_WINDOW_DAYS; null if too little data. */
  weeklyRateKg: number | null;
}

const MAX_MONTH_LABELS = 6;
// Gridline spacings, coarsest first. The axis uses the coarsest one that
// still puts MIN_AXIS_LINES clearly visible lines on the plot, so it prefers
// whole numbers and only drops to decimals when the range is narrow.
const AXIS_STEPS = [100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
const MIN_AXIS_LINES = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const HALF_DAY_MS = DAY_MS / 2;
// Share of each day's difference the trend absorbs (as in The Hacker's Diet).
const TREND_SMOOTHING = 0.1;
// The weekly rate is measured over this many days, and needs at least
// MIN_RATE_SPAN_DAYS of weigh-ins to be shown.
const RATE_WINDOW_DAYS = 28;
const MIN_RATE_SPAN_DAYS = 7;
const CHART_MODE_STORAGE_KEY = "gym:bodyWeightChartMode";
// Keep in sync with --chart-duration in the stylesheet.
const CHART_TRANSITION_MS = 550;
// Points fade out over this distance (in plot %) once they leave the plot.
const EDGE_FADE = 4;

const EMPTY_CHART_VIEW: ChartView = {
  points: [],
  linePoints: "",
  axisLines: [],
  axisSizer: "",
  monthMarkers: [],
};

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function readStoredChartMode(): ChartMode {
  try {
    return localStorage.getItem(CHART_MODE_STORAGE_KEY) === "trend"
      ? "trend"
      : "line";
  } catch {
    return "line";
  }
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

@Component({
  selector: "app-body-weight",
  imports: [
    FormsModule,
    ButtonComponent,
    ConfirmationModalComponent,
    DateInputComponent,
    InputComponent,
    LoadingSpinnerComponent,
    PageHeaderComponent,
    RoutineCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: "./body-weight.component.html",
  styleUrl: "./body-weight.component.scss",
})
export class BodyWeightComponent implements OnInit, OnDestroy {
  entries: BodyWeightEntry[] = [];
  chartView: ChartView = EMPTY_CHART_VIEW;
  /** True while the chart plays its entrance animation after mounting. */
  chartRevealing = true;
  trendSummary: TrendSummary | null = null;
  /** Change between the first and last weigh-in in the period, as charted. */
  periodChangeKg: number | null = null;
  private series: SeriesEntry[] = [];
  private displayDomain: ChartDomain | null = null;
  private animationFrame = 0;
  isLoading = true;
  isSaving = false;
  showEntryForm = false;
  pendingDeleteEntry: BodyWeightEntry | null = null;
  editingDate: string | null = null;
  selectedPeriod: PeriodDays = 30;
  chartMode: ChartMode = readStoredChartMode();
  activeTab = "Overview";
  get bodyWeightTabs(): PageHeaderTab[] {
    return [
      { label: "Overview" },
      { label: "History", count: this.historyEntries.length },
    ];
  }

  formDate = "";
  formWeight: number | null = null;
  validationAttempted = false;

  readonly periodOptions: { label: string; value: PeriodDays }[] = [
    { label: "7 days", value: 7 },
    { label: "30 days", value: 30 },
    { label: "All", value: 0 },
  ];

  readonly chartModeOptions: { label: string; value: ChartMode }[] = [
    { label: "Line", value: "line" },
    { label: "Trend", value: "trend" },
  ];

  constructor(
    private bodyWeightService: BodyWeightService,
    public units: UnitPreferenceService,
  ) {}

  ngOnInit(): void {
    this.bodyWeightService.getEntries().subscribe({
      next: (entries) => {
        this.entries = entries;
        this.isLoading = false;
        // Later emissions (e.g. a server sync) glide to the new data.
        this.updateChart(this.displayDomain !== null);
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrame);
  }

  get filteredEntries(): BodyWeightEntry[] {
    return this.entries
      .filter((entry) => this.isInSelectedPeriod(entry.date))
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  get hasChartData(): boolean {
    return this.filteredEntries.length > 0;
  }

  get selectedPeriodIndex(): number {
    return this.periodOptions.findIndex(
      (option) => option.value === this.selectedPeriod,
    );
  }

  get selectedChartModeIndex(): number {
    return this.chartModeOptions.findIndex(
      (option) => option.value === this.chartMode,
    );
  }

  get latestEntry(): BodyWeightEntry | undefined {
    return this.filteredEntries.at(-1);
  }

  get latestRecordedEntry(): BodyWeightEntry | undefined {
    return this.entries[0];
  }

  get historyEntries(): BodyWeightEntry[] {
    return this.entries
      .slice()
      .sort((left, right) => right.date.localeCompare(left.date));
  }

  historyChangeKg(entry: BodyWeightEntry, index: number): number | null {
    const previousEntry = this.historyEntries[index + 1];
    return previousEntry ? entry.weightKg - previousEntry.weightKg : null;
  }

  get periodChangeLabel(): string {
    if (this.selectedPeriod !== 0) return `over ${this.selectedPeriod} days`;
    const firstDate = this.filteredEntries[0]?.date;
    return firstDate
      ? `since ${this.parseDate(firstDate).toLocaleDateString(undefined, {
          month: "short",
          year: "numeric",
        })}`
      : "";
  }

  formatChange(changeKg: number): string {
    return `${changeKg >= 0 ? "+" : ""}${this.units.formatWeight(changeKg, 2)} ${this.units.unitLabel()}`;
  }

  selectPeriod(period: PeriodDays): void {
    if (period === this.selectedPeriod) return;
    this.selectedPeriod = period;
    this.updateChart(true);
  }

  selectChartMode(mode: ChartMode): void {
    if (mode === this.chartMode) return;
    this.chartMode = mode;
    try {
      localStorage.setItem(CHART_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore storage errors
    }
    this.updateChart(true);
  }

  selectTab(tab: string): void {
    if (this.bodyWeightTabs.some((item) => item.label === tab)) {
      // The chart is rebuilt when Overview is shown again, so replay its entrance.
      if (tab === "Overview" && this.activeTab !== tab) {
        this.chartRevealing = true;
      }
      this.activeTab = tab;
    }
  }

  onChartRevealEnd(event: AnimationEvent): void {
    if (event.target === event.currentTarget) this.chartRevealing = false;
  }

  openNewEntry(): void {
    this.editingDate = null;
    this.formDate = this.todayString();
    // Start from the last weigh-in; usually only the decimals change.
    const lastEntry = this.latestRecordedEntry;
    this.formWeight = lastEntry
      ? Number(this.units.fromKg(lastEntry.weightKg).toFixed(2))
      : null;
    this.validationAttempted = false;
    this.showEntryForm = true;
  }

  editEntry(entry: BodyWeightEntry): void {
    this.editingDate = entry.date;
    this.formDate = entry.date;
    this.formWeight = Number(this.units.fromKg(entry.weightKg).toFixed(2));
    this.validationAttempted = false;
    this.showEntryForm = true;
  }

  cancelEntry(): void {
    this.showEntryForm = false;
    this.validationAttempted = false;
  }

  saveEntry(): void {
    this.validationAttempted = true;
    if (!this.formDate || this.formWeight === null || this.formWeight <= 0) {
      return;
    }

    this.isSaving = true;
    const entry: BodyWeightEntry = {
      id: this.formDate,
      date: this.formDate,
      weightKg: this.units.toKg(this.formWeight),
    };

    this.bodyWeightService.saveEntry(entry).subscribe({
      next: (saved) => {
        this.entries = this.bodyWeightService.entriesSignal();
        this.updateChart(true);
        this.isSaving = false;
        this.showEntryForm = false;
        this.editingDate = saved.date;
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  deleteEntry(entry: BodyWeightEntry): void {
    this.pendingDeleteEntry = entry;
  }

  cancelDelete(): void {
    this.pendingDeleteEntry = null;
  }

  confirmDelete(): void {
    const entry = this.pendingDeleteEntry;
    if (!entry) return;

    this.isSaving = true;
    this.bodyWeightService.deleteEntry(entry.date).subscribe({
      next: () => {
        this.entries = this.bodyWeightService.entriesSignal();
        this.updateChart(true);
        this.isSaving = false;
        this.showEntryForm = false;
        this.pendingDeleteEntry = null;
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  deleteEditingEntry(): void {
    const entry = this.entries.find((item) => item.date === this.editingDate);
    if (entry) this.deleteEntry(entry);
  }

  formatValue(weightKg: number): string {
    return `${this.units.formatWeight(weightKg, 2)} ${this.units.unitLabel()}`;
  }

  formatDate(date: string): string {
    return this.parseDate(date).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  private isInSelectedPeriod(date: string): boolean {
    if (this.selectedPeriod === 0) return true;

    const today = this.parseDate(this.todayString());
    const start = new Date(today);
    start.setDate(today.getDate() - (this.selectedPeriod - 1));
    const entryDate = this.parseDate(date);
    return entryDate >= start && entryDate <= today;
  }

  /**
   * Rebuilds the chart for the current entries and period. When animating,
   * the visible window (time and weight range) glides from where it is to the
   * new one, and every point is redrawn from it each frame, so the line pans
   * and zooms rather than jumping.
   */
  private updateChart(animate: boolean): void {
    this.series = this.buildSeries();
    this.trendSummary = this.buildTrendSummary();
    this.periodChangeKg = this.buildPeriodChange();
    const target = this.targetDomain();
    const from = this.displayDomain;
    cancelAnimationFrame(this.animationFrame);

    if (!animate || !from || this.prefersReducedMotion()) {
      this.setDisplayDomain(target);
      return;
    }

    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startedAt) / CHART_TRANSITION_MS, 1);
      const eased = easeInOutCubic(progress);
      this.setDisplayDomain({
        startTime: lerp(from.startTime, target.startTime, eased),
        endTime: lerp(from.endTime, target.endTime, eased),
        min: lerp(from.min, target.min, eased),
        max: lerp(from.max, target.max, eased),
        trendMix: lerp(from.trendMix, target.trendMix, eased),
      });
      if (progress < 1) this.animationFrame = requestAnimationFrame(step);
    };
    this.animationFrame = requestAnimationFrame(step);
  }

  private setDisplayDomain(domain: ChartDomain): void {
    this.displayDomain = domain;
    this.chartView = this.buildChartView(domain);
  }

  /**
   * All entries oldest first, each trend relative to the previous weigh-in.
   * The smoothed trend moves TREND_SMOOTHING of the way toward each weigh-in
   * per day since the last one, so gaps between weigh-ins count for more.
   */
  private buildSeries(): SeriesEntry[] {
    const sorted = this.entries
      .slice()
      .sort((left, right) => left.date.localeCompare(right.date));

    let previousTime = 0;
    let trendKg = sorted[0]?.weightKg ?? 0;
    return sorted.map((entry, index) => {
      const previousWeightKg = sorted[index - 1]?.weightKg;
      const time = this.parseDate(entry.date).getTime();
      if (index > 0) {
        const days = (time - previousTime) / DAY_MS;
        const weight = 1 - (1 - TREND_SMOOTHING) ** days;
        trendKg += (entry.weightKg - trendKg) * weight;
      }
      previousTime = time;
      return {
        date: entry.date,
        time,
        weightKg: entry.weightKg,
        trendKg,
        trend:
          previousWeightKg === undefined || entry.weightKg === previousWeightKg
            ? "unchanged"
            : entry.weightKg > previousWeightKg
              ? "increased"
              : "decreased",
      };
    });
  }

  /**
   * The trend at the latest weigh-in and how fast it is moving. The trend only
   * changes at weigh-ins, so its value at the start of the rate window is the
   * one from the last weigh-in on or before that day.
   */
  private buildTrendSummary(): TrendSummary | null {
    const latest = this.series.at(-1);
    if (!latest) return null;

    const windowStart = latest.time - RATE_WINDOW_DAYS * DAY_MS;
    const before = this.series.filter((entry) => entry.time <= windowStart);
    const base = before.at(-1) ?? this.series[0];
    const spanDays = (latest.time - Math.max(base.time, windowStart)) / DAY_MS;

    return {
      trendKg: latest.trendKg,
      weeklyRateKg:
        spanDays < MIN_RATE_SPAN_DAYS
          ? null
          : ((latest.trendKg - base.trendKg) / spanDays) * 7,
    };
  }

  /** Follows the chart mode, so the number matches the line on screen. */
  private buildPeriodChange(): number | null {
    const inPeriod = this.series.filter((entry) =>
      this.isInSelectedPeriod(entry.date),
    );
    const first = inPeriod[0];
    const last = inPeriod.at(-1);
    if (!first || !last || first === last) return null;

    return this.chartMode === "trend"
      ? last.trendKg - first.trendKg
      : last.weightKg - first.weightKg;
  }

  private buildChartView(domain: ChartDomain): ChartView {
    const range = domain.endTime - domain.startTime;
    const positioned = this.series.map((entry): ChartPoint => {
      const x =
        range === 0 ? 50 : ((entry.time - domain.startTime) / range) * 100;
      const weightY = this.chartY(entry.weightKg, domain.min, domain.max);
      const trendY = this.chartY(entry.trendKg, domain.min, domain.max);
      const overshoot = Math.max(0, -x, x - 100, -weightY, weightY - 100);
      return {
        date: entry.date,
        weightKg: entry.weightKg,
        trend: entry.trend,
        x,
        weightY,
        lineY: lerp(weightY, trendY, domain.trendMix),
        opacity: Math.max(0, 1 - overshoot / EDGE_FADE),
      };
    });

    // The line runs through the visible points plus one neighbour either
    // side, so it continues off the edges toward earlier/later weigh-ins.
    const firstVisible = positioned.findIndex((point) => point.x >= 0);
    const lineStart = Math.max(0, firstVisible - 1);
    const lineEnd = positioned.filter((point) => point.x <= 100).length + 1;

    return {
      points: positioned.filter((point) => point.opacity > 0),
      linePoints: positioned
        .slice(lineStart, lineEnd)
        .map((point) => `${point.x},${point.lineY}`)
        .join(" "),
      ...this.axisLines(domain),
      monthMarkers: this.monthMarkers(domain),
    };
  }

  /**
   * Gridlines at round numbers in the displayed unit, across the plot's
   * weight range, spaced as coarsely as AXIS_STEPS allows. Lines fade near the
   * top and bottom so they glide in and out as the range changes.
   */
  private axisLines(
    domain: ChartDomain,
  ): Pick<ChartView, "axisLines" | "axisSizer"> {
    const top = this.units.fromKg(domain.max);
    const bottom = this.units.fromKg(domain.min);
    let axisLines: ChartAxisLine[] = [];
    for (const step of AXIS_STEPS) {
      axisLines = this.axisLinesAt(step, top, bottom, domain);
      const visible = axisLines.filter((line) => line.opacity === 1);
      if (visible.length >= MIN_AXIS_LINES) break;
    }

    return {
      axisLines,
      axisSizer: axisLines.reduce(
        (widest, line) =>
          line.label.length > widest.length ? line.label : widest,
        "",
      ),
    };
  }

  /** Lines at every multiple of `step` (in the displayed unit) in range. */
  private axisLinesAt(
    step: number,
    top: number,
    bottom: number,
    domain: ChartDomain,
  ): ChartAxisLine[] {
    const decimals = Math.max(0, -Math.floor(Math.log10(step)));
    // Counting in whole steps (not adding decimals) avoids float drift.
    const first = Math.ceil(bottom / step - 1e-9);
    const last = Math.floor(top / step + 1e-9);
    const lines: ChartAxisLine[] = [];
    for (let index = first; index <= last; index++) {
      const value = Number((index * step).toFixed(decimals));
      const y = this.chartY(this.units.toKg(value), domain.min, domain.max);
      lines.push({
        value,
        label: `${value.toFixed(decimals)} ${this.units.unitLabel()}`,
        y,
        opacity: Math.max(0, Math.min(1, y / EDGE_FADE, (100 - y) / EDGE_FADE)),
      });
    }
    return lines;
  }

  /** A marker at the 1st of each month in the visible range. */
  private monthMarkers(domain: ChartDomain): ChartMonthMarker[] {
    const { startTime, endTime } = domain;
    const range = endTime - startTime;
    if (range <= 0) return [];

    // Mid-animation the window can start part-way through a day.
    const start = new Date(startTime);
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    if (cursor.getTime() < startTime) cursor.setMonth(cursor.getMonth() + 1);
    const monthStarts: Date[] = [];
    while (cursor.getTime() <= endTime) {
      monthStarts.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Long ranges keep every line but thin the labels so they don't overlap.
    // Thinning is anchored to the calendar (not the first visible month) so
    // labels don't flicker as the window slides.
    const labelEvery = Math.ceil(monthStarts.length / MAX_MONTH_LABELS);
    return monthStarts.map((date) => ({
      label: date.toLocaleString("en-US", { month: "short" }),
      time: date.getTime(),
      x: ((date.getTime() - startTime) / range) * 100,
      showLabel: (date.getFullYear() * 12 + date.getMonth()) % labelEvery === 0,
    }));
  }

  private targetDomain(): ChartDomain {
    const showTrend = this.chartMode === "trend";
    // Fit whichever line is shown.
    const values = this.series
      .filter((entry) => this.isInSelectedPeriod(entry.date))
      .map((entry) => (showTrend ? entry.trendKg : entry.weightKg));
    return {
      ...this.chartTimeDomain(),
      ...this.chartDomain(values),
      trendMix: showTrend ? 1 : 0,
    };
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    );
  }

  private chartTimeDomain(): { startTime: number; endTime: number } {
    const today = this.parseDate(this.todayString());
    if (this.selectedPeriod !== 0) {
      const start = new Date(today);
      start.setDate(today.getDate() - (this.selectedPeriod - 1));
      return { startTime: start.getTime(), endTime: today.getTime() };
    }

    const entries = this.filteredEntries;
    const start = this.parseDate(entries[0]?.date ?? this.todayString());
    const end = this.parseDate(entries.at(-1)?.date ?? this.todayString());
    // A single day still gets a window (centred on it) so it can be animated
    // to and from without the point jumping.
    if (start.getTime() === end.getTime()) {
      return {
        startTime: start.getTime() - HALF_DAY_MS,
        endTime: end.getTime() + HALF_DAY_MS,
      };
    }
    return { startTime: start.getTime(), endTime: end.getTime() };
  }

  private chartDomain(values: number[]): { min: number; max: number } {
    if (values.length === 0) return { min: 0, max: 1 };

    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    // Peaks and troughs touch the plot's edges; a flat series still gets a
    // range so it sits in the middle.
    const padding = rawMax === rawMin ? Math.max(rawMax * 0.02, 1) : 0;

    return {
      min: Math.max(0, rawMin - padding),
      max: rawMax + padding,
    };
  }

  private chartY(value: number, min: number, max: number): number {
    return max === min ? 50 : 100 - ((value - min) / (max - min)) * 100;
  }

  private todayString(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  private parseDate(date: string): Date {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
}
