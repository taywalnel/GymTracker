import { Component, OnInit } from "@angular/core";
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

type PeriodDays = 7 | 30 | 0;
type ChartView = "weigh-ins" | "average";

interface ChartPoint {
  date: string;
  weightKg: number;
  averageKg: number;
  trend: "increased" | "decreased" | "unchanged";
  x: number;
  weightY: number;
  averageY: number;
}

interface ChartTrendSegment {
  points: string;
  trend: "increased" | "decreased" | "unchanged";
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
  ],
  templateUrl: "./body-weight.component.html",
  styleUrl: "./body-weight.component.scss",
})
export class BodyWeightComponent implements OnInit {
  entries: BodyWeightEntry[] = [];
  isLoading = true;
  isSaving = false;
  showEntryForm = false;
  pendingDeleteEntry: BodyWeightEntry | null = null;
  editingDate: string | null = null;
  selectedPeriod: PeriodDays = 30;
  selectedChartView: ChartView = "weigh-ins";
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
  readonly chartViewOptions: { label: string; value: ChartView }[] = [
    { label: "Weigh-ins", value: "weigh-ins" },
    { label: "7-day average", value: "average" },
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
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  get filteredEntries(): BodyWeightEntry[] {
    return this.entries
      .filter((entry) => this.isInSelectedPeriod(entry.date))
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  get chartPoints(): ChartPoint[] {
    const entries = this.filteredEntries;
    const values = entries.map((entry) => entry.weightKg);
    const { min, max } = this.chartDomain(values);

    return entries.map((entry, index) => {
      const averageKg = this.movingAverage(entries, index);
      const previousWeightKg = entries[index - 1]?.weightKg;
      return {
        date: entry.date,
        weightKg: entry.weightKg,
        averageKg,
        trend:
          previousWeightKg === undefined || entry.weightKg === previousWeightKg
            ? "unchanged"
            : entry.weightKg > previousWeightKg
              ? "increased"
              : "decreased",
        x: entries.length === 1 ? 50 : (index / (entries.length - 1)) * 100,
        weightY: this.chartY(entry.weightKg, min, max),
        averageY: this.chartY(averageKg, min, max),
      };
    });
  }

  get chartWeightPoints(): string {
    return this.chartPoints
      .map((point) => `${point.x},${point.weightY}`)
      .join(" ");
  }

  get chartAveragePoints(): string {
    return this.chartPoints
      .map((point) => `${point.x},${point.averageY}`)
      .join(" ");
  }

  get chartTrendSegments(): ChartTrendSegment[] {
    const points = this.chartPoints;
    return points.slice(1).map((point, index) => {
      const previousPoint = points[index];
      return {
        points: `${previousPoint.x},${previousPoint.averageY} ${point.x},${point.averageY}`,
        trend:
          point.averageKg === previousPoint.averageKg
            ? "unchanged"
            : point.averageKg > previousPoint.averageKg
              ? "increased"
              : "decreased",
      };
    });
  }

  get chartAxisLabels(): number[] {
    const values = this.chartPoints.flatMap((point) => [
      point.weightKg,
      point.averageKg,
    ]);
    const { min, max } = this.chartDomain(values);
    return Array.from(
      { length: 4 },
      (_, index) => max - ((max - min) * index) / 3,
    );
  }

  get latestEntry(): BodyWeightEntry | undefined {
    return this.filteredEntries.at(-1);
  }

  get periodStartEntry(): BodyWeightEntry | undefined {
    return this.filteredEntries[0];
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
    return `${changeKg >= 0 ? "+" : ""}${this.units.formatWeight(changeKg)} ${this.units.unitLabel()}`;
  }

  get periodChangeKg(): number | null {
    const points = this.chartPoints;
    if (points.length < 2) return null;
    return points.at(-1)!.weightKg - points[0].weightKg;
  }

  get averageWeightKg(): number | null {
    const points = this.chartPoints;
    return points.length ? points.at(-1)!.averageKg : null;
  }

  selectPeriod(period: PeriodDays): void {
    this.selectedPeriod = period;
  }

  selectChartView(view: ChartView): void {
    this.selectedChartView = view;
  }

  selectTab(tab: string): void {
    if (this.bodyWeightTabs.some((item) => item.label === tab)) {
      this.activeTab = tab;
    }
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
    this.formWeight = Number(this.units.fromKg(entry.weightKg).toFixed(1));
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
    return `${this.units.formatWeight(weightKg)} ${this.units.unitLabel()}`;
  }

  formatDate(date: string): string {
    return this.parseDate(date).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  formatChartDate(date: string): string {
    const parsedDate = this.parseDate(date);
    return `${String(parsedDate.getDate()).padStart(2, "0")}/${String(
      parsedDate.getMonth() + 1,
    ).padStart(2, "0")}/${parsedDate.getFullYear()}`;
  }

  private isInSelectedPeriod(date: string): boolean {
    if (this.selectedPeriod === 0) return true;

    const today = this.parseDate(this.todayString());
    const start = new Date(today);
    start.setDate(today.getDate() - (this.selectedPeriod - 1));
    const entryDate = this.parseDate(date);
    return entryDate >= start && entryDate <= today;
  }

  private movingAverage(entries: BodyWeightEntry[], index: number): number {
    const currentDate = this.parseDate(entries[index].date);
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - 6);
    const window = entries.filter((entry) => {
      const date = this.parseDate(entry.date);
      return date >= startDate && date <= currentDate;
    });
    return (
      window.reduce((total, entry) => total + entry.weightKg, 0) / window.length
    );
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
