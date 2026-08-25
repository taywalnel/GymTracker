import { RestTimerService } from "./rest-timer.service";

describe("RestTimerService", () => {
  let service: RestTimerService;

  beforeEach(() => {
    jasmine.clock().install();
    service = new RestTimerService();
  });

  afterEach(() => {
    service.ngOnDestroy();
    jasmine.clock().uninstall();
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
});
