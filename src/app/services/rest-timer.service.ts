import { Injectable, OnDestroy } from "@angular/core";

@Injectable({ providedIn: "root" })
export class RestTimerService implements OnDestroy {
  readonly duration = 60;

  secondsLeft: number | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.clear();
    this.secondsLeft = this.duration;
    this.interval = setInterval(() => {
      if (this.secondsLeft === null) return;
      this.secondsLeft--;
      if (this.secondsLeft <= 0) {
        this.clear();
      }
    }, 1000);
  }

  clear(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.secondsLeft = null;
  }

  ngOnDestroy(): void {
    this.clear();
  }
}
