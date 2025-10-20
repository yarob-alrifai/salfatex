import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoryGroupManager } from './category-group-manager';

describe('CategoryGroupManager', () => {
  let component: CategoryGroupManager;
  let fixture: ComponentFixture<CategoryGroupManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryGroupManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategoryGroupManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
