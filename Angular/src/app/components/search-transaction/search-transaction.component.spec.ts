import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchTransactionComponent } from './search-transaction.component';

describe('SearchTransactionComponent', () => {
  let component: SearchTransactionComponent;
  let fixture: ComponentFixture<SearchTransactionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchTransactionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchTransactionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
