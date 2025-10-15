import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, Signal, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminDataService } from '../../admin-data.service';
import { ContactInfo, EMPTY_CONTACT_INFO } from 'src/app/models/contact-info.model';

@Component({
  selector: 'app-contact-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contact-settings.html',
  styleUrls: ['./contact-settings.scss'],
})
export class ContactSettingsComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly adminDataService = inject(AdminDataService);

  readonly form = this.fb.nonNullable.group({
    phone: ['', [Validators.pattern(/^[+\d\s()-]*$/)]],
    mobile: ['', [Validators.pattern(/^[+\d\s()-]*$/)]],
    email: ['', [Validators.email]],
    address: [''],
    whatsappUrl: ['', [Validators.pattern(/^https?:\/\//i)]],
    telegramUrl: ['', [Validators.pattern(/^https?:\/\//i)]],
  });

  readonly loading = signal(false);
  readonly feedback = signal<string>('');

  readonly whatsappQrPreview = signal<string>('');
  private whatsappQrFile: File | null = null;
  private whatsappQrObjectUrl: string | null = null;
  private initialWhatsappQrUrl = '';
  private readonly removeWhatsappQr = signal(false);

  readonly isDirty: Signal<boolean> = computed(
    () => this.form.dirty || this.removeWhatsappQr() || !!this.whatsappQrFile
  );

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.feedback.set('');

    try {
      const info = await this.adminDataService.getContactInfo();
      this.initialWhatsappQrUrl = info.whatsappQrUrl;
      this.whatsappQrPreview.set(info.whatsappQrUrl);
      this.form.reset(this.toFormValue(info), { emitEvent: false });
      this.form.markAsPristine();
    } catch (error) {
      console.error('Failed to load contact info', error);
      this.feedback.set('تعذر تحميل بيانات الاتصال. حاول مرة أخرى.');
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.revokeObjectUrl();
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.feedback.set('');

    try {
      const value = this.form.getRawValue();
      await this.adminDataService.updateContactInfo(value, {
        whatsappQrFile: this.whatsappQrFile,
        removeWhatsappQr: this.removeWhatsappQr(),
      });

      const refreshed = await this.adminDataService.getContactInfo();
      this.initialWhatsappQrUrl = refreshed.whatsappQrUrl;
      this.whatsappQrPreview.set(refreshed.whatsappQrUrl);
      this.form.reset(this.toFormValue(refreshed));
      this.form.markAsPristine();
      this.revokeObjectUrl();
      this.whatsappQrFile = null;
      this.removeWhatsappQr.set(false);
      this.feedback.set('تم حفظ بيانات الاتصال بنجاح.');
    } catch (error) {
      console.error('Failed to save contact info', error);
      this.feedback.set('تعذر حفظ البيانات. حاول مرة أخرى.');
    } finally {
      this.loading.set(false);
    }
  }

  onWhatsappQrChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.resetQrSelection();
      return;
    }

    this.revokeObjectUrl();

    this.whatsappQrFile = file;
    const preview = URL.createObjectURL(file);
    this.whatsappQrObjectUrl = preview;
    this.whatsappQrPreview.set(preview);
    this.removeWhatsappQr.set(false);
  }

  clearWhatsappQr(): void {
    this.resetQrSelection();

    if (this.initialWhatsappQrUrl) {
      this.whatsappQrPreview.set('');
      this.removeWhatsappQr.set(true);
    }
  }

  private toFormValue(info: ContactInfo): ContactInfo {
    return {
      ...EMPTY_CONTACT_INFO,
      ...info,
    };
  }

  private resetQrSelection(): void {
    this.revokeObjectUrl();
    this.whatsappQrFile = null;
    this.whatsappQrPreview.set(this.initialWhatsappQrUrl);
    this.removeWhatsappQr.set(false);
    if (typeof document !== 'undefined') {
      const input = document.getElementById('whatsappQrInput') as HTMLInputElement | null;
      if (input) {
        input.value = '';
      }
    }
  }

  private revokeObjectUrl(): void {
    if (this.whatsappQrObjectUrl) {
      URL.revokeObjectURL(this.whatsappQrObjectUrl);
      this.whatsappQrObjectUrl = null;
    }
  }
}
