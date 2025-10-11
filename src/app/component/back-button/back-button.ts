import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, computed, inject } from '@angular/core';
import { NavigationService } from 'src/app/services/navigation.service';

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './back-button.html',
  styleUrls: ['./back-button.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackButtonComponent {
  @Input() label = 'العودة';
  @Input() fallbackLabel = 'العودة إلى الرئيسية';
  @Input() fallbackUrl = '/';

  @Input() icon = '↩︎';

  private readonly navigation = inject(NavigationService);

  readonly canGoBack = this.navigation.canGoBack;

  readonly displayLabel = computed(() =>
    this.canGoBack() ? this.label : this.fallbackLabel || this.label
  );

  async goBack(): Promise<void> {
    await this.navigation.goBack(this.fallbackUrl);
  }
}
