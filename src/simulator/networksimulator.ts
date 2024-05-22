import EventEmitter from "node:events";
import { getMessageType } from "../messages.ts";
import { Entry, createPlantUml } from "../util.ts";
import { EarthstarMessaging } from "./earthstar.ts";

export abstract class NetworkNode extends EventEmitter {
  abstract process(from: string, message: string):  void;
  abstract toSnapshot(): object;
}
export class NetworkSimulator {
  protected nodes: { [name: string]: NetworkNode } = {};
  async init(_links: string[]): Promise<void> {
    // no-op
  }

  addNode(name: string, node: NetworkNode): void {
    this.nodes[name] = node;
  }
  toSnapshot(): { [index: string]: object } {
    const ret: { [index: string]: object } = {};
    Object.keys(this.nodes).forEach(name => {
      ret[name] = this.nodes[name].toSnapshot();
    });
    return ret;
  }
}

export class LoggingNetworkSimulator extends NetworkSimulator {
  private log: Entry[] = [];
  logMessageSent(sender: string, receiver: string, message: string): void {
    this.log.push(new Entry(sender, receiver, message, 'sent'));
  }
  logMessageReceived(sender: string, receiver: string, message: string): void {
    this.log.push(new Entry(sender, receiver, message, 'received'));
  }

  getLocalLog(name: string): string[] {
    return this.log.filter(entry => {
      if (entry.sender === name) {
        return (entry.event === 'sent');
      }
      if (entry.receiver === name) {
        return (entry.event === 'received');
      }
      // istanbul ignore next
      return false;
    }).map(entry => {
      if (entry.event === 'sent') {
        return `TO[${entry.receiver}] ${entry.message.toString()}`;
      } else {
        return `FROM[${entry.sender}] ${entry.message.toString()}`;
      }
    });
  }
  getFullLog(includeEachMessageTwice: boolean = false): string[] {
    const filtered = (includeEachMessageTwice) ? this.log : this.log.filter(entry => entry.event === 'sent');
    return filtered.map(entry => `${entry.describePath()} ${entry.message.toString()}`);
  }
  getProbeLogs(): {
    [text: string]: string[]
  } {
    const probeLogs: {
      [text: string]: string[]
    } = {};
    // console.log(this.log);
    this.log.filter(entry => (getMessageType(entry.message) === 'probe')).map(entry => {
      if (typeof probeLogs[entry.message.toString()] === 'undefined') {
        probeLogs[entry.message.toString()] = [];
      }
      probeLogs[entry.message.toString()].push(entry.describePath());
    });
    return probeLogs;
  }
  getPlantUml(): string {
    return createPlantUml(this.log);
  }
  toSnapshot(): { [index: string]: object } {
    const snapshot = super.toSnapshot();
    snapshot.log = this.log;
    return snapshot;
  }
}

export class BasicNetworkSimulator extends LoggingNetworkSimulator {
  addNode(name: string, node: NetworkNode): void {
    super.addNode(name, node);
    node.on('message', (to: string, message: string) => {
      this.logMessageSent(name, to, message);
      if (typeof this.nodes[to] !== 'undefined') {
        this.logMessageReceived(name, to, message);
        this.nodes[to].process(name, message);
      }
    });
  }
}

export class TransportPackage {
  sender: string;
  receiver: string;
  message: string;
  constructor(sender: string, receiver: string, message: string) {
    this.sender = sender;
    this.receiver = receiver;
    this.message = message;
  }
}

export class BatchedNetworkSimulator extends LoggingNetworkSimulator {
  private batch: TransportPackage[] = [];
  addNode(name: string, node: NetworkNode): void {
    super.addNode(name, node);
    node.on('message', (to: string, message: string) => {
      this.logMessageSent(name, to, message);
      this.batch.push({ sender: name, receiver: to, message });    
    });
  }
  send(transportPackage: TransportPackage): void {
    // taking advantage of all nodes living in the same process,
    // so we can deliver the message immediately:
    this.receive(transportPackage);
  }
  receive(transportPackage: TransportPackage): void {
    this.nodes[transportPackage.receiver].process(transportPackage.sender, transportPackage.message);
  }
  flush(): string[] {
    this.logMessageSent('---', '---', '---');
    const flushReport: string[] = [];
    const batch = this.batch;
    this.batch = [];
    batch.filter(entry => typeof this.nodes[entry.receiver] !== 'undefined').forEach(entry => {
      this.logMessageReceived(entry.sender, entry.receiver, entry.message);
      this.send(entry);
      flushReport.push(`[${entry.sender}]->[${entry.receiver}] ${entry.message}`);
    });
    return flushReport;
  }
  getBatch(): string[] {
    return this.batch.map(entry => `[${entry.sender}]->[${entry.receiver}] ${entry.message}`);
  }

  toSnapshot(): { [index: string]: object } {
    const snapshot = super.toSnapshot();
    snapshot.batch = this.batch;
    return snapshot;
  }
}

export class MixedNetworkSimulator extends BatchedNetworkSimulator {
  private earthstarMessaging: EarthstarMessaging;
  constructor() {
    super();
    this.earthstarMessaging = new EarthstarMessaging(this);
  }
  async init(links: string[]): Promise<void> {
    console.log('MixedNetworkSimulator.init');
    await this.earthstarMessaging.init(links);
  }
  send(transportPackage: TransportPackage): void {
    // TODO: send this message out into the ether
    // so that it somehow comes back to our receive method
    this.earthstarMessaging.send(transportPackage);
  }
  receive(transportPackage: TransportPackage): void {
    this.nodes[transportPackage.receiver].process(transportPackage.sender, transportPackage.message);
  }
}