import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth, User, authState, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';

import { Router } from '@angular/router';

export interface AdminProfile {
  id: string;
  email: string;
  displayName?: string;
  role?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private static readonly STORAGE_KEY = 'salfatex-admin-profile';

  private readonly auth = inject(Auth);

  private readonly router = inject(Router);

  private readonly loadingSignal = signal(false);
  private readonly currentAdminSignal = signal<AdminProfile | null>(null);
  private readonly authResolvedSignal = signal(false);

  readonly loading = computed(() => this.loadingSignal());
  readonly currentAdmin = computed(() => this.currentAdminSignal());
  readonly isLoggedIn = computed(() => this.currentAdminSignal() !== null);
  readonly authResolved = computed(() => this.authResolvedSignal());

  constructor() {
    this.restorePersistedAdmin();

    authState(this.auth).subscribe((user) => {
      this.authResolvedSignal.set(false);
      try {
        if (!user) {
          this.currentAdminSignal.set(null);
          this.persistAdminProfile(null);

          return;
        }

        this.currentAdminSignal.set(this.mapUserToAdminProfile(user));
        const profile = this.mapUserToAdminProfile(user);

        this.currentAdminSignal.set(profile);
        this.persistAdminProfile(profile);
      } catch (error) {
        console.error('فشل التحقق من المستخدم الإداري', error);

        this.currentAdminSignal.set(null);
        this.persistAdminProfile(null);
      } finally {
        this.authResolvedSignal.set(true);
      }
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    this.loadingSignal.set(true);

    try {
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      console.log({ user: credential });

      const profile = this.mapUserToAdminProfile(credential.user);

      this.currentAdminSignal.set(profile);
      this.persistAdminProfile(profile);

      this.authResolvedSignal.set(true);

      // التوجيه بعد تسجيل الدخول
      await this.router.navigate(['/admin/orders']);
    } catch (error) {
      this.authResolvedSignal.set(true);
      if (error instanceof Error) {
        throw error;
      }

      throw new Error('فشل تسجيل الدخول.');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  // async signIn(email: string, password: string): Promise<void> {
  //   this.loadingSignal.set(true);

  //   try {
  //     const credentialQuery = query(
  //       collection(this.firestore, 'adminCredentials'),
  //       where('email', '==', email)
  //     );
  //     const credentialSnapshot = await getDocs(credentialQuery);

  //     if (credentialSnapshot.empty) {
  //       throw new Error('لا يوجد حساب إداري مطابق.');
  //     }

  //     const storedCredential = credentialSnapshot.docs[0].data() as {
  //       email: string;
  //       password: string;
  //     };

  //     if (storedCredential.password !== password) {
  //       throw new Error('كلمة المرور غير صحيحة.');
  //     }

  //     const credential = await signInWithEmailAndPassword(this.auth, email, password);
  //     const adminProfile = await this.fetchAdminProfile(credential.user);

  //     if (!adminProfile) {
  //       await signOut(this.auth);
  //       throw new Error('لا يمتلك هذا المستخدم صلاحيات إدارية.');
  //     }

  //     this.currentAdminSignal.set(adminProfile);
  //     await this.router.navigate(['/admin/orders']);
  //   } finally {
  //     this.loadingSignal.set(false);
  //   }
  // }

  async signOut(): Promise<void> {
    await signOut(this.auth);
    this.currentAdminSignal.set(null);
    this.persistAdminProfile(null);

    this.authResolvedSignal.set(true);

    await this.router.navigate(['/admin/login']);
  }

  private mapUserToAdminProfile(user: User): AdminProfile {
    return {
      id: user.uid,
      email: user.email ?? '',
      displayName: user.displayName ?? undefined,
      role: 'admin',
    };
  }

  private persistAdminProfile(profile: AdminProfile | null): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (profile) {
      window.localStorage.setItem(AuthService.STORAGE_KEY, JSON.stringify(profile));
    } else {
      window.localStorage.removeItem(AuthService.STORAGE_KEY);
    }
  }

  private restorePersistedAdmin(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const persistedProfile = window.localStorage.getItem(AuthService.STORAGE_KEY);

    if (!persistedProfile) {
      return;
    }

    try {
      const admin = JSON.parse(persistedProfile) as AdminProfile;

      this.currentAdminSignal.set(admin);
    } catch (error) {
      console.warn('تعذر استعادة بيانات المشرف المخزنة.', error);
      window.localStorage.removeItem(AuthService.STORAGE_KEY);
    }
  }
}
