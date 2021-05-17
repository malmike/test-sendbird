import * as SendBird from 'sendbird';

export default class SendBirdChatEvent {
  sendBird: SendBird.SendBirdInstance;
  key: string;
  onMessageReceived: any;
  onReadReceiptUpdated: any;
  onDeliveryReceiptUpdated: any;

  constructor(key?: string) {
    this.sendBird = SendBird.getInstance();
    this.key = key || 'CHANNEL_EVENT_HANDLER';
    this.createChannelHandler();

    this.onMessageReceived = null;
    this.onReadReceiptUpdated = null;
    this.onDeliveryReceiptUpdated = null;
  }

  private createChannelHandler(): void {
    const handler = new this.sendBird.ChannelHandler();
    handler.onMessageReceived = (
      channel: SendBird.OpenChannel | SendBird.GroupChannel,
      message: SendBird.AdminMessage | SendBird.UserMessage | SendBird.FileMessage,
    ): void => {
      if (this.onMessageReceived) {
        this.onMessageReceived(channel, message);
      }
    };


    handler.onReadReceiptUpdated = (groupChannel: SendBird.GroupChannel): void => {
      if (this.onReadReceiptUpdated) {
        this.onReadReceiptUpdated(groupChannel);
      }
    };

    (handler as any).onDeliveryReceiptUpdated = (groupChannel: SendBird.GroupChannel): void => {
      if (this.onDeliveryReceiptUpdated) {
        this.onDeliveryReceiptUpdated(groupChannel);
      }
    };
    this.sendBird.addChannelHandler(this.key, handler);
  }

  closeHandler(): void {
    this.sendBird.removeChannelHandler(this.key);
  }
}
