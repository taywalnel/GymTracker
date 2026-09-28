import { ApplicationConfig, isDevMode } from "@angular/core";
import { provideRouter } from "@angular/router";
import { routes } from "./app.routes";
import { provideFirebaseApp, initializeApp, getApp } from "@angular/fire/app";
import {
  provideFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "@angular/fire/firestore";
import { provideAuth, getAuth } from "@angular/fire/auth";
import { provideFunctions, getFunctions } from "@angular/fire/functions";
import { provideServiceWorker } from "@angular/service-worker";
import { environment } from "../environments/environment";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    // Cache data in IndexedDB so the app reads and writes offline; queued
    // writes sync when the connection returns.
    provideFirestore(() =>
      initializeFirestore(getApp(), {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      }),
    ),
    provideAuth(() => getAuth()),
    // Same region as Firestore; see functions/.
    provideFunctions(() => getFunctions(getApp(), "asia-southeast1")),
    // Caches the app itself so it opens with no connection. Production only.
    provideServiceWorker("ngsw-worker.js", {
      enabled: !isDevMode(),
      registrationStrategy: "registerWhenStable:30000",
    }),
  ],
};
