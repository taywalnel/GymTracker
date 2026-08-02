import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { ButtonComponent } from "../button/button.component";

interface CalendarDay {
  date: Date;
  dateStr: string;
  inMonth: boolean;
  hasWorkout: boolean;
  isToday: boolean;
}

@Component({
  selector: "app-calendar",
  imports: [ButtonComponent],
  templateUrl: "./calendar.component.html",
  styleUrl: "./calendar.component.scss",
})
export class CalendarComponent implements OnChanges {
  @Input() workoutDates: string[] = [];

  calendarDays: CalendarDay[] = [];
  calendarMonth: Date = new Date();
  calendarMonthLabel = "";

  private workoutDateSet = new Set<string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["workoutDates"]) {
      this.workoutDateSet = new Set(this.workoutDates);
      this.buildCalendar();
    }
  }

  prevMonth(): void {
    this.calendarMonth = new Date(
      this.calendarMonth.getFullYear(),
      this.calendarMonth.getMonth() - 1,
      1,
    );
    this.buildCalendar();
  }

  nextMonth(): void {
    this.calendarMonth = new Date(
      this.calendarMonth.getFullYear(),
      this.calendarMonth.getMonth() + 1,
      1,
    );
    this.buildCalendar();
  }

  private buildCalendar(): void {
    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth();

    this.calendarMonthLabel = this.calendarMonth.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });

    const days: CalendarDay[] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const todayStr = this.toLocalDateStr(new Date());
    const startDow = (firstDay.getDay() + 6) % 7;

    for (let i = startDow - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push(this.makeDay(date, todayStr, false));
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push(this.makeDay(date, todayStr, true));
    }

    while (days.length % 7 !== 0) {
      const date = new Date(
        year,
        month + 1,
        days.length - startDow - lastDay.getDate() + 1,
      );
      days.push(this.makeDay(date, todayStr, false));
    }

    this.calendarDays = days;
  }

  private makeDay(date: Date, todayStr: string, inMonth: boolean): CalendarDay {
    const dateStr = this.toLocalDateStr(date);
    return {
      date,
      dateStr,
      inMonth,
      hasWorkout: this.workoutDateSet.has(dateStr),
      isToday: dateStr === todayStr,
    };
  }

  private toLocalDateStr(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
