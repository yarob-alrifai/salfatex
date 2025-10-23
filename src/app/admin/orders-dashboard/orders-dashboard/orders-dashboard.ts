import { AsyncPipe, CommonModule, CurrencyPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, inject, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, map, startWith, tap } from 'rxjs';
import { AdminDataService, AdminOrder } from '../../admin-data.service';

@Component({
  selector: 'app-orders-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgFor, AsyncPipe, DatePipe, CurrencyPipe, CommonModule],
  templateUrl: './orders-dashboard.html',
  styleUrls: ['./orders-dashboard.scss'],
})
export class OrdersDashboardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminDataService = inject(AdminDataService);
  private readonly pageIndexSubject = new BehaviorSubject(0);

  readonly filterForm = this.fb.nonNullable.group({
    status: [''],
    startDate: [''],
    endDate: [''],
  });

  readonly editForm = this.fb.nonNullable.group({
    id: [''],
    status: [''],
    notes: [''],
    shippingAddress: [''],
  });

  readonly orders$ = this.adminDataService.orders$;
  readonly overallStats$ = this.orders$.pipe(
    map((orders) => ({
      count: orders.length,
      total: orders.reduce(
        (sum, order) => sum + (order.status === 'delivered' ? order.total ?? 0 : 0),
        0
      ),
    }))
  );

  readonly filteredOrders$ = combineLatest([
    this.orders$,
    this.filterForm.valueChanges.pipe(startWith(this.filterForm.getRawValue())),
  ]).pipe(
    map(([orders, filters]) => {
      return orders.filter((order) => {
        const statusMatches = filters.status ? order.status === filters.status : true;
        const createdAt = this.parseDate(order.createdAt);

        const startMatches = filters.startDate ? createdAt >= new Date(filters.startDate) : true;
        const endMatches = filters.endDate ? createdAt <= new Date(filters.endDate) : true;

        return statusMatches && startMatches && endMatches;
      });
    }),
    tap(() => this.pageIndexSubject.next(0))
  );

  readonly filteredStats$ = this.filteredOrders$.pipe(
    map((orders) => ({
      count: orders.length,
      total: orders.reduce(
        (sum, order) => sum + (order.status === 'delivered' ? order.total ?? 0 : 0),
        0
      ),
    }))
  );

  readonly statuses: AdminOrder['status'][] = [
    'pending',
    'confirmed',
    'shipped',
    'delivered',
    'cancelled',
  ];

  readonly feedback = signal('');
  readonly error = signal('');
  readonly editingOrderId = signal<string | null>(null);
  readonly selectedOrder = signal<AdminOrder | null>(null);
  readonly isModalOpen = computed(() => this.selectedOrder() !== null);
  readonly toDate = (value: unknown) => this.parseDate(value);
  readonly pageSize = 10;

  readonly statusStyles: Record<AdminOrder['status'], string> = {
    pending: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200',
    confirmed: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200',
    shipped: 'bg-indigo-100 text-indigo-800 ring-1 ring-inset ring-indigo-200',
    delivered: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200',
    cancelled: 'bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-200',
  };

  readonly trackByOrder = (_: number, order: AdminOrder) =>
    order.id ?? order.orderNumber ?? String(_);
  readonly trackByItem = (_: number, item: AdminOrder['items'][number]) =>
    item.productId ?? item.name ?? String(_);
  readonly getOrderTotal = (order?: AdminOrder | null) => order?.total ?? 0;
  readonly paginatedOrders$ = combineLatest([
    this.filteredOrders$,
    this.pageIndexSubject.asObservable(),
  ]).pipe(
    map(([orders, pageIndex]) => {
      const total = orders.length;
      const totalPages = Math.ceil(total / this.pageSize);
      const safePageIndex = totalPages ? Math.min(Math.max(pageIndex, 0), totalPages - 1) : 0;
      const startIndex = total === 0 ? 0 : safePageIndex * this.pageSize + 1;
      const endIndex = total === 0 ? 0 : Math.min((safePageIndex + 1) * this.pageSize, total);

      return {
        items: orders.slice(
          safePageIndex * this.pageSize,
          safePageIndex * this.pageSize + this.pageSize
        ),
        total,
        totalPages,
        pageIndex: safePageIndex,
        startIndex,
        endIndex,
        pages: Array.from({ length: totalPages }, (_, i) => i),
      };
    })
  );
  async confirmStatus(order: AdminOrder, status: AdminOrder['status']) {
    if (!order.id) {
      return;
    }

    await this.adminDataService.updateOrderStatus(order.id, status);
    this.feedback.set('تم تحديث حالة الطلب.');
    this.error.set('');
  }

  openOrderDetails(order: AdminOrder) {
    this.selectedOrder.set(order);
    this.editingOrderId.set(null);
    this.editForm.reset();
  }

  closeOrderDetails() {
    this.selectedOrder.set(null);
    this.cancelEdit();
  }

  editOrder(order: AdminOrder, event?: Event) {
    event?.stopPropagation();
    this.openOrderDetails(order);
    this.editingOrderId.set(order.id ?? null);
    this.editForm.patchValue({
      id: order.id ?? '',
      status: order.status,
      notes: order.notes ?? '',
      shippingAddress: order.shippingAddress ?? '',
    });
  }

  cancelEdit() {
    this.editingOrderId.set(null);
    this.editForm.reset();
  }

  async saveEdit() {
    if (!this.editForm.value.id) {
      return;
    }

    try {
      await this.adminDataService.updateOrder(this.editForm.value.id, {
        status: this.editForm.value.status as AdminOrder['status'],
        notes: this.editForm.value.notes ?? '',
        shippingAddress: this.editForm.value.shippingAddress ?? '',
      });
      this.feedback.set('تم تحديث الطلب.');
      this.error.set('');
      this.cancelEdit();
    } catch (err: any) {
      this.error.set(err?.message ?? 'تعذر تحديث الطلب.');
    }
  }

  async deleteOrder(order: AdminOrder, event?: Event) {
    event?.stopPropagation();
    if (!order.id) {
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm('هل أنت متأكد من أنك تريد حذف العنصر؟')) {
      return;
    }

    await this.adminDataService.deleteOrder(order.id);
    this.feedback.set('تم حذف الطلب.');
    this.error.set('');
    this.closeOrderDetails();
  }

  printOrder(order: AdminOrder, event?: Event) {
    event?.stopPropagation();
    if (!order) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=620');
    if (!printWindow) {
      this.error.set('تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة والمحاولة مرة أخرى.');
      return;
    }

    const formatCurrency = (value: number | null | undefined) =>
      new Intl.NumberFormat('ar-SA', {
        style: 'currency',
        currency: 'SAR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value ?? 0);

    const escapeHtml = (value: unknown) =>
      String(value ?? '—')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const formatMultiline = (value: unknown) => escapeHtml(value).replace(/\n/g, '<br />');

    const formattedCreatedAt = this.parseDate(order.createdAt).toLocaleString('ar-SA');
    const generatedAt = new Date().toLocaleString('ar-SA');
    const orderNumber = escapeHtml(order.orderNumber ?? order.id ?? 'غير متوفر');
    const status = escapeHtml(order.status ?? '—');
    const customerName = escapeHtml(order.customerName ?? 'عميل بدون اسم');
    const customerEmail = escapeHtml(order.customerEmail ?? '—');
    const customerPhone = escapeHtml(order.customerPhone ?? '—');
    const restaurantName = escapeHtml(order.restaurantName ?? '—');
    const shippingAddress = formatMultiline(order.shippingAddress ?? 'لا يوجد عنوان مسجل');
    const notes = formatMultiline(order.notes ?? 'لا توجد ملاحظات');

    const items = Array.isArray(order.items) ? order.items : [];
    const itemsRows = items
      .map((item, index) => {
        const quantity = item.quantity ?? 1;
        const unit = item.unitPrice ?? (quantity ? (item.price ?? 0) / quantity : item.price ?? 0);
        const lineTotal = item.price ?? unit * quantity;

        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.name ?? '—')}</td>
            <td>${escapeHtml(quantity)}</td>
            <td>${escapeHtml(item.unitLabel ?? item.unitType ?? '—')}</td>
            <td>${formatCurrency(unit)}</td>
            <td>${formatCurrency(lineTotal)}</td>
          </tr>
        `;
      })
      .join('');

    const itemsTable =
      itemsRows ||
      '<tr><td colspan="6" style="padding: 16px; text-align: center; color: #64748b;">لا توجد منتجات مسجلة في هذا الطلب.</td></tr>';

    const total = formatCurrency(this.getOrderTotal(order));

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>طباعة الطلب ${orderNumber}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, sans-serif;
              background-color: #f1f5f9;
              margin: 0;
              padding: 32px;
              color: #0f172a;
            }
            .section {
              background-color: #ffffff;
              border-radius: 16px;
              padding: 24px;
              margin-bottom: 24px;
              border: 1px solid #e2e8f0;
              box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
            }
            h1 {
              margin: 0 0 12px;
              font-size: 24px;
            }
            h2 {
              margin: 0 0 16px;
              font-size: 20px;
              color: #0f172a;
            }
            .meta {
              display: flex;
              flex-wrap: wrap;
              gap: 12px 24px;
              font-size: 14px;
              color: #475569;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
              gap: 16px;
            }
            .label {
              font-size: 12px;
              color: #64748b;
              margin-bottom: 4px;
            }
            .value {
              font-size: 15px;
              font-weight: 600;
              color: #1f2937;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 16px;
              font-size: 14px;
            }
            thead {
              background-color: #eef2ff;
            }
            th,
            td {
              padding: 12px;
              border: 1px solid #e2e8f0;
              text-align: right;
            }
            .total {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 16px;
              font-size: 16px;
              font-weight: 600;
              color: #0f172a;
            }
            .muted {
              color: #94a3b8;
              font-size: 12px;
            }
            @media print {
              body {
                background-color: #ffffff;
                padding: 0;
              }
              .section {
                box-shadow: none;
                border: 1px solid #cbd5f5;
                margin-bottom: 16px;
                border-radius: 12px;
              }
            }
          </style>
        </head>
        <body dir="rtl">
          <div class="section">
            <h1>طلب رقم ${orderNumber}</h1>
            <div class="meta">
              <span>الحالة: <strong>${status}</strong></span>
              <span>تاريخ الطلب: ${formattedCreatedAt}</span>
              <span>تاريخ الطباعة: ${generatedAt}</span>
            </div>
          </div>

          <div class="section">
            <h2>بيانات العميل</h2>
            <div class="info-grid">
              <div>
                <p class="label">الاسم</p>
                <p class="value">${customerName}</p>
              </div>
              <div>
                <p class="label">البريد الإلكتروني</p>
                <p class="value">${customerEmail}</p>
              </div>
              <div>
                <p class="label">رقم الهاتف</p>
                <p class="value" dir="ltr">${customerPhone}</p>
              </div>
              <div>
                <p class="label">اسم المطعم</p>
                <p class="value">${restaurantName}</p>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>تفاصيل المنتجات</h2>
            <table>
              <thead>
                <tr>
                  <th>م</th>
                  <th>المنتج</th>
                  <th>الكمية</th>
                  <th>الوحدة</th>
                  <th>سعر الوحدة</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                ${itemsTable}
              </tbody>
            </table>
            <div class="total">
              <span>الإجمالي الكلي</span>
              <strong>${total}</strong>
            </div>
          </div>

          <div class="section">
            <h2>عنوان الشحن</h2>
            <p class="value" style="white-space: pre-line;">${shippingAddress}</p>
          </div>

          <div class="section">
            <h2>ملاحظات إضافية</h2>
            <p class="value" style="white-space: pre-line;">${notes}</p>
          </div>

          <p class="muted">تم إنشاء هذه الصفحة لغرض الطباعة فقط.</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      try {
        printWindow.print();
      } finally {
        printWindow.close();
      }
    }, 300);
  }

  goToPage(index: number, totalPages: number) {
    if (!totalPages) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(index, totalPages - 1));
    this.pageIndexSubject.next(safeIndex);
  }

  private parseDate(value: unknown): Date {
    if (!value) {
      return new Date(0);
    }

    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp?.toDate === 'function') {
      return maybeTimestamp.toDate();
    }

    const parsed = new Date(value as string | number | Date);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }
}
