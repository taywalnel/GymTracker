import { Component, EventEmitter, Input, Output } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "app-page-header",
  imports: [RouterLink],
  templateUrl: "./page-header.component.html",
  styleUrl: "./page-header.component.scss",
})
export class PageHeaderComponent {
  @Input() title: string | null = null;
  @Input() backLink: string | null = null;
  @Input() backLabel = "Back";
  @Input() showBack = false;
  @Input() rightActionLabel = "";
  @Input() showRightAction = false;
  @Input() tabs: string[] = [];
  @Output() back = new EventEmitter<void>();
  @Output() rightAction = new EventEmitter<void>();
  @Output() selectedTab = new EventEmitter<string>();

  activeTab: string | null = null;

  selectTab(tab: string): void {
    this.activeTab = tab;
    this.selectedTab.emit(tab);
  }

  isTabSelected(tab: string): boolean {
    return (this.activeTab ?? this.tabs[0]) === tab;
  }

  get selectedTabIndex(): number {
    const index = this.tabs.indexOf(this.activeTab ?? this.tabs[0]);
    return index < 0 ? 0 : index;
  }
}
