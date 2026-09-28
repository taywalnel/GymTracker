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

type Trend = "increased" | "decreased" | "unchanged";

interface SeriesEntry {
  date: string;
  time: number;
  weightKg: number;
  trend: Trend;
}

interface ChartPoint {
  date: string;
  weightKg: number;
  trend: Trend;
  x: number;
  weightY: number;
  opacity: number;
}

interface ChartMonthMarker {
  label: string;
  time: number;
  x: number;
  showLabel: boolean;
}

/** The visible window of the chart: a time range and a weight range. */
interface ChartDomain {
  startTime: number;
  endTime: number;
  min: number;
  max: number;
}

interface ChartView {
  points: ChartPoint[];
  linePoints: string;
  axisLabels: number[];
  monthMarkers: ChartMonthMarker[];
}

const MAX_MONTH_LABELS = 6;
const HALF_DAY_MS = 12 * 60 * 60 * 1000;
// Keep in sync with --chart-duration in the stylesheet.
const CHART_TRANSITION_MS = 550;
// Points fade out over this distance (in plot %) once they leave the plot.
const EDGE_FADE = 4;

const EMPTY_CHART_VIEW: ChartView = {
  points: [],
  linePoints: "",
  axisLabels: [],
  monthMarkers: [],
};

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress ** 3
    : 1 - (-2 * progress + 2) ** 3 / 2;
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
  private series: SeriesEntry[] = [];
  private displayDomain: ChartDomain | null = null;
  private animationFrame = 0;
  isLoading = true;
  isSaving = false;
  showEntryForm = false;
  pendingDeleteEntry: BodyWeightEntry | null = null;
  editingDate: string | null = null;
  selectedPeriod: PeriodDays = 30;
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

  formatChange(changeKg: number): string {
    return `${changeKg >= 0 ? "+" : ""}${this.units.formatWeight(changeKg, 2)} ${this.units.unitLabel()}`;
  }

  selectPeriod(period: PeriodDays): void {
    if (period === this.selectedPeriod) return;
    this.selectedPeriod = period;
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
    this.formWeight = null;
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
      });
      if (progress < 1) this.animationFrame = requestAnimationFrame(step);
    };
    this.animationFrame = requestAnimationFrame(step);
  }

  private setDisplayDomain(domain: ChartDomain): void {
    this.displayDomain = domain;
    this.chartView = this.buildChartView(domain);
  }

  /** All entries oldest first, each trend relative to the previous weigh-in. */
  private buildSeries(): SeriesEntry[] {
    const sorted = this.entries
      .slice()
      .sort((left, right) => left.date.localeCompare(right.date));

    return sorted.map((entry, index) => {
      const previousWeightKg = sorted[index - 1]?.weightKg;
      return {
        date: entry.date,
        time: this.parseDate(entry.date).getTime(),
        weightKg: entry.weightKg,
        trend:
          previousWeightKg === undefined || entry.weightKg === previousWeightKg
            ? "unchanged"
            : entry.weightKg > previousWeightKg
              ? "increased"
              : "decreased",
      };
    });
  }

  private buildChartView(domain: ChartDomain): ChartView {
    const range = domain.endTime - domain.startTime;
    const positioned = this.series.map((entry): ChartPoint => {
      const x =
        range === 0 ? 50 : ((entry.time - domain.startTime) / range) * 100;
      const weightY = this.chartY(entry.weightKg, domain.min, domain.max);
      const overshoot = Math.max(0, -x, x - 100, -weightY, weightY - 100);
      return {
        date: entry.date,
        weightKg: entry.weightKg,
        trend: entry.trend,
        x,
        weightY,
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
        .map((point) => `${point.x},${point.weightY}`)
        .join(" "),
      axisLabels: Array.from(
        { length: 4 },
        (_, index) => domain.max - ((domain.max - domain.min) * index) / 3,
      ),
      monthMarkers: this.monthMarkers(domain),
    };
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
    return {
      ...this.chartTimeDomain(),
      ...this.chartDomain(this.filteredEntries.map((entry) => entry.weightKg)),
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
    const padding =
      rawMax === rawMin ? Math.max(rawMax * 0.02, 1) : (rawMax - rawMin) * 0.1;

    return {
      min: Math.max(0, rawMin - padding),
      max: rawMax + padding,
    };
  }

  private chartY(value: number, min: number, max: number): number {
    return max === min ? 50 : 92 - ((value - min) / (max - min)) * 76;
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
