import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

@Injectable({ providedIn: "root" })
export class TabService {
  private _todayClick = new Subject<void>();
  readonly todayClick$ = this._todayClick.asObservable();

  notifyTodayClick(): void {
    this._todayClick.next();
  }
}
