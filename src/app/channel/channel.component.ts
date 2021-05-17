import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup } from '@angular/forms';
import { Observable, of, Subscription } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import * as SendBird from 'sendbird';
import { ChatService, MessageReadStatus } from '../chat.service';

@Component({
  selector: 'app-channel',
  templateUrl: './channel.component.html',
  styleUrls: ['./channel.component.scss'],
})
export class ChannelComponent implements OnInit, OnDestroy {
  channel$: Observable<SendBird.GroupChannel>;
  channel: SendBird.GroupChannel;
  channelUrl: string;
  chatMessageForm: FormGroup;
  currentUser: SendBird.User;
  messagesReadStatus: { [messageId: number]: MessageReadStatus };

  messages: Array<SendBird.UserMessage | SendBird.FileMessage | SendBird.AdminMessage> = [];
  subscriptions: Array<Subscription> = [];

  get f(): { [key: string]: AbstractControl } {
    return this.chatMessageForm?.controls;
  }

  public get messageReadStatus(): typeof MessageReadStatus {
    return MessageReadStatus;
  }

  constructor(
    private chatService: ChatService,
    private formBuilder: FormBuilder,
  ) {}


  ngOnInit(): void {

    this.channel$ = this.chatService.channelUrl$.pipe(
      switchMap((channelUrl: string) => {
        this.channelUrl = channelUrl;
        if (channelUrl) {
          return this.chatService.getChannelByUrl(channelUrl).pipe(
            tap((channel: SendBird.GroupChannel) => {
              this.channel = channel;
              if (channel) {
                this.chatService.getChannelMessages(channel);
                this.chatService.addChannelEventHandler(channel);
              }
            })
          )
        }
        return of(undefined)
      })
    );

    this.subscriptions.push(
      this.chatService.currentUser$.pipe(
        tap(currentUser => {
          this.currentUser = currentUser;
        })
      ).subscribe(),
      this.chatService.messages$
        .pipe(
          switchMap(channelMessages => {
            this.messages = channelMessages;
            if(this.channel) this.chatService.markChannelMessagesAsRead(this.channel);
            return of();
          }),
        )
        .subscribe(),
      this.chatService.messageReadStatus$
        .pipe(
          switchMap(messagesReadStatus => {
            this.messagesReadStatus = messagesReadStatus;
            return of();
          }),
        )
        .subscribe(),
    );

    this.chatMessageForm = this.formBuilder.group({
      message: [''],
    });
  }

  submitForm(event): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.messageValueValid()) {
        this.sendMessage();
      }
    }
  }

  // check if a message has only tabs, spaces and new line
  messageValueValid(): boolean {
    return this.chatMessageForm.value.message.replace(/\s+/g, '') !== '';
  }

  // show message date but only if it's different
  isSameDay(first, second): boolean {
    const firstDate = new Date(first);
    const secondDate = new Date(second);

    return (
      firstDate.getFullYear() === secondDate.getFullYear() &&
      firstDate.getMonth() === secondDate.getMonth() &&
      firstDate.getDate() === secondDate.getDate()
    );
  }

  sendMessage(): void {
    if (this.chatMessageForm.valid) {
        this.chatService.sendUserMessage(this.channel, this.chatMessageForm.value.message);
        this.chatMessageForm.reset({ message: '' });
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.chatService.closeChannelEventHandler();
  }
}
