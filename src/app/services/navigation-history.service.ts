import { Location } from "@angular/common";
import { Injectable, inject } from "@angular/core";
import { NavigationEnd, NavigationStart, Router } from "@angular/router";

interface HistoryEntry {
  // The router navigation id written into this entry's history.state.
  id: number;
  url: string;
}

/**
 * Mirrors the browser history entries created inside the app, so Back buttons
 * can return to the page the user actually came from. When there is no in-app
 * page behind the current one (a deep link or a reload), callers fall back to
 * a fixed destination instead of leaving the app.
 */
@Injectable({ providedIn: "root" })
export class NavigationHistoryService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  private entries: HistoryEntry[] = [];
  private index = -1;
  // Browser back/forward restores an entry whose id Angular then rewrites.
  private restoredId: number | null = null;

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.restoredId =
          event.navigationTrigger === "imperative"
            ? null
            : (event.restoredState?.navigationId ?? null);
      } else if (event instanceof NavigationEnd) {
        this.record(event);
      }
    });
  }

  get canGoBack(): boolean {
    return this.index > 0;
  }

  /** Returns to the previous page, or goes to `fallbackUrl` if there isn't one. */
  back(fallbackUrl: string): void {
    if (this.canGoBack) {
      this.location.back();
      return;
    }
    this.router.navigateByUrl(fallbackUrl, { replaceUrl: true });
  }

  /**
   * Leaves a page that's finished with (saved, deleted, discarded) for `url`.
   * Steps back when that's where the user came from, otherwise replaces the
   * current page, so Back from `url` never lands on the finished page.
   */
  leave(url: string): void {
    if (this.canGoBack && this.entries[this.index - 1].url === url) {
      this.location.back();
      return;
    }
    this.router.navigateByUrl(url, { replaceUrl: true });
  }

  private record(event: NavigationEnd): void {
    const extras = this.router.currentNavigation()?.extras;
    if (extras?.skipLocationChange) return;

    const entry = { id: event.id, url: event.urlAfterRedirects };

    if (this.restoredId !== null) {
      const restored = this.entries.findIndex(
        (item) => item.id === this.restoredId && item.url === entry.url,
      );
      if (restored >= 0) {
        this.index = restored;
        this.entries[restored] = entry;
      } else {
        // An entry from before this page load; nothing known behind it.
        this.entries = [entry];
        this.index = 0;
      }
      return;
    }

    if (this.index < 0) {
      this.entries = [entry];
      this.index = 0;
    } else if (extras?.replaceUrl) {
      this.entries[this.index] = entry;
    } else {
      this.entries = [...this.entries.slice(0, this.index + 1), entry];
      this.index += 1;
    }
  }
}
