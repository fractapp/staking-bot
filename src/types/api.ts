import {Currency} from "./enums";

export type UndeliveredMessagesInfo = {
    messages: Array<Message>,
    users: {
        [id in string]: Profile
    }
};
export type Profile = {
    id: string;
    name: string;
    username: string;
    avatarExt: string;
    lastUpdate: number;
    addresses: {
        [id in Currency]: string
    };
    isChatBot: boolean;
};

export type MessageRq = {
    version: number,
    value: string,
    action: string,
    receiver: string,
    args: {
        [key in string]: string
    },
    rows: Array<Row>
};

export type Message = {
    id: string;
    value: string;
    action: string | null;
    args: {
        [key in string]: string
    },
    rows: Array<Row>;
    timestamp: number;
    sender: string;
    receiver: string;
    hideBtn: boolean;
};

export type Row = {
    buttons: Array<Button>
};

export type Button = {
    value: string
    action: string
    arguments: {
        [key in string]: string
    }
    imageUrl: string | null,
};

export enum DefaultMsgAction {
    Init = "/init",
    OpenUrl = "/openUrl",
    EnterAmount = "/enterAmount",
    Broadcast = "/broadcast",
    WalletButtonOut = '/walletOut',
    WalletButtonIn = '/walletIn'
}
