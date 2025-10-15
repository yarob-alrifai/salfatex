import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CategoriesComponent } from '../../categories/categories/categories';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterModule, CategoriesComponent],
  templateUrl: './home-page.html',
  styleUrls: ['./home-page.scss'],
})
export class HomePageComponent {}
