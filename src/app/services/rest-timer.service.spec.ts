import { RestTimerService } from "./rest-timer.service";

describe("RestTimerService", () => {
  let service: RestTimerService;

  beforeEach(() => {
    localStorage.removeItem("gym:restTimer");
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 0, 1));
    service = new RestTimerService();
  });

  afterEach(() => {
    service.ngOnDestroy();
    jasmine.clock().uninstall();
    localStorage.removeItem("gym:restTimer");
  });

  it("uses 60 seconds when no duration is provided", () => {
    service.start();

    expect(service.duration).toBe(60);
    expect(service.secondsLeft).toBe(60);
  });

  it("uses the configured duration", () => {
    service.start(45);

    expect(service.duration).toBe(45);
    expect(service.secondsLeft).toBe(45);
  });

  it("does not start a countdown for an explicit zero duration", () => {
    service.start(0);

    expect(service.duration).toBe(0);
    expect(service.secondsLeft).toBeNull();
  });

  it("resumes a running rest in a new instance", () => {
    service.start(90);
    jasmine.clock().tick(30_000);

    const restored = new RestTimerService();

    expect(restored.duration).toBe(90);
    expect(restored.secondsLeft).toBe(60);
    restored.ngOnDestroy();
  });

  it("does not resume a rest that has already ended", () => {
    service.start(30);
    jasmine.clock().tick(31_000);

    const restored = new RestTimerService();

    expect(restored.secondsLeft).toBeNull();
    restored.ngOnDestroy();
  });

  it("does not resume a skipped rest", () => {
    service.start(30);
    service.clear();

    const restored = new RestTimerService();

    expect(restored.secondsLeft).toBeNull();
    restored.ngOnDestroy();
  });
});
