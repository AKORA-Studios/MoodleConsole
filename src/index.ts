/**
  * @module akora-moodle
  * @category Category Name
  */

import EventEmitter from 'events';
import { BaseClient, BaseClientOptions, CallOptions } from './base';
import { CoreModule, Core } from './typings';

export { Logger } from './base';
export * as typings from './typings';



type ClientOptions = BaseClientOptions;
export class Client extends BaseClient {
    public core: CoreModule;

    constructor(options: ClientOptions) {
        super(options);

        this.core = new CoreModule();
        this.core.call = (...args) => this.moduleCall(...args);
    }

    private moduleCall<Response, Args = any>(opts: CallOptions<Args>): Promise<Response> {
        return this.call({
            wsfunction: opts.endpoint,
            args: this.moodlefy(opts.args),
            method: opts.method,
            settings: opts.settings
        })
    }

    protected moodlefy<T>(obj: T): T {
        for (const k in obj)
            switch (typeof obj[k]) {
                case 'object':
                    if (Array.isArray(obj[k]))
                        for (const i in obj[k]) obj[k][i] = this.moodlefy(obj[k][i]);
                    else obj[k] = this.moodlefy(obj[k]);
                    break;
                default:
                    //@ts-ignore
                    if (obj[k] === true) obj[k] = 1;
                    //@ts-ignore
                    if (obj[k] === false) obj[k] = 0;
                    break;
            }

        return obj;
    }


    static async init(options: ClientOptions) {
        var client = new this(options);

        if (client.token) return client;
        else {
            //@ts-ignore
            if (!(options.username && options.password)) throw 'coding error: no username/password (or token) provided';
            //@ts-ignore
            return (await client.authenticate(options.username, options.password));
        }
    }
}


interface ConsoleClientEvents {
    message: [Core.message.get_messages.message];
}


export class ConsoleClient extends EventEmitter {
    //@ts-ignore
    public userid: number;
    //@ts-ignore
    public chat: Core.message.get_messages.message[];
    //@ts-ignore
    public user: Core.webservice_get_site_info.response;
    public client: Client;

    constructor(client: Client) {
        super();
        this.chat = [];
        this.client = client;
    }

    public async initConsole(options: {
        /** Timeout in ms between message checks */
        timeout: number
    }) {
        const { timeout } = options ?? {};
        var info = await this.client.core.getInfo();
        this.userid = info.userid;
        this.user = info;

        setInterval(async () => {

            var chat = await this.client.core.getMessages({
                useridfrom: this.userid + '',
                useridto: this.userid + '',
                limitnum: 2,
                newestfirst: 1
            });
            var { messages } = chat,
                len = this.chat.length;
            this.chat = this.chat.concat(this.chat, messages.filter(m => !this.chat.find(me => me.id === m.id)));
            this.chat = this.chat.sort((a, b) => a.timecreated - b.timecreated);

            if (len < this.chat.length)
                this.emit('message', this.chat[(this.chat.length) - 1]);
        }, timeout ?? (1000 * 10))
    }

    async send(...messages: {
        text: string;
        textformat: 0 | 1 | 2 | 4;
        clientmsgid?: string;
    }[]) {
        var arr = messages as Core.message.send_instant_messages.message[];
        for (const i in arr)
            arr[i].touserid = this.userid;

        return this.client.core.message.sendInstantMessages({
            messages: arr
        })
    }
}

export interface ConsoleClient extends EventEmitter {
    on<K extends keyof ConsoleClientEvents>(event: K, listener: (...args: ConsoleClientEvents[K]) => void): this;
    on<S extends string | symbol>(
        event: Exclude<S, keyof ConsoleClientEvents>,
        listener: (...args: any[]) => void,
    ): this;

    once<K extends keyof ConsoleClientEvents>(event: K, listener: (...args: ConsoleClientEvents[K]) => void): this;
    once<S extends string | symbol>(
        event: Exclude<S, keyof ConsoleClientEvents>,
        listener: (...args: any[]) => void,
    ): this;

    emit<K extends keyof ConsoleClientEvents>(event: K, ...args: ConsoleClientEvents[K]): boolean;
    emit<S extends string | symbol>(event: Exclude<S, keyof ConsoleClientEvents>, ...args: any[]): boolean;

    off<K extends keyof ConsoleClientEvents>(event: K, listener: (...args: ConsoleClientEvents[K]) => void): this;
    off<S extends string | symbol>(
        event: Exclude<S, keyof ConsoleClientEvents>,
        listener: (...args: any[]) => void,
    ): this;

    removeAllListeners<K extends keyof ConsoleClientEvents>(event?: K): this;
    removeAllListeners<S extends string | symbol>(event?: Exclude<S, keyof ConsoleClientEvents>): this;
}

export default Client;