import { Component, computed, inject, signal } from '@angular/core';

import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-main-admin',
  templateUrl: './main-admin.component.html',
  styleUrl: './main-admin.component.scss',
  imports: [RouterOutlet, RouterOutlet, RouterLink, RouterLinkActive],
})
export class MainAdminComponent {
  private readonly authService = inject(AuthService);

  readonly admin = computed(() => this.authService.currentAdmin());
  readonly loading = computed(() => this.authService.loading());
  readonly sidebarOpen = signal(false);

  toggleSidebar() {
    this.sidebarOpen.update((value) => !value);
  }

  closeSidebar() {
    this.sidebarOpen.set(false);
  }
  async signOut() {
    await this.authService.signOut();
  }
}
