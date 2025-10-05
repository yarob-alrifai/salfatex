import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-shell.html',
  styleUrls: ['./admin-shell.scss'],
})
export class AdminShellComponent {
  private readonly authService = inject(AuthService);

  readonly admin = computed(() => this.authService.currentAdmin());
  readonly loading = computed(() => this.authService.loading());

  async signOut() {
    await this.authService.signOut();
  }
}
