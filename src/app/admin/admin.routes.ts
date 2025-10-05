import { Routes } from '@angular/router';

import { adminAuthChildGuard } from './admin-auth.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./admin-login/admin-login/admin-login').then((m) => m.AdminLoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./admin-shell/admin-shell/admin-shell').then((m) => m.AdminShellComponent),
    // canActivateChild: [adminAuthChildGuard],
    children: [
      {
        path: 'categories',
        loadComponent: () =>
          import('./category-manager/category-manager/category-manager').then(
            (m) => m.CategoryManagerComponent
          ),
      },
      {
        path: 'subcategories',
        loadComponent: () =>
          import('./subcategory-manager/subcategory-manager/subcategory-manager').then(
            (m) => m.SubcategoryManagerComponent
          ),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./product-manager/product-manager/product-manager').then(
            (m) => m.ProductManagerComponent
          ),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./orders-dashboard/orders-dashboard/orders-dashboard').then(
            (m) => m.OrdersDashboardComponent
          ),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'orders',
      },
    ],
  },
];
