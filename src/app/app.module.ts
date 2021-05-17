import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { MaterialModule } from './material.module';

import { AppComponent } from './app.component';
import { ChannelListItemComponent } from './channel-list-item/channel-list-item.component';
import { ReactiveFormsModule } from '@angular/forms';
import { ChannelComponent } from './channel/channel.component';

@NgModule({
  declarations: [
    AppComponent,
    ChannelListItemComponent,
    ChannelComponent,
  ],
  imports: [
    BrowserModule,
    CommonModule,
    MaterialModule,
    ReactiveFormsModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
