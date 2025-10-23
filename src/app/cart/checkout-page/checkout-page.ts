import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  Signal,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { CartItem, CartSnapshot, CustomerInfo } from '../../models/cart.models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BackButtonComponent } from 'src/app/component/back-button/back-button';

interface CheckoutConfirmation {
  info: CustomerInfo;
  snapshot: CartSnapshot;
  createdAt: Date;

  orderNumber: string | null;
}

type RecaptchaCallback = (token: string) => void;

interface Grecaptcha {
  render(
    container: HTMLElement,
    parameters: {
      sitekey: string;
      callback?: RecaptchaCallback;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
      size?: 'normal' | 'compact' | 'invisible';
      theme?: 'light' | 'dark';
    }
  ): number;
  reset(widgetId?: number): void;
  ready?(callback: () => void): void;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const RECAPTCHA_SCRIPT_ID = 'google-recaptcha-script';

let recaptchaLoader: Promise<void> | null = null;

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, BackButtonComponent],
  templateUrl: './checkout-page.html',
  styleUrls: ['./checkout-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPageComponent implements AfterViewInit {
  private readonly cart = inject(CartService);
  private readonly fb = inject(FormBuilder);
  private readonly zone = inject(NgZone);

  private readonly storage: Storage | null =
    typeof window === 'undefined' ? null : window.localStorage;
  private readonly customerInfoStorageKey = 'checkout.customer-info';
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly recaptchaLoadError = signal<string | null>(null);

  readonly items: Signal<CartItem[]> = this.cart.items;
  readonly totalPrice = this.cart.total;
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    restaurantName: ['', Validators.required],
    address: ['', Validators.required],
    phone: ['', [Validators.required, Validators.minLength(8)]],

    notes: [''],
    recaptchaToken: ['', Validators.required],
  });

  readonly confirmation = signal<CheckoutConfirmation | null>(null);

  @ViewChild('recaptchaContainer')
  private recaptchaContainer?: ElementRef<HTMLDivElement>;
  private recaptchaWidgetId: number | null = null;
  private readonly recaptchaSiteKey = this.resolveRecaptchaSiteKey();

  constructor() {
    this.restoreCustomerInfo();

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const { recaptchaToken: _recaptchaToken, ...customerInfo } = value;
      this.saveCustomerInfo(customerInfo);
    });
  }

  ngAfterViewInit(): void {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(() => this.initializeRecaptcha());
      return;
    }

    Promise.resolve().then(() => this.initializeRecaptcha());
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    const { recaptchaToken, ...customerFields } = rawValue;
    const info = this.normalizeCustomerInfo(customerFields);
    const itemsSnapshot = this.items().map((item) => ({
      ...item,
      unit: { ...item.unit },
    }));

    const snapshot: CartSnapshot = {
      items: itemsSnapshot,
      total: this.totalPrice(),
    };

    if (!snapshot.items.length) {
      this.errorMessage.set('Корзина пуста. Добавьте товары перед оформлением заказа.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    try {
      const notes = this.composeNotes(info.notes);
      const order = await this.cart.submitOrder({
        customerName: info.name,
        customerEmail: info.email || undefined,
        customerPhone: info.phone || undefined,
        restaurantName: info.restaurantName || undefined,
        shippingAddress: info.address,
        notes,
        recaptchaToken,
      });

      this.confirmation.set({
        info,
        snapshot,
        createdAt: order.createdAt.toDate(),
        orderNumber: order.orderNumber ?? order.id ?? null,
      });
      const persisted = this.saveCustomerInfo(info) ?? info;
      this.form.reset(
        {
          ...persisted,
          notes: persisted.notes ?? '',
          recaptchaToken: '',
        },
        { emitEvent: false }
      );
      this.resetRecaptcha();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось отправить заказ. Попробуйте позже.';
      this.errorMessage.set(message);
    } finally {
      this.submitting.set(false);
    }
  }

  trackByProduct(_index: number, item: CartItem): string {
    return `${item.product.id}-${item.unit.type}`;
  }

  private composeNotes(notes?: string): string | undefined {
    const details: string[] = [];

    const trimmedNotes = notes?.trim();

    if (trimmedNotes) {
      details.push(trimmedNotes);
    }

    if (!details.length) {
      return undefined;
    }

    return details.join('\n');
  }

  private restoreCustomerInfo(): void {
    const saved = this.loadCustomerInfo();

    if (!saved) {
      return;
    }

    this.form.patchValue(
      {
        ...saved,
        notes: saved.notes ?? '',
      },
      { emitEvent: false }
    );
  }

  private loadCustomerInfo(): CustomerInfo | null {
    if (!this.storage) {
      return null;
    }

    const raw = this.storage.getItem(this.customerInfoStorageKey);

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<CustomerInfo>;
      return this.normalizeCustomerInfo(parsed);
    } catch {
      this.storage.removeItem(this.customerInfoStorageKey);
      return null;
    }
  }

  private saveCustomerInfo(
    value: Partial<CustomerInfo> & { notes?: string | null }
  ): CustomerInfo | null {
    if (!this.storage) {
      return null;
    }

    const normalized = this.normalizeCustomerInfo(value);
    const hasMeaningfulData = Boolean(
      normalized.name ||
        normalized.email ||
        normalized.restaurantName ||
        normalized.phone ||
        normalized.address ||
        normalized.notes
    );

    if (!hasMeaningfulData) {
      this.storage.removeItem(this.customerInfoStorageKey);
      return null;
    }

    this.storage.setItem(this.customerInfoStorageKey, JSON.stringify(normalized));
    return normalized;
  }

  private normalizeCustomerInfo(
    value: Partial<CustomerInfo> & { notes?: string | null }
  ): CustomerInfo {
    const name = value.name?.toString().trim() ?? '';
    const email = value.email?.toString().trim() ?? '';
    const restaurantName = value.restaurantName?.toString().trim() ?? '';
    const phone = value.phone?.toString().trim() ?? '';

    const address = value.address?.toString().trim() ?? '';
    const notes = value.notes?.toString().trim() || undefined;

    return {
      name,
      email,
      restaurantName,
      phone,
      address,
      notes,
    };
  }

  private resolveRecaptchaSiteKey(): string {
    if (typeof document === 'undefined') {
      return '';
    }

    const preferredMeta = document.querySelector(
      'meta[name="google-recaptcha-site-key"], meta[name="recaptcha-site-key"]'
    );
    const content = preferredMeta?.getAttribute('content')?.trim();

    if (content) {
      return content;
    }

    const metaEnv = (
      import.meta as ImportMeta & {
        env?: Record<string, string | undefined>;
      }
    ).env;

    const envKey = metaEnv?.['NG_APP_RECAPTCHA_SITE_KEY']?.trim();

    if (envKey) {
      return envKey;
    }

    const globalKey = (globalThis as typeof globalThis & { NG_APP_RECAPTCHA_SITE_KEY?: string })
      .NG_APP_RECAPTCHA_SITE_KEY;

    return globalKey?.trim() ?? '';
  }

  private async initializeRecaptcha(): Promise<void> {
    if (typeof window === 'undefined' || this.recaptchaWidgetId !== null) {
      return;
    }

    const container = this.recaptchaContainer?.nativeElement;

    if (!container) {
      return;
    }

    if (!this.recaptchaSiteKey) {
      this.recaptchaLoadError.set(
        'Ключ reCAPTCHA не настроен. Свяжитесь с командой поддержки, чтобы активировать сервис.'
      );
      return;
    }

    try {
      await this.loadRecaptchaScript();
      const grecaptcha = window.grecaptcha;

      if (!grecaptcha?.render) {
        throw new Error('Не удалось инициализировать reCAPTCHA.');
      }

      this.recaptchaWidgetId = grecaptcha.render(container, {
        sitekey: this.recaptchaSiteKey,
        callback: (token) => this.zone.run(() => this.onRecaptchaResolved(token)),
        'expired-callback': () => this.zone.run(() => this.onRecaptchaExpired()),
        'error-callback': () => this.zone.run(() => this.onRecaptchaError()),
      });
      this.recaptchaLoadError.set(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось загрузить службу reCAPTCHA.';
      this.recaptchaLoadError.set(message);
    }
  }

  private loadRecaptchaScript(): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('reCAPTCHA недоступна в текущем окружении.'));
    }

    const grecaptcha = window.grecaptcha;

    if (grecaptcha?.render) {
      if (typeof grecaptcha.ready === 'function') {
        return new Promise((resolve) => grecaptcha.ready!(resolve));
      }

      return Promise.resolve();
    }

    if (recaptchaLoader) {
      return recaptchaLoader;
    }

    recaptchaLoader = new Promise<void>((resolve, reject) => {
      const existingScript = document.getElementById(
        RECAPTCHA_SCRIPT_ID
      ) as HTMLScriptElement | null;

      if (existingScript) {
        if (existingScript.dataset['loaded'] === 'true') {
          resolve();
          return;
        }
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener(
          'error',
          () => reject(new Error('Не удалось загрузить службу reCAPTCHA.')),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.id = RECAPTCHA_SCRIPT_ID;
      script.src = 'https://www.google.com/recaptcha/api.js?hl=ru';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        script.dataset['loaded'] = 'true';
        const loadedGrecaptcha = window.grecaptcha;
        if (loadedGrecaptcha?.ready) {
          loadedGrecaptcha.ready(() => resolve());
          return;
        }
        resolve();
      };
      script.onerror = () => reject(new Error('Не удалось загрузить службу reCAPTCHA.'));
      document.body.appendChild(script);
    });

    return recaptchaLoader.then(
      () => undefined,
      (error) => {
        recaptchaLoader = null;
        throw error;
      }
    );
  }

  private onRecaptchaResolved(token: string): void {
    this.form.controls.recaptchaToken.setValue(token);
    this.form.controls.recaptchaToken.markAsDirty();
    this.form.controls.recaptchaToken.markAsTouched();
    this.form.controls.recaptchaToken.updateValueAndValidity();
    this.recaptchaLoadError.set(null);
  }

  private onRecaptchaExpired(): void {
    this.form.controls.recaptchaToken.reset('', { emitEvent: false });
    this.form.controls.recaptchaToken.markAsTouched();
    this.form.controls.recaptchaToken.setErrors({ required: true });
    this.recaptchaLoadError.set('Срок действия проверки истёк. Попробуйте ещё раз.');
    if (this.recaptchaWidgetId !== null) {
      window.grecaptcha?.reset(this.recaptchaWidgetId);
    }
  }

  private onRecaptchaError(): void {
    this.form.controls.recaptchaToken.reset('', { emitEvent: false });
    this.form.controls.recaptchaToken.markAsTouched();
    this.recaptchaLoadError.set('Произошла ошибка при проверке. Повторите попытку.');
    if (this.recaptchaWidgetId !== null) {
      window.grecaptcha?.reset(this.recaptchaWidgetId);
    }
  }

  private resetRecaptcha(): void {
    this.form.controls.recaptchaToken.reset('', { emitEvent: false });
    if (this.recaptchaWidgetId !== null) {
      window.grecaptcha?.reset(this.recaptchaWidgetId);
    }
    this.recaptchaLoadError.set(null);
  }
}
