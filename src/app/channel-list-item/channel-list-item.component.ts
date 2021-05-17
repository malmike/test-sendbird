import { Component, Input } from '@angular/core';
import * as Sendbird from 'sendbird';
import { ChatService } from '../chat.service';

@Component({
  selector: 'app-channel-list-item',
  templateUrl: './channel-list-item.component.html',
  styleUrls: ['./channel-list-item.component.scss'],
})
export class ChannelListItemComponent {
  @Input() channel: Sendbird.GroupChannel | any;

  constructor(private chatService: ChatService){}

  enterChannel(): void {
    this.chatService.setCurrentChannel(this.channel);
  }

}
