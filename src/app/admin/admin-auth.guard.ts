import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { map, tap } from 'rxjs';
import { AuthService } from './auth.service';

const evaluateAuthState = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return toObservable(authService.isLoggedIn).pipe(
    tap((loggedIn) => {
      if (!loggedIn) {
        router.navigate(['/admin/login']);
      }
    }),
    map((loggedIn) => loggedIn)
  );
};

export const adminAuthGuard: CanActivateFn = () => evaluateAuthState();

export const adminAuthChildGuard: CanActivateChildFn = () => evaluateAuthState();
