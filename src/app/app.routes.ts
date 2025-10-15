import { Routes } from '@angular/router';
import { CategoriesComponent } from './categories/categories/categories';
import { SubcategoryListComponent } from './subcategory-list/subcategory-list/subcategory-list';
import { ProductDetailComponent } from './product-detail/product-detail/product-detail';
import { AboutPageComponent } from './about-page/about-page/about-page';
import { ContactPageComponent } from './contact-page/contact-page/contact-page';
import { CartPageComponent } from './cart/cart-page/cart-page';
import { CheckoutPageComponent } from './cart/checkout-page/checkout-page';
import { SubcategoryDetailComponent } from './subcategory-detail/subcategory-detail/subcategory-detail';
import { HomePageComponent } from './home-page/home-page/home-page';

export const routes: Routes = [
  { path: '', component: HomePageComponent },

  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },

  { path: 'categories', component: CategoriesComponent },
  { path: 'categories/:categoryId', component: SubcategoryListComponent },
  {
    path: 'categories/:categoryId/subcategories/:subcategoryId',
    component: SubcategoryDetailComponent,
  },
  {
    path: 'categories/:categoryId/subcategories/:subcategoryId/products/:productId',
    component: ProductDetailComponent,
  },
  { path: 'about', component: AboutPageComponent },
  { path: 'contact', component: ContactPageComponent },
  { path: 'cart', component: CartPageComponent },
  { path: 'checkout', component: CheckoutPageComponent },

  { path: '**', redirectTo: 'categories' },
];
