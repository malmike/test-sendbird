import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, from, Observable } from 'rxjs';
import * as SendBird from 'sendbird';
import SendBirdChatEvent from './sendbird-chat-event';
import { map, take, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';


export enum MessageReadStatus {
  read = 'READ',
  delivered = 'DELIVERED',
  none = 'NONE',
  pending = 'PENDING',
  failed = 'FAILED',
  cancelled = 'CANCELLED',
  succeeded = 'SUCCEEDED',
}

@Injectable({
  providedIn: 'root',
})
export class ChatService implements OnDestroy {
  private readonly sendbird: SendBird.SendBirdInstance;
  private channelEvent: SendBirdChatEvent;
  private onMessageRecievedChannelEvent: SendBirdChatEvent;

  messages$: BehaviorSubject<Array<any>> = new BehaviorSubject([]);
  unreadMessageCount$ = new BehaviorSubject(0);
  channelUrl$: BehaviorSubject<String> = new BehaviorSubject('');
  currentUser$: BehaviorSubject<SendBird.User> = new BehaviorSubject<SendBird.User>(null);
  messageReadStatus$: BehaviorSubject<{ [messageId: number]: MessageReadStatus }> = new BehaviorSubject(null);

  selectedUsers: SendBird.User[] = [];
  groupMeta = {
    name: '',
    image: null,
  };

  get sendbirdInstance(): SendBird.SendBirdInstance {
    return this.sendbird;
  }

  constructor() {
    this.sendbird = new SendBird({
      appId: environment.config.sendbirdId,
    });

    this.channelEvent = new SendBirdChatEvent();
    this.onMessageRecievedChannelEvent = new SendBirdChatEvent('ON_MESSAGE_RECEIVED_HANDLER');
  }

  setCurrentChannel(channel: SendBird.GroupChannel) {
    this.channelUrl$.next(channel.url);
  }

  connectUser(userId: string): Observable<SendBird.User> {
    const userFunc = async (): Promise<SendBird.User> => {
      const user = await this.sendbird.connect(userId);
      this.onMessageRecievedChannelEvent.onMessageReceived = this.onMessageReceived;
      this.currentUser$.next(user);
      return user;
    }
    return from(userFunc());
  }

  // Adding this event handelr
  onMessageReceived = (
    channel: SendBird.OpenChannel | SendBird.GroupChannel,
    _message: SendBird.UserMessage | SendBird.FileMessage,
  ): void => {
    this.sendbirdInstance.markAsDelivered(channel.url);
  };

  addChannelEventHandler(userChannel: SendBird.OpenChannel | SendBird.GroupChannel): void {
    this.channelEvent.onMessageReceived = (
      channel: SendBird.OpenChannel | SendBird.GroupChannel,
      message: SendBird.UserMessage | SendBird.FileMessage,
    ): void => {
      if (userChannel.url === channel.url) {
        this.addMessage(message);
      }
    };

    if (userChannel.isGroupChannel()) {
      this.channelEvent.onReadReceiptUpdated = (groupChannel: SendBird.GroupChannel): void => {
        if (userChannel.url === groupChannel.url) {
          this.messages$
            .pipe(
              take(1),
              map((messages: Array<SendBird.UserMessage | SendBird.FileMessage>) => {
                this.setMessageReadStatus(groupChannel, messages);
              }),
            )
            .subscribe();
        }
      };

      this.channelEvent.onDeliveryReceiptUpdated = (groupChannel: SendBird.GroupChannel): void => {
        if (userChannel.url === groupChannel.url) {
          this.messages$
            .pipe(
              take(1),
              map((messages: Array<SendBird.UserMessage | SendBird.FileMessage>) => {
                this.setMessageReadStatus(groupChannel, messages);
              }),
            )
            .subscribe();
        }
      };
    }
  }

  closeChannelEventHandler(): void {
    if (this.channelEvent) {
      this.channelEvent.closeHandler();
    }
  }

  getUsers(): Observable<SendBird.User[]> {
    const usersFunc = async (): Promise<Array<SendBird.User>> => {
      const query = this.sendbird.createApplicationUserListQuery();
      const users = query.next();
      return (await users).filter(user => !!user.nickname);
    }
    return from(usersFunc());
  }

  getUserChannels(): Observable<SendBird.GroupChannel[]> {
    const channels = async (): Promise<Array<SendBird.GroupChannel>> => {
      const query = this.sendbird.GroupChannel.createMyGroupChannelListQuery();
      query.includeEmpty = true;
      query.limit = 15;
      query.order = 'latest_last_message';

      const channelList = await query.next();
      return channelList.map(ch => {
        if (ch.name === this.sendbirdInstance.currentUser.nickname) {
          ch.name = ch.creator.nickname;
        }
        return ch;
      });
    }
    return from(channels());
  }

  getChannelByUrl(channelUrl: string): Observable<SendBird.GroupChannel> {
    const channel = async (): Promise<SendBird.GroupChannel> => {
      const channel = await this.sendbird.GroupChannel.getChannel(channelUrl)
      return channel
    }
    return from(channel());
  }

  async getChannelMessages(channel: SendBird.GroupChannel): Promise<void> {
    const query = channel.createPreviousMessageListQuery();
    query.limit = 100;

    const messages = (await query.load()) as Array<SendBird.FileMessage | SendBird.UserMessage>;
    this.markChannelMessagesAsRead(channel);
    this.messages$.next(messages);
    this.setMessageReadStatus(channel, messages);
  }

  markChannelMessagesAsRead(channel: SendBird.GroupChannel): void {
    channel.markAsRead();
  }

  setMessageReadStatus(
    channel: SendBird.GroupChannel,
    messages: Array<SendBird.UserMessage | SendBird.FileMessage>,
  ): void {
    if (!messages.length) {
      return;
    }
    const currentUser = this.sendbird.currentUser;
    this.messageReadStatus$
      .pipe(
        take(1),
        tap(messagesReadStatus => {
          const readStatus: { [messageId: number]: MessageReadStatus } = {};
          messages.forEach(message => {
            if (message.sender?.userId === currentUser.userId) {
              if (message.sendingStatus !== 'succeeded') {
                readStatus[message.messageId] = MessageReadStatus[message.sendingStatus];
              } else {
                if (!(messagesReadStatus && messagesReadStatus[message.messageId] === MessageReadStatus.read)) {
                  const unreadMembers = channel.getUnreadMembers(message);
                  if (!unreadMembers.length) {
                    readStatus[message.messageId] = MessageReadStatus.read;
                  } else if (
                    !(messagesReadStatus && messagesReadStatus[message.messageId] === MessageReadStatus.delivered)
                  ) {
                    const undeliveredCount = channel.getUndeliveredMemberCount(message);
                    if (undeliveredCount) {
                      readStatus[message.messageId] = MessageReadStatus.succeeded;
                    } else {
                      readStatus[message.messageId] = MessageReadStatus.delivered;
                    }
                  }
                }
              }
            }
            this.messageReadStatus$.next({...messagesReadStatus, ...readStatus});
          });

        }),
      )
      .subscribe();
  }

  sendUserMessage(channel: SendBird.GroupChannel, message: string): void {
    const messageParams = new this.sendbird.UserMessageParams();
    messageParams.message = message;
    channel.sendUserMessage(messageParams, (userMessage, error) => {
      if (userMessage) {
        const message = userMessage as SendBird.UserMessage | SendBird.FileMessage;
        this.addMessage(message);
        this.setMessageReadStatus(channel, [message]);
      }
      if (error) {
        console.warn(error);
      }
    });
  }

  addMessage(message: SendBird.UserMessage | SendBird.FileMessage): void {
    const messages = this.messages$.value;
    this.messages$.next([...messages, message]);
  }

  ngOnDestroy(): void {
    this.onMessageRecievedChannelEvent.closeHandler();
  }
}
