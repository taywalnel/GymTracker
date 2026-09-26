import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import { Router } from "@angular/router";

import { ButtonComponent } from "../button/button.component";

export interface PageHeaderTab {
  label: string;
  count?: number;
}

@Component({
  selector: "app-page-header",
  imports: [ButtonComponent],
  templateUrl: "./page-header.component.html",
  styleUrl: "./page-header.component.scss",
})
export class PageHeaderComponent {
  private readonly router = inject(Router);

  @Input() title: string | null = null;
  @Input() backLink: string | null = null;
  @Input() backLabel = "Back";
  @Input() showBack = false;
  @Input() rightActionLabel = "";
  @Input() showRightAction = false;
  @Input() tabs: (string | PageHeaderTab)[] = [];
  @Input() initialTab: string | null = null;
  @Output() back = new EventEmitter<void>();
  @Output() rightAction = new EventEmitter<void>();
  @Output() selectedTab = new EventEmitter<string>();

  activeTab: string | null = null;

  goBack(): void {
    if (this.backLink) {
      this.router.navigateByUrl(this.backLink);
    } else {
      this.back.emit();
    }
  }

  selectTab(tab: string): void {
    this.activeTab = tab;
    this.selectedTab.emit(tab);
  }

  isTabSelected(tab: string): boolean {
    return (
      (this.activeTab ?? this.initialTab ?? this.tabLabel(this.tabs[0])) === tab
    );
  }

  tabLabel(tab: string | PageHeaderTab): string {
    return typeof tab === "string" ? tab : tab.label;
  }

  tabCount(tab: string | PageHeaderTab): number | undefined {
    return typeof tab === "string" ? undefined : tab.count;
  }

  get selectedTabIndex(): number {
    const index = this.tabs.findIndex(
      (tab) =>
        this.tabLabel(tab) ===
        (this.activeTab ?? this.initialTab ?? this.tabLabel(this.tabs[0])),
    );
    return index < 0 ? 0 : index;
  }
}
