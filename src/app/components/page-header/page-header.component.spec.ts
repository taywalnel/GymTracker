import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { PageHeaderComponent } from "./page-header.component";

describe("PageHeaderComponent tabs", () => {
  function createComponent(): PageHeaderComponent {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    return TestBed.runInInjectionContext(() => new PageHeaderComponent());
  }

  it("selects the first tab by default", () => {
    const component = createComponent();
    component.tabs = ["Overview", "History"];

    expect(component.isTabSelected("Overview")).toBeTrue();
    expect(component.isTabSelected("History")).toBeFalse();
  });

  it("updates the selected tab and emits it", () => {
    const component = createComponent();
    const selectedTab = jasmine.createSpy("selectedTab");
    component.selectedTab.subscribe(selectedTab);
    component.tabs = ["Overview", "History"];

    component.selectTab("History");

    expect(component.isTabSelected("History")).toBeTrue();
    expect(component.isTabSelected("Overview")).toBeFalse();
    expect(selectedTab).toHaveBeenCalledOnceWith("History");
  });
});
