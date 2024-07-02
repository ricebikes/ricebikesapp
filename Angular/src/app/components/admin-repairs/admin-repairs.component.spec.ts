import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminRepairsComponent } from './admin-repairs.component';

describe('AdminRepairsComponent', () => {
  let component: AdminRepairsComponent;
  let fixture: ComponentFixture<AdminRepairsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminRepairsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminRepairsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
