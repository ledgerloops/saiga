import { MixedNetworkSimulator, TransportPackage } from "./networksimulator.ts";
import * as Earthstar from "https://deno.land/x/earthstar@v10.2.2/mod.ts";

export class EarthstarMessaging {
  shareKeys: {
    [index: string]: Earthstar.ShareKeypair
  } = {};
  networkSimulator: MixedNetworkSimulator;
  constructor(networkSimulator: MixedNetworkSimulator) {
    // console.log('EarthstarMessaging instantiated');
    this.networkSimulator = networkSimulator;
  }
  async init() {
    console.log('EarthstarMessaging.init');
    this.shareKeys = {
      'alice-bob': await Earthstar.Crypto.generateShareKeypair("a--b") as Earthstar.ShareKeypair,
      'alice-charlie': await Earthstar.Crypto.generateShareKeypair("a--c") as Earthstar.ShareKeypair,
      'bob-charlie': await Earthstar.Crypto.generateShareKeypair("b--c") as Earthstar.ShareKeypair,
      'alice-dave': await Earthstar.Crypto.generateShareKeypair("a--d") as Earthstar.ShareKeypair,
      'alice-edward': await Earthstar.Crypto.generateShareKeypair("a--e") as Earthstar.ShareKeypair,
      'dave-edward': await Earthstar.Crypto.generateShareKeypair("d--e") as Earthstar.ShareKeypair,
    };
    const shareAddresses = Object.keys(this.shareKeys).map((share) => this.shareKeys[share].shareAddress);
    await Deno.writeTextFile("./known_shares.json", JSON.stringify(shareAddresses, null, 2) + "\n");
    new Earthstar.Server([
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
  }
  send(transportPackage: TransportPackage): void {
    // console.log('EarthstarMessaging.send', transportPackage);
    this.networkSimulator.receive(transportPackage);
  }
}