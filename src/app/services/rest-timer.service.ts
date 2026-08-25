import { Injectable, OnDestroy } from "@angular/core";

@Injectable({ providedIn: "root" })
export class RestTimerService implements OnDestroy {
  readonly defaultDuration = 60;
  duration = this.defaultDuration;

  private endsAt: number | null = null;
  private remainingSeconds: number | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;

  get secondsLeft(): number | null {
    this.updateRemainingSeconds();
    return this.remainingSeconds;
  }

  start(durationSeconds = this.defaultDuration): void {
    this.clear();
    this.duration = durationSeconds;
    if (durationSeconds <= 0) return;
    this.endsAt = Date.now() + durationSeconds * 1000;
    this.remainingSeconds = durationSeconds;
    this.interval = setInterval(() => {
      this.updateRemainingSeconds();
    }, 1000);
  }

  clear(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.endsAt = null;
    this.remainingSeconds = null;
  }

  ngOnDestroy(): void {
    this.clear();
  }

  private updateRemainingSeconds(): void {
    if (this.endsAt === null) return;

    const secondsLeft = Math.ceil((this.endsAt - Date.now()) / 1000);
    if (secondsLeft <= 0) {
      this.clear();
      return;
    }

    this.remainingSeconds = secondsLeft;
  }
}
