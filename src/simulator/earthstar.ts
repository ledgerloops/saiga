import { MixedNetworkSimulator, TransportPackage } from "./networksimulator.ts";
import * as Earthstar from "https://deno.land/x/earthstar@v10.2.2/mod.ts";

function toTwoChar(str: string): string {
  // this is meant for the node names from the testnet CSV
  // which are "0"-"9":
  return `x${str}`.substring(0, 2);
}

function toFourChar(str: string): string {
  // this is meant for the node names from the testnet CSV
  // which are "0"-"9":
  return `xxx${str}`.substring(0, 4);
}
export class EarthstarMessaging {
  shareKeys: {
    [index: string]: Earthstar.ShareKeypair
  } = {};
  authorKeys: {
    [index: string]: Earthstar.AuthorKeypair
  } = {};
  replicas: {
    [index: string]: Earthstar.Replica
  } = {};
  peers: {
    [index: string]: Earthstar.Peer
  } = {};
  caches: {
    [index: string]: Earthstar.ReplicaCache
  } = {
    };
  networkSimulator: MixedNetworkSimulator;
  earthstarServer?: Earthstar.Server;
  counter: number = 0;
  constructor(networkSimulator: MixedNetworkSimulator) {
    // console.log('EarthstarMessaging instantiated');
    this.networkSimulator = networkSimulator;
  }
  async ensureShareKey(oneParty: string, otherParty: string): Promise<string> {
    const shareName = [oneParty, otherParty].sort().map(toTwoChar).join('');
    console.log('ensureShareKey', shareName);
    if (typeof this.shareKeys[shareName] === 'undefined') {
      this.shareKeys[shareName] = await Earthstar.Crypto.generateShareKeypair(shareName) as Earthstar.ShareKeypair;
    }
    return shareName;
  }
  async ensureAuthorKey(author: string): Promise<Earthstar.AuthorKeypair> {
    const authorName = toFourChar(author);
    if (typeof this.authorKeys[authorName] === 'undefined') {
      this.authorKeys[authorName] = await Earthstar.Crypto.generateAuthorKeypair(authorName) as Earthstar.AuthorKeypair;
    }
    return this.authorKeys[authorName];
  }
  async ensurePeer(party: string) {
    if (typeof this.peers[party] === 'undefined') {
      this.peers[party] = new Earthstar.Peer();
      await this.peers[party].sync("http://localhost:8000", true);
    }
  }
  async ensureReplica(peer: string, shareName: string): Promise<Earthstar.Replica> {
    await this.ensureAuthorKey(peer);
    await this.ensurePeer(peer);
    const replicaKey = `${peer}:${shareName}`;
    console.log('ensureReplica', peer, shareName, replicaKey, this.shareKeys[shareName]);
    if (typeof this.replicas[replicaKey] === 'undefined') {
      this.replicas[replicaKey] = new Earthstar.Replica({
        driver: new Earthstar.ReplicaDriverMemory(this.shareKeys[shareName].shareAddress),
      });
      this.peers[peer].addReplica(this.replicas[replicaKey]);
      this.caches[replicaKey] = new Earthstar.ReplicaCache(this.replicas[replicaKey]);
      this.caches[replicaKey].onCacheUpdated(() => {
        const chatDocs = this.caches[replicaKey].queryDocs({
          filter: { pathStartsWith: "/chat" },
        });
        for (const doc of chatDocs) {
          console.log(`[${replicaKey}] ${doc.author.substr(1, 4)}: ${doc.text}`);
        }
      });
      // Work around https://github.com/earthstar-project/earthstar/issues/329
      this.caches[replicaKey].queryDocs();
    }
    return this.replicas[replicaKey];
  }
  async ensureReplicas(oneParty: string, otherParty: string): Promise<void> {
    const shareName = await this.ensureShareKey(oneParty, otherParty);
    const onePartyName = toFourChar(oneParty);
    const otherPartyName = toFourChar(otherParty);
    console.log('ensureReplicas', onePartyName, otherPartyName, shareName);
    await this.ensureReplica(onePartyName, shareName);
    await this.ensureReplica(otherPartyName, shareName);
  }

  async init(links: string[]): Promise<void> {
    console.log('EarthstarMessaging.init', links);
    await Promise.all(links.map((link) => {
      const [oneParty, otherParty] = link.split(' ');
      return this.ensureReplicas(oneParty, otherParty);
    }));
    console.log('EarthstarMessaging.init');
    console.log(this.shareKeys);
    const shareAddresses = Object.keys(this.shareKeys).map((share) => this.shareKeys[share].shareAddress);
    await Deno.writeTextFile("./known_shares.json", JSON.stringify(shareAddresses, null, 2) + "\n");
    this.earthstarServer = new Earthstar.Server([
      new Earthstar.ExtensionKnownShares({
        knownSharesPath: "./known_shares.json",
        onCreateReplica: (address) => {
          console.log(`Creating replica for ${address}...`);

          return new Earthstar.Replica({
            driver: new Earthstar.ReplicaDriverFs(address, "./.share_data"),
          });
        },
      }),
      new Earthstar.ExtensionSyncWeb(),
    ]);
    // FIXME: how can we know when the server is ready?
    await new Promise((resolve) => setTimeout(resolve, 10000));
    // await this.earthstarServer.start();
    console.log("Syncing peers with server");
    Object.keys(this.peers).forEach((peer) => {
      this.peers[peer].sync("http://localhost:8000", true);
    });
    console.log("EarthstarMessaging initialized");
  }
  async send(transportPackage: TransportPackage): Promise<void> {
    const shareToUse = await this.ensureShareKey(transportPackage.sender, transportPackage.receiver);
    const authorKeyToUse = await this.ensureAuthorKey(transportPackage.sender);
    console.log('EarthstarMessaging.send', transportPackage, shareToUse, authorKeyToUse);
    const replica = await this.ensureReplica(toFourChar(transportPackage.sender), shareToUse);
    replica.set(authorKeyToUse, {
      text: transportPackage.message,
      path: `/chat/~${authorKeyToUse.address}/${this.counter++}`
    });
    // console.log('EarthstarMessaging.send', transportPackage);
    // this.networkSimulator.receive(transportPackage);
  }
}