import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly router = inject(Router);
  private readonly history = signal<string[]>([]);

  readonly canGoBack: Signal<boolean> = computed(() => this.history().length > 1);

  constructor() {
    const initialUrl = this.router.url || '/';
    this.history.set([initialUrl]);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = event.urlAfterRedirects;
        this.history.update((history) => {
          if (history[history.length - 1] === url) {
            return history;
          }

          const nextHistory = [...history, url];
          const maxLength = 50;
          if (nextHistory.length > maxLength) {
            return nextHistory.slice(nextHistory.length - maxLength);
          }

          return nextHistory;
        });
      });
  }

  async goBack(fallbackUrl: string): Promise<boolean> {
    const history = this.history();

    if (history.length > 1) {
      const updatedHistory = history.slice(0, -1);
      const target = updatedHistory[updatedHistory.length - 1];

      this.history.set(updatedHistory);

      if (target) {
        return this.router.navigateByUrl(target, { replaceUrl: true });
      }
    }

    this.history.set([fallbackUrl]);
    return this.router.navigateByUrl(fallbackUrl, { replaceUrl: true });
  }
}
