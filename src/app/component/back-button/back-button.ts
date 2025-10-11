import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { Location } from '@angular/common';

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
  @Input() icon = '↩︎';

  private readonly location = inject(Location);

  goBack(): void {
    this.location.back();
  }
}
