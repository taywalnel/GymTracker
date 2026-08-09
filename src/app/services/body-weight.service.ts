import { Injectable, signal } from "@angular/core";
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  setDoc,
} from "@angular/fire/firestore";
import { Auth, user } from "@angular/fire/auth";
import { Observable, from } from "rxjs";
import { BodyWeightEntry } from "../models/body-weight.models";

@Injectable({ providedIn: "root" })
export class BodyWeightService {
  readonly entriesSignal = signal<BodyWeightEntry[]>([]);

  private loaded = false;
  private loading: Promise<BodyWeightEntry[]> | null = null;
  private activeUserId: string | null = null;
  private authStateInitialized = false;

  constructor(
    private firestore: Firestore,
    private auth: Auth,
  ) {
    user(this.auth).subscribe((currentUser) => {
      const userId = currentUser?.uid ?? null;
      if (!this.authStateInitialized) {
        this.activeUserId = userId;
        this.authStateInitialized = true;
        return;
      }

      if (this.activeUserId !== userId) {
        this.activeUserId = userId;
        this.clearCache();
      }
    });
  }

  getEntries(): Observable<BodyWeightEntry[]> {
    return from(this.loadEntries());
  }

  saveEntry(entry: BodyWeightEntry): Observable<BodyWeightEntry> {
    return from(
      setDoc(doc(this.entriesCollection(), entry.id), entry).then(() => {
        this.upsertEntry(entry);
        return entry;
      }),
    );
  }

  deleteEntry(date: string): Observable<boolean> {
    return from(
      deleteDoc(doc(this.entriesCollection(), date)).then(() => {
        this.entriesSignal.set(
          this.entriesSignal().filter((entry) => entry.date !== date),
        );
        return true;
      }),
    );
  }

  private get uid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error("User not authenticated");
    return uid;
  }

  private entriesCollection() {
    return collection(this.firestore, `users/${this.uid}/bodyWeights`);
  }

  private loadEntries(): Promise<BodyWeightEntry[]> {
    if (this.loaded) return Promise.resolve(this.entriesSignal());
    if (this.loading) return this.loading;

    const load = getDocs(
      query(this.entriesCollection(), orderBy("date", "desc")),
    ).then((snapshot) => {
      const entries = snapshot.docs.map(
        (item) => item.data() as BodyWeightEntry,
      );
      this.entriesSignal.set(entries);
      this.loaded = true;
      return entries;
    });

    this.loading = load;
    void load.then(
      () => this.clearLoading(load),
      () => this.clearLoading(load),
    );
    return load;
  }

  private upsertEntry(entry: BodyWeightEntry): void {
    const entries = this.entriesSignal().filter(
      (item) => item.date !== entry.date,
    );
    entries.push(entry);
    entries.sort((left, right) => right.date.localeCompare(left.date));
    this.entriesSignal.set(entries);
    this.loaded = true;
  }

  private clearLoading(load: Promise<BodyWeightEntry[]>): void {
    if (this.loading === load) this.loading = null;
  }

  private clearCache(): void {
    this.entriesSignal.set([]);
    this.loaded = false;
    this.loading = null;
  }
}
