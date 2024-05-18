/* eslint-disable @typescript-eslint/no-explicit-any */

import { readFileSync } from 'node:fs';
import { MixedNetworkSimulator, Saiga } from './main.ts';

const TESTNET_CSV = '__tests__/fixtures/testnet-10.csv';
const NUM_ROUNDS = 100000;

async function run(): Promise<void> {
  console.log("This simulation will take about 60 seconds to complete.");
  const nodes: { [index: string]: Saiga } = {};
  let flushReport;
  const networkSimulator = new MixedNetworkSimulator();
  await networkSimulator.init();
  const data = readFileSync(TESTNET_CSV, 'utf8')
  const lines = data.split('\n').map(line => {
    const [ from, to ] = line.split(' ')
    return { from, to }
  }).filter(line => line.from !== 'from' && line.from !== '');
  lines.forEach(async line => {
    if (typeof nodes[line.from] === 'undefined') {
      // console.log("Adding node", line.from);
      nodes[line.from] = new Saiga(line.from);
      networkSimulator.addNode(line.from, nodes[line.from]);
    }
    if (typeof nodes[line.to] === 'undefined') {
      // console.log("Adding node", line.to);
      nodes[line.to] = new Saiga(line.to);
      networkSimulator.addNode(line.to, nodes[line.to]);
    }
    // console.log("Meeting", JSON.stringify(line.from), JSON.stringify(line.to));
    await nodes[line.from].meet(line.to);
    networkSimulator.flush();
  });
  let counter = 0;
  do {
    flushReport = networkSimulator.flush();
  } while ((flushReport.length > 0) && (counter++ < NUM_ROUNDS));
  Object.keys(nodes).forEach((nodeId) => {
    console.log(nodeId, nodes[nodeId].getLoops());
  });
}

// ...
run();