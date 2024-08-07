import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminItemsComponent } from './admin-items.component';

describe('AdminItemsComponent', () => {
  let component: AdminItemsComponent;
  let fixture: ComponentFixture<AdminItemsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminItemsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminItemsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
