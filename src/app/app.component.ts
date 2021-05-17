import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import * as SendBird from 'sendbird';
import { ChatService } from './chat.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  userChannels$: Observable<SendBird.GroupChannel[]>;

  constructor(private chatService: ChatService){}

  ngOnInit(): void {
    this.chatService.connectUser('6091032675318b7c59d24a93').subscribe();
    this.userChannels$ = this.chatService.getUserChannels();
  }

  ngOnDestroy(): void {
  }
}
