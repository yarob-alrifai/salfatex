import { AsyncPipe, CommonModule, CurrencyPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, inject, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { combineLatest, map, startWith } from 'rxjs';
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
      total: orders.reduce((sum, order) => sum + (order.total ?? 0), 0),
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
    })
  );

  readonly filteredStats$ = this.filteredOrders$.pipe(
    map((orders) => ({
      count: orders.length,
      total: orders.reduce((sum, order) => sum + (order.total ?? 0), 0),
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

    await this.adminDataService.deleteOrder(order.id);
    this.feedback.set('تم حذف الطلب.');
    this.error.set('');
    this.closeOrderDetails();
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
