import { Injectable, OnDestroy } from "@angular/core";

const STORAGE_KEY = "gym:restTimer";

@Injectable({ providedIn: "root" })
export class RestTimerService implements OnDestroy {
  readonly defaultDuration = 60;
  duration = this.defaultDuration;

  private endsAt: number | null = null;
  private remainingSeconds: number | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;

  // The end time is persisted so a rest in progress survives a reload or the
  // app being killed; it resumes if it hasn't run out yet.
  constructor() {
    this.restore();
  }

  get secondsLeft(): number | null {
    this.updateRemainingSeconds();
    return this.remainingSeconds;
  }

  /** Milliseconds until the current rest ends, or 0 when no rest is running. */
  get remainingMs(): number {
    return this.endsAt === null ? 0 : Math.max(0, this.endsAt - Date.now());
  }

  start(durationSeconds = this.defaultDuration): void {
    this.clear();
    this.duration = durationSeconds;
    if (durationSeconds <= 0) return;
    this.run(Date.now() + durationSeconds * 1000);
    this.persist();
  }

  clear(): void {
    this.stopInterval();
    this.endsAt = null;
    this.remainingSeconds = null;
    this.persist();
  }

  ngOnDestroy(): void {
    this.stopInterval();
  }

  private run(endsAt: number): void {
    this.endsAt = endsAt;
    this.updateRemainingSeconds();
    this.interval = setInterval(() => {
      this.updateRemainingSeconds();
    }, 1000);
  }

  private stopInterval(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
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

  private persist(): void {
    try {
      if (this.endsAt === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ endsAt: this.endsAt, duration: this.duration }),
        );
      }
    } catch (e) {
      // ignore storage errors
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const { endsAt, duration } = JSON.parse(raw) as {
        endsAt: number;
        duration: number;
      };
      if (endsAt > Date.now()) {
        this.duration = duration;
        this.run(endsAt);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      // ignore storage errors
    }
  }
}
