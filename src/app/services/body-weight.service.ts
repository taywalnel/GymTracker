import { Injectable, signal } from "@angular/core";
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  query,
  orderBy,
  setDoc,
} from "@angular/fire/firestore";
import { Auth, user } from "@angular/fire/auth";
import { Observable, defer, from, of } from "rxjs";
import { BodyWeightEntry } from "../models/body-weight.models";
import { queueWrite } from "../utils/firestore-writes";
import { getDocsPreferringServer } from "../utils/firestore-reads";

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

  // Writes don't wait for the server (see queueWrite), so they complete
  // immediately, offline included.
  saveEntry(entry: BodyWeightEntry): Observable<BodyWeightEntry> {
    return defer(() => {
      queueWrite(setDoc(doc(this.entriesCollection(), entry.id), entry));
      this.upsertEntry(entry);
      return of(entry);
    });
  }

  deleteEntry(date: string): Observable<boolean> {
    return defer(() => {
      queueWrite(deleteDoc(doc(this.entriesCollection(), date)));
      this.entriesSignal.set(
        this.entriesSignal().filter((entry) => entry.date !== date),
      );
      return of(true);
    });
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

    const uid = this.uid;
    const load = getDocsPreferringServer(
      query(this.entriesCollection(), orderBy("date", "desc")),
      // A late server result replaces the cached copy, unless another user
      // has signed in since.
      (snapshot) => {
        if (this.auth.currentUser?.uid !== uid) return;
        this.entriesSignal.set(
          snapshot.docs.map((item) => item.data() as BodyWeightEntry),
        );
      },
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
