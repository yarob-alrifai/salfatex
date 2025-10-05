import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth, User, authState, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Firestore, collection, doc, getDoc, getDocs, query, where } from '@angular/fire/firestore';
import { Router } from '@angular/router';

export interface AdminProfile {
  id: string;
  email: string;
  displayName?: string;
  role?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);

  private readonly loadingSignal = signal(false);
  private readonly currentAdminSignal = signal<AdminProfile | null>(null);

  readonly loading = computed(() => this.loadingSignal());
  readonly currentAdmin = computed(() => this.currentAdminSignal());
  readonly isLoggedIn = computed(() => this.currentAdminSignal() !== null);

  constructor() {
    authState(this.auth).subscribe(async (user) => {
      if (!user) {
        this.currentAdminSignal.set(null);
        return;
      }

      const adminProfile = await this.fetchAdminProfile(user);

      if (!adminProfile) {
        await signOut(this.auth);
        this.currentAdminSignal.set(null);
        return;
      }

      this.currentAdminSignal.set(adminProfile);
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    this.loadingSignal.set(true);

    try {
      // تحقق من البريد وكلمة المرور مباشرة عبر Firebase Auth
      console.log({ email, password });
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      console.log(credential.user);

      // اجلب الملف التعريفي من Firestore للتحقق من كونه "أدمن"
      // const adminProfile = await this.fetchAdminProfile(credential.user);

      // if (!adminProfile) {
      //   await signOut(this.auth);
      //   throw new Error('لا يمتلك هذا المستخدم صلاحيات إدارية.');
      // }

      const adminProfile = {
        id: credential.user.uid,
        email: credential.user.email ?? email,
        displayName: credential.user.displayName ?? undefined,
        role: 'admin', // or hardcode whatever default role you want
      };

      this.currentAdminSignal.set(adminProfile);

      // التوجيه بعد تسجيل الدخول
      await this.router.navigate(['/admin/orders']);
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
    await this.router.navigate(['/admin/login']);
  }

  private async fetchAdminProfile(user: User): Promise<AdminProfile | null> {
    const profileDoc = doc(this.firestore, 'adminProfiles', user.uid);
    const snapshot = await getDoc(profileDoc);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as Partial<AdminProfile>;

    return {
      id: snapshot.id,
      email: data.email ?? user.email ?? '',
      displayName: data.displayName ?? user.displayName ?? undefined,
      role: data.role ?? 'admin',
    };
  }
}
