import { Location } from "@angular/common";
import { provideLocationMocks } from "@angular/common/testing";
import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";

import { NavigationHistoryService } from "./navigation-history.service";

@Component({ template: "" })
class BlankComponent {}

describe("NavigationHistoryService", () => {
  let router: Router;
  let location: Location;
  let service: NavigationHistoryService;

  // Lets the router finish a navigation started by Location.back().
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: "**", component: BlankComponent }]),
        provideLocationMocks(),
      ],
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    service = TestBed.inject(NavigationHistoryService);
    // Done at bootstrap in the app; lets Location.back() drive the router.
    router.setUpLocationChangeListener();
    await router.navigateByUrl("/program?tab=Exercises");
  });

  it("falls back when there is no previous page", async () => {
    service.back("/program");
    await settle();

    expect(router.url).toBe("/program");
  });

  it("returns to the page the user came from", async () => {
    await router.navigateByUrl("/current-workout/w1/e1");
    await router.navigateByUrl("/history/exercises/e1");

    service.back("/program?tab=Exercises");
    await settle();

    expect(router.url).toBe("/current-workout/w1/e1");
  });

  it("follows browser back and forward", async () => {
    await router.navigateByUrl("/a");
    await router.navigateByUrl("/b");
    location.back();
    await settle();
    location.back();
    await settle();

    expect(router.url).toBe("/program?tab=Exercises");
    expect(service.canGoBack).toBeFalse();

    location.forward();
    await settle();
    expect(router.url).toBe("/a");
    expect(service.canGoBack).toBeTrue();
  });

  it("does not count replaced pages", async () => {
    await router.navigateByUrl("/a");
    await router.navigateByUrl("/b", { replaceUrl: true });

    service.back("/fallback");
    await settle();

    expect(router.url).toBe("/program?tab=Exercises");
  });

  it("steps back when leaving for the page the user came from", async () => {
    await router.navigateByUrl("/program/workout/r1");
    await router.navigateByUrl("/program/workout/edit/r1/exercise/e1");

    service.leave("/program/workout/r1");
    await settle();

    expect(router.url).toBe("/program/workout/r1");
    service.back("/fallback");
    await settle();
    expect(router.url).toBe("/program?tab=Exercises");
  });

  it("replaces the finished page when leaving somewhere new", async () => {
    await router.navigateByUrl("/program/exercises/new");

    service.leave("/somewhere-else");
    await settle();

    expect(router.url).toBe("/somewhere-else");
    service.back("/fallback");
    await settle();
    expect(router.url).toBe("/program?tab=Exercises");
  });
});
