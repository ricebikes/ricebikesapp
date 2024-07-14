import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PriceCheckComponent } from './price-check.component';

describe('PriceCheckComponent', () => {
  let component: PriceCheckComponent;
  let fixture: ComponentFixture<PriceCheckComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PriceCheckComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PriceCheckComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
