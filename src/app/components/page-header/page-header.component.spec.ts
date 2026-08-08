import { PageHeaderComponent } from "./page-header.component";

describe("PageHeaderComponent tabs", () => {
  it("selects the first tab by default", () => {
    const component = new PageHeaderComponent();
    component.tabs = ["Overview", "History"];

    expect(component.isTabSelected("Overview")).toBeTrue();
    expect(component.isTabSelected("History")).toBeFalse();
  });

  it("updates the selected tab and emits it", () => {
    const component = new PageHeaderComponent();
    const selectedTab = jasmine.createSpy("selectedTab");
    component.selectedTab.subscribe(selectedTab);
    component.tabs = ["Overview", "History"];

    component.selectTab("History");

    expect(component.isTabSelected("History")).toBeTrue();
    expect(component.isTabSelected("Overview")).toBeFalse();
    expect(selectedTab).toHaveBeenCalledOnceWith("History");
  });
});
