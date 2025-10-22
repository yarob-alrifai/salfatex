import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { connectAuthEmulator, getAuth, provideAuth } from '@angular/fire/auth';
import { connectFirestoreEmulator, getFirestore, provideFirestore } from '@angular/fire/firestore';
import { connectStorageEmulator, getStorage, provideStorage } from '@angular/fire/storage';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideFirebaseApp(() =>
      initializeApp({
        apiKey: 'AIzaSyAVNSghzLHRKtbZSljiamO322zijRqYCrQ',
        authDomain: 'salfatex-875b4.firebaseapp.com',
        databaseURL: 'https://salfatex-875b4-default-rtdb.firebaseio.com',
        projectId: 'salfatex-875b4',
        storageBucket: 'salfatex-875b4.firebasestorage.app',
        messagingSenderId: '585645464883',
        appId: '1:585645464883:web:3bbc30d8ede93c9ca43246',
        measurementId: 'G-GYT6VE58X1',
        // projectNumber: '585645464883',
        // version: '2',
      })
    ),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),

    // provideFirebaseApp(() =>
    //   initializeApp({
    //     projectId: 'demo-project',
    //     appId: '1:demo:web:local',
    //     storageBucket: 'demo-project.appspot.com',
    //     apiKey: 'fake-api-key',
    //     authDomain: 'localhost',
    //     messagingSenderId: '123456789',
    //   })
    // ),

    // provideAuth(() => {
    //   const auth = getAuth();
    //   connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    //   return auth;
    // }),

    // provideFirestore(() => {
    //   const firestore = getFirestore();
    //   connectFirestoreEmulator(firestore, 'localhost', 8081);
    //   return firestore;
    // }),

    // provideStorage(() => {
    //   const storage = getStorage();
    //   connectStorageEmulator(storage, 'localhost', 9199);
    //   return storage;
    // }),
  ],
};
