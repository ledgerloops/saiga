// deno-lint-ignore-file no-explicit-any
import { MixedNetworkSimulator, TransportPackage } from "./networksimulator.ts";
import * as Earthstar from "https://deno.land/x/earthstar@v10.2.2/mod.ts";

export async function simulate(saigaFactory: (name: string) => any) {
  const shareKeys: {
    [index: string]: Earthstar.ShareKeypair
  } = {
    'alic-bobb': await Earthstar.Crypto.generateShareKeypair("albo") as Earthstar.ShareKeypair,
    'alic-char': await Earthstar.Crypto.generateShareKeypair("alch") as Earthstar.ShareKeypair,
    'bobb-char': await Earthstar.Crypto.generateShareKeypair("boch") as Earthstar.ShareKeypair,
    'alic-dave': await Earthstar.Crypto.generateShareKeypair("alda") as Earthstar.ShareKeypair,
    'alic-edwa': await Earthstar.Crypto.generateShareKeypair("aled") as Earthstar.ShareKeypair,
    'dave-edwa': await Earthstar.Crypto.generateShareKeypair("daed") as Earthstar.ShareKeypair,
  };
  const shareAddresses = Object.keys(shareKeys).map((share) => shareKeys[share].shareAddress);
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

  const servers: {
    [index: string]: any
  } = {};
  Object.keys(shareKeys).forEach((share) => {
    const participants = share.split('-');
    participants.forEach((participant) => {
      if (!servers[participant]) {
        servers[participant] = saigaFactory(participant);
      }
    });
    servers[participants[0]].meet(participants[1], shareKeys[share]);
    servers[participants[1]].meet(participants[0], shareKeys[share]);
  });
}


export class EarthstarMessaging {
    networkSimulator: MixedNetworkSimulator;
    constructor(networkSimulator: MixedNetworkSimulator) {
        // console.log('EarthstarMessaging instantiated');
        this.networkSimulator = networkSimulator;
    }
    send(transportPackage: TransportPackage): void {
        // console.log('EarthstarMessaging.send', transportPackage);
        this.networkSimulator.receive(transportPackage);
    }
}