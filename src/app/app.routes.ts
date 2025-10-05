import { Routes } from '@angular/router';
import { CategoriesComponent } from './categories/categories/categories';
import { SubcategoryListComponent } from './subcategory-list/subcategory-list/subcategory-list';
import { ProductDetailComponent } from './product-detail/product-detail/product-detail';
import { SearchPageComponent } from './search-page/search-page/search-page';
import { AboutPageComponent } from './about-page/about-page/about-page';
import { ContactPageComponent } from './contact-page/contact-page/contact-page';
// import { AboutPageComponent } from './about-page/about-page.component';
// import { CategoriesComponent } from './categories/categories.component';
// import { ContactPageComponent } from './contact-page/contact-page.component';
// import { ProductDetailComponent } from './product-detail/product-detail.component';
// import { SearchPageComponent } from './search-page/search-page.component';
// import { SubcategoryListComponent } from './subcategory-list/subcategory-list.component';

export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },

  { path: 'categories', component: CategoriesComponent },
  { path: 'categories/:categoryId', component: SubcategoryListComponent },
  { path: 'product/:productId', component: ProductDetailComponent },
  { path: 'search', component: SearchPageComponent },
  { path: 'about', component: AboutPageComponent },
  { path: 'contact', component: ContactPageComponent },

  { path: '', redirectTo: 'categories', pathMatch: 'full' },

  { path: '**', redirectTo: 'categories' },
];
